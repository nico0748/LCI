import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { DockerBackend, containerRunArgs, parseRunOutput } from "./backend-docker.ts";
import { buildTar } from "./tar.ts";
import { RUNNER_LANGUAGES } from "./types.ts";
import { IMAGE_SHORT } from "./languages.ts";

/** docker デーモンが無い環境でも検証できる部分（起動引数・run.sh 応答の解釈・tar）だけをテストする */

test("container run args carry the hardening flags (02 FR-X-01-2)", () => {
  const a = containerRunArgs("python");
  const joined = a.join(" ");
  for (const flag of [
    "--network none",
    "--read-only",
    "--tmpfs /work:rw,exec,nosuid,size=256m",
    "--cap-drop ALL",
    "--security-opt no-new-privileges",
    "--pids-limit 128",
    "--memory 512m",
    "--memory-swap 512m",
    "--cpus 1",
    "--user 1000:1000",
    "--name lci-python",
  ]) {
    assert.ok(joined.includes(flag), `missing ${flag}`);
  }
  assert.deepEqual(a.slice(-3), ["lci/python:v1", "sleep", "infinity"]);
  assert.deepEqual(containerRunArgs("typescript").slice(-3), ["lci/node:v1", "sleep", "infinity"]);
  assert.ok(containerRunArgs("go").includes("lci-gocache:/gocache"));
});

test("parseRunOutput splits stdout/stderr by byte length and flags TLE/OOM/OLE", () => {
  const out = Buffer.concat([Buffer.from("LCI1 0 12345 0 6 3\n"), Buffer.from("héllo"), Buffer.from("err")]);
  const r = parseRunOutput(out, 1024 * 1024, 5000);
  assert.ok(!("error" in r && !("exitCode" in r)));
  const e = r as Exclude<typeof r, { error: string }>;
  assert.equal(e.stdout, "héllo");
  assert.equal(e.stderr, "err");
  assert.equal(e.timeMs, 12);
  assert.equal(e.timedOut, false);

  const tle = parseRunOutput(Buffer.from("LCI1 137 5001000 0 0 0\n"), 1024, 5000) as { timedOut: boolean; oomKilled: boolean };
  assert.equal(tle.timedOut, true);
  const oom = parseRunOutput(Buffer.from("LCI1 137 300000 1 0 0\n"), 1024, 5000) as { timedOut: boolean; oomKilled: boolean };
  assert.equal(oom.timedOut, false);
  assert.equal(oom.oomKilled, true);
  // 出力が上限を超えた: 実バイト数は大きいが、切り出しは cap まで
  const big = Buffer.concat([Buffer.from("LCI1 0 1000 0 5000 0\n"), Buffer.alloc(10, 0x61)]);
  const ole = parseRunOutput(big, 10, 5000) as { outputExceeded: boolean; stdout: string };
  assert.equal(ole.outputExceeded, true);
  assert.equal(ole.stdout, "aaaaaaaaaa");
  assert.ok("error" in parseRunOutput(Buffer.from("garbage"), 10, 10));
});

test("buildTar produces an archive that system tar extracts", async (t) => {
  let hasTar = true;
  try {
    execFileSync("tar", ["--version"], { stdio: "ignore" });
  } catch {
    hasTar = false;
  }
  if (!hasTar) return t.skip("tar がありません");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lci-tar-"));
  const tarBuf = buildTar([
    { path: "main.py", content: "print('こんにちは')\n" },
    { path: "sub/a.txt", content: "x".repeat(1000) },
  ]);
  execFileSync("tar", ["-x", "-C", dir], { input: tarBuf });
  assert.equal(await fs.readFile(path.join(dir, "main.py"), "utf8"), "print('こんにちは')\n");
  assert.equal((await fs.readFile(path.join(dir, "sub/a.txt"), "utf8")).length, 1000);
  await fs.rm(dir, { recursive: true, force: true });
});

test("DockerBackend.status reports missing when the docker binary does not exist", async () => {
  const b = new DockerBackend({ dockerBin: "/nonexistent/docker-lci" });
  const s = await b.status();
  assert.equal(s.docker, "missing");
  assert.equal(s.images.length, RUNNER_LANGUAGES.length);
  assert.ok(s.images.every((i) => !i.present));
  const progress = [];
  for await (const p of b.warm()) progress.push(p);
  assert.equal(progress[0]?.phase, "error");
});

test("every image has a Dockerfile and run.sh is shared", async () => {
  const dockerDir = path.resolve(import.meta.dirname, "../../../docker");
  for (const short of new Set(Object.values(IMAGE_SHORT))) {
    const df = await fs.readFile(path.join(dockerDir, `${short}.Dockerfile`), "utf8");
    assert.match(df, /^FROM \S+:\S+/m, `${short}: ベースタグを固定する`);
    assert.match(df, /run\.sh/, `${short}: run.sh を焼き込む`);
    assert.match(df, /USER 1000:1000/, `${short}: 非 root`);
  }
  const sh = await fs.readFile(path.join(dockerDir, "run.sh"), "utf8");
  assert.match(sh, /timeout -s KILL/);
});

test("run.sh protocol works under local bash", async (t) => {
  // コンテナ外でも bash + coreutils があれば run.sh の応答形式を確認できる
  try {
    execFileSync("bash", ["-c", "command -v timeout && command -v stat"], { stdio: "ignore" });
  } catch {
    return t.skip("bash / coreutils がありません");
  }
  const sh = path.resolve(import.meta.dirname, "../../../docker/run.sh");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lci-runsh-"));
  const out = execFileSync("bash", [sh, "2", "0", "1024", "--", "bash", "-c", "read x; echo got:$x; echo oops >&2; exit 3"], { cwd: dir, input: "hi\n" });
  const r = parseRunOutput(out, 1024, 2000) as { exitCode: number; stdout: string; stderr: string };
  assert.equal(r.exitCode, 3);
  assert.equal(r.stdout, "got:hi\n");
  assert.equal(r.stderr, "oops\n");
  const tle = parseRunOutput(execFileSync("bash", [sh, "0.3", "0", "1024", "--", "sleep", "5"], { cwd: dir }), 1024, 300) as { exitCode: number; timedOut: boolean };
  assert.equal(tle.exitCode, 137);
  assert.equal(tle.timedOut, true);
  await fs.rm(dir, { recursive: true, force: true });
});
