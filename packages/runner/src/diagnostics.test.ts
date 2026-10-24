import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeFile, parseGcc, parseGo, parseNode, parsePhp, parsePython, parseRustPanic, parseRustcJson, parseRustcText, renderRustcStderr } from "./diagnostics.ts";

// フィクスチャは実際のツールチェーン出力（gcc 13 / rustc 1.97 / go 1.24 / node 22 / python 3.13 / php 8.3）から採取した

test("normalizeFile strips container work dir and file://", () => {
  assert.equal(normalizeFile("/work/r1abc/main.py"), "main.py");
  assert.equal(normalizeFile("/work/r1abc/sub/a.ts"), "sub/a.ts");
  assert.equal(normalizeFile("file:///work/r1/main.ts"), "main.ts");
  assert.equal(normalizeFile("./main.go"), "main.go");
  assert.equal(normalizeFile("/tmp/x/y/main.c"), "main.c");
});

test("gcc text diagnostics", () => {
  const s = `main.c: In function 'main':
main.c:2:35: error: 'y' undeclared (first use in this function)
    2 | int main(){ int x; printf("%d\\n", y); return 0; }
      |                                   ^
main.c:2:35: note: each undeclared identifier is reported only once for each function it appears in
main.c:2:17: warning: unused variable 'x' [-Wunused-variable]
/usr/bin/ld: /tmp/ccX.o: in function \`main':
main.c:(.text+0x1a): undefined reference to \`foo'
`;
  const d = parseGcc(s);
  assert.deepEqual(d[0], { file: "main.c", line: 2, col: 35, severity: "error", message: "'y' undeclared (first use in this function)" });
  assert.equal(d[1]?.severity, "info");
  assert.deepEqual(d[2], { file: "main.c", line: 2, col: 17, severity: "warning", message: "unused variable 'x' [-Wunused-variable]" });
  assert.equal(d[3]?.severity, "error");
  assert.match(d[3]!.message, /undefined reference to foo/);
});

const RUSTC_JSON = [
  `{"$message_type":"diagnostic","message":"mismatched types","code":{"code":"E0308","explanation":"..."},"level":"error","spans":[{"file_name":"main.rs","byte_start":25,"byte_end":28,"line_start":1,"line_end":1,"column_start":26,"column_end":29,"is_primary":true,"text":[],"label":"expected \`i32\`, found \`&str\`"},{"file_name":"main.rs","byte_start":19,"byte_end":22,"line_start":1,"line_end":1,"column_start":20,"column_end":23,"is_primary":false,"text":[],"label":"expected due to this"}],"children":[],"rendered":"error[E0308]: mismatched types\\n --> main.rs:1:26\\n\\n"}`,
  `{"$message_type":"diagnostic","message":"unused variable: \`y\`","code":{"code":"unused_variables","explanation":null},"level":"warning","spans":[{"file_name":"main.rs","byte_start":40,"byte_end":41,"line_start":2,"line_end":2,"column_start":9,"column_end":10,"is_primary":true,"text":[],"label":null}],"children":[],"rendered":"warning: unused variable: \`y\`\\n"}`,
  `{"$message_type":"diagnostic","message":"aborting due to 1 previous error","code":null,"level":"error","spans":[],"children":[],"rendered":"error: aborting due to 1 previous error\\n\\n"}`,
  `{"$message_type":"diagnostic","message":"For more information about this error, try \`rustc --explain E0308\`.","code":null,"level":"failure-note","spans":[],"children":[],"rendered":"For more information about this error, try \`rustc --explain E0308\`.\\n"}`,
].join("\n");

test("rustc --error-format=json", () => {
  const d = parseRustcJson(RUSTC_JSON);
  assert.equal(d.length, 2);
  assert.deepEqual(d[0], { file: "main.rs", line: 1, col: 26, severity: "error", message: "[E0308] mismatched types" });
  assert.deepEqual(d[1], { file: "main.rs", line: 2, col: 9, severity: "warning", message: "[unused_variables] unused variable: `y`" });
  assert.match(renderRustcStderr(RUSTC_JSON), /error\[E0308\]: mismatched types\n --> main.rs:1:26/);
});

test("rustc human text (fallback)", () => {
  const s = `error[E0425]: cannot find value \`z\` in this scope
 --> lib.rs:3:5
  |
3 |     z
  |     ^ not found in this scope

error: aborting due to 1 previous error
`;
  assert.deepEqual(parseRustcText(s), [{ file: "lib.rs", line: 3, col: 5, severity: "error", message: "[E0425] cannot find value `z` in this scope" }]);
});

