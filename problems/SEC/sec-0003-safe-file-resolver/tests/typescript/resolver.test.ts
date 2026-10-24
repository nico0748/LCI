import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PathError, resolveUserFile } from "./resolver.ts";

let tmp = "";
let pub = "";

before(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "lci-resolver-")));
  const root = path.join(tmp, "root");
  pub = path.join(root, "public");
  fs.mkdirSync(path.join(pub, "img"), { recursive: true });
  fs.mkdirSync(path.join(root, "public-secret"));
  fs.mkdirSync(path.join(root, "secret_dir"));
  const files: [string, string][] = [
    ["public/a.txt", "A"],
    ["public/img/cat.png", "PNG"],
    ["public/日本語.txt", "JA"],
    ["public/..hidden", "H"],
    ["public-secret/x.txt", "X"],
    ["secret.txt", "S"],
    ["secret_dir/s.txt", "SD"],
  ];
  for (const [p, body] of files) fs.writeFileSync(path.join(root, p), body);
  fs.symlinkSync(path.join(pub, "a.txt"), path.join(pub, "link_in"));
  fs.symlinkSync(path.join(root, "secret.txt"), path.join(pub, "link_out"));
  fs.symlinkSync(path.join(root, "secret_dir"), path.join(pub, "dirlink_out"));
  fs.symlinkSync(path.join(pub, "img"), path.join(pub, "dirlink_in"));
  fs.symlinkSync(path.join(pub, "missing"), path.join(pub, "broken"));
  fs.symlinkSync(pub, path.join(tmp, "baselink"));
});

after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function code(userPath: string, base = pub): string {
  try {
    resolveUserFile(base, userPath);
  } catch (e) {
    assert.ok(e instanceof PathError, `PathError を投げるべき: ${String(e)}`);
    return e.code;
  }
  assert.fail(`拒否されなかった: ${JSON.stringify(userPath)}`);
}

test("simple", () => {
  assert.equal(resolveUserFile(pub, "a.txt"), path.join(pub, "a.txt"));
  assert.equal(resolveUserFile(pub, "img/cat.png"), path.join(pub, "img", "cat.png"));
  assert.equal(resolveUserFile(pub, "日本語.txt"), path.join(pub, "日本語.txt"));
});

test("dotdot staying inside", () => {
  assert.equal(resolveUserFile(pub, "./img/../a.txt"), path.join(pub, "a.txt"));
  assert.equal(resolveUserFile(pub, "img//cat.png"), path.join(pub, "img", "cat.png"));
});

test("file whose name starts with ..", () => assert.equal(resolveUserFile(pub, "..hidden"), path.join(pub, "..hidden")));

test("traversal", () => {
  for (const p of ["../secret.txt", "img/../../secret.txt", "../../../../etc/passwd", "..", "../", "img/../.."]) assert.equal(code(p), "outside_base", p);
});

test("naive strip bypass is just a name", () => assert.equal(code("....//....//secret.txt"), "not_found"));

test("sibling directory sharing a prefix", () => assert.equal(code("../public-secret/x.txt"), "outside_base"));

test("outside and nonexistent does not leak existence", () => assert.equal(code("../nope.txt"), "outside_base"));

test("invalid", () => {
  for (const p of ["", "/etc/passwd", "a.txt\0.png", "..\\secret.txt", "img\\cat.png"]) assert.equal(code(p), "invalid_path", JSON.stringify(p));
});

test("symlinks", () => {
  assert.equal(resolveUserFile(pub, "link_in"), path.join(pub, "a.txt"));
  assert.equal(resolveUserFile(pub, "dirlink_in/cat.png"), path.join(pub, "img", "cat.png"));
  assert.equal(code("link_out"), "outside_base");
  assert.equal(code("dirlink_out/s.txt"), "outside_base");
});

test("not found and not a file", () => {
  assert.equal(code("nope.txt"), "not_found");
  assert.equal(code("broken"), "not_found");
  assert.equal(code("img"), "not_a_file");
  assert.equal(code("."), "not_a_file");
});

test("no double decoding", () => assert.equal(code("%2e%2e/secret.txt"), "not_found"));

test("base dir is a symlink", () => {
  const base = path.join(tmp, "baselink");
  assert.equal(resolveUserFile(base, "a.txt"), path.join(pub, "a.txt"));
  assert.equal(code("../secret.txt", base), "outside_base");
});
