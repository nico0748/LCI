#!/usr/bin/env node
// LCI MCP サーバの起動スクリプト。packages/* は .ts を直接実行する規約なので、
// Node の type stripping を有効にして src/main.ts を子プロセスで起動し、stdio をそのまま繋ぐ。
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const main = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "main.ts");
const child = spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", main], { stdio: "inherit", env: process.env });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