test("rust runtime panic", () => {
  const s = `thread 'main' (4320) panicked at main.rs:7:13:
index out of bounds: the len is 3 but the index is 5
note: run with \`RUST_BACKTRACE=1\` environment variable to display a backtrace
`;
  assert.deepEqual(parseRustPanic(s), [{ file: "main.rs", line: 7, col: 13, severity: "error", message: "panic: index out of bounds: the len is 3 but the index is 5" }]);
});

test("go build errors and runtime panic", () => {
  const s = `# command-line-arguments
./main.go:2:8: "fmt" imported and not used
./main.go:3:15: declared and not used: x
`;
  assert.deepEqual(parseGo(s), [
    { file: "main.go", line: 2, col: 8, severity: "error", message: '"fmt" imported and not used' },
    { file: "main.go", line: 3, col: 15, severity: "error", message: "declared and not used: x" },
  ]);
  const p = `panic: runtime error: index out of range [3] with length 3

goroutine 1 [running]:
main.main()
	/work/r1/main.go:7 +0x1d
exit status 2
`;
  assert.deepEqual(parseGo(p), [{ file: "main.go", line: 7, severity: "error", message: "runtime error: index out of range [3] with length 3" }]);
});

test("node strip-types syntax error with caret column", () => {
  const s = `/work/r1/main.ts:1
const x: number = ;
                  ^

SyntaxError [ERR_INVALID_TYPESCRIPT_SYNTAX]: Expression expected
    at parseTypeScript (node:internal/modules/typescript:67:36)
    at processTypeScriptCode (node:internal/modules/typescript:133:42)

Node.js v22.22.0
`;
  assert.deepEqual(parseNode(s), [{ file: "main.ts", line: 1, col: 19, severity: "error", message: "SyntaxError: Expression expected" }]);
});

test("node unsupported syntax (enum) and runtime error", () => {
  const e = `/work/r1/main.ts:1
enum E { A }
^^^^^^^^^^^^
console.log(E.A)

SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode
`;
  assert.deepEqual(parseNode(e), [{ file: "main.ts", line: 1, col: 1, severity: "error", message: "SyntaxError: TypeScript enum is not supported in strip-only mode" }]);
  const r = `/work/r1/main.ts:1
function f(){ throw new Error("boom") }
              ^

Error: boom
    at f (/work/r1/main.ts:1:21)
`;
  assert.deepEqual(parseNode(r), [{ file: "main.ts", line: 1, col: 15, severity: "error", message: "Error: boom" }]);
});

test("python traceback picks innermost user frame", () => {
  const s = `Traceback (most recent call last):
  File "/work/r1/main.py", line 3, in <module>
    print(f())
          ~^^
  File "/work/r1/main.py", line 2, in f
    return 1/0
           ~^~
ZeroDivisionError: division by zero
`;
  assert.deepEqual(parsePython(s), [{ file: "main.py", line: 2, col: undefined, severity: "error", message: "ZeroDivisionError: division by zero" }]);
});

test("python SyntaxError column", () => {
  const s = `  File "/work/r1/main.py", line 1
    x = (
        ^
SyntaxError: '(' was never closed
`;
  assert.deepEqual(parsePython(s), [{ file: "main.py", line: 1, col: 5, severity: "error", message: "SyntaxError: '(' was never closed" }]);
});

test("php parse error / fatal / warning, duplicates collapsed", () => {
  const s = `PHP Parse error:  syntax error, unexpected token "echo", expecting "," or ";" in /work/r1/main.php on line 3
Parse error: syntax error, unexpected token "echo", expecting "," or ";" in /work/r1/main.php on line 3
`;
  assert.deepEqual(parsePhp(s), [{ file: "main.php", line: 3, severity: "error", message: 'Parse error: syntax error, unexpected token "echo", expecting "," or ";"' }]);
  const f = `PHP Fatal error:  Uncaught Exception: boom in /work/r1/main.php:2
Stack trace:
#0 {main}
  thrown in /work/r1/main.php on line 2
Warning: Undefined variable $x in /work/r1/main.php on line 5
`;
  const d = parsePhp(f);
  assert.deepEqual(d[0], { file: "main.php", line: 2, severity: "error", message: "Fatal error: Uncaught Exception: boom" });
  assert.deepEqual(d[1], { file: "main.php", line: 5, severity: "warning", message: "Warning: Undefined variable $x" });
});
