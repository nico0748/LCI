# docker/ — 言語別実行イメージ

`@lci/runner` の DockerBackend が使う 6 イメージ（02 FR-X-05）。各言語 1 本のウォームコンテナ `lci-<lang>` を
`sleep infinity` で常駐させ、実行ごとに `docker exec` で `/opt/lci/run.sh` を呼ぶ。

| イメージ | ベース（arm64 / amd64 マルチアーチ公式） | 用途 | 目安サイズ |
|---|---|---|---|
| `lci/c:v1` | `debian:12.9-slim` + apt `gcc libc6-dev` | `gcc -O2 -std=c17 -Wall … -lm` | 約 250 MB |
| `lci/rust:v1` | `rust:1.83-slim-bookworm` | `rustc -O --edition 2021 --error-format=json`（cargo なし） | 約 900 MB |
| `lci/python:v1` | `python:3.12.8-slim-bookworm` | `python3 -I -u`、標準ライブラリのみ | 約 150 MB |
| `lci/go:v1` | `golang:1.23.4-bookworm` | `go build` / `go test -json`、GOCACHE 事前生成 | 約 850 MB |
| `lci/node:v1` | `node:22.12.0-bookworm-slim` | `node --experimental-strip-types`（TypeScript） | 約 220 MB |
| `lci/php:v1` | `php:8.3.15-cli-bookworm` | `php -l` → `php` | 約 500 MB |

合計 約 2.9 GB（02 非機能要件「≤ 3 GB」）。サイズは公式イメージの公開値からの見積もりで、実測ではない。
初回ビルドはベース取得を含めて 100 Mbps で 5〜10 分。以後は完全オフラインで動く。

## 使い方（Mac: Docker Desktop または OrbStack）

```sh
# 1) Docker Desktop / OrbStack を起動しておく
pnpm runner:build          # 6 イメージをビルド（docker compose -f docker/docker-compose.yml build）
pnpm runner:warm           # 未ビルドならビルドし、ウォームコンテナ 6 本を起動
pnpm runner:status         # docker / images / containers の状態を JSON で表示
pnpm runner:bench 20       # 各言語の echo プログラムを 20 回実行して p50 / p95 を表示
pnpm runner:warm python go # 言語を絞る。--rebuild で作り直し、--verbose で build ログ
```

アプリからは「イメージを取得」ボタン（`POST /api/runner/warm`、SSE で進捗）でも同じことができる。
コンテナは `docker rm -f lci-c lci-rust lci-python lci-go lci-node lci-php` で消せる（次の実行で自動再作成）。

## コンテナの起動オプション（02 FR-X-01-2）

```
docker run -d --init --name lci-<lang> --label lci.lang=<lang>
  --network none --read-only
  --tmpfs /work:rw,exec,nosuid,size=256m --tmpfs /tmp:rw,exec,nosuid,size=64m
  --cap-drop ALL --security-opt no-new-privileges
  --pids-limit 128 --memory 512m --memory-swap 512m --cpus 1 --user 1000:1000
  [go のみ: -v lci-gocache:/gocache]
  lci/<lang>:v1 sleep infinity
```

- `--init`: PID 1 を tini にし、kill された子プロセスのゾンビが pids-limit を食いつぶさないようにする。
- `/tmp` も exec 付き: `go test` は TMPDIR にテストバイナリを置いて実行するため。
- Go の GOCACHE は名前付きボリューム `lci-gocache`。read-only rootfs でもビルドキャッシュに書けるようにし、
  初回はイメージ内で事前生成した `/gocache`（std + testing）がボリュームへコピーされる。

## 実行ごとの制限（`run.sh`）

`run.sh WALL_SEC MEM_KB OUT_CAP_BYTES -- cmd…` が `timeout -s KILL`、`ulimit -v`（C/Rust/Python/PHP のみ。Go/Node は
ランタイムの仮想領域予約が大きいので cgroup の 512m に任せる）、`ulimit -f`、`ulimit -c 0` を掛けて実行し、
1 行目に `LCI1 <exit> <elapsed_us> <oom_kill差分> <stdout bytes> <stderr bytes>` を返す。
OOM は `/sys/fs/cgroup/memory.events` の `oom_kill` を実行前後で比較して判定する（cgroup v2。v1 環境では
exit 137 かつ時間内終了を MLE とみなすヒューリスティックに落ちる）。

TLE / MLE / OLE / 基盤エラーの後はコンテナを `rm -f` → 再 `run` する（02 FR-X-01-4、目標 ≤ 2 s）。

## 期待レイテンシ（未実測。`pnpm runner:bench` で測って追記する）

| 言語 | Run 押下 → 結果（ウォーム時の見込み） |
|---|---|
| Python / PHP | 0.15〜0.4 s（exec 往復 3 回: 配置・実行・掃除） |
| TypeScript | 0.3〜0.6 s |
| C | 0.4〜0.9 s |
| Go | 0.6〜1.5 s（GOCACHE 有効時） |
| Rust | 1〜3 s（`-O` のため。遅ければ `languages.ts` の compileCommand を `-C opt-level=0` に） |

OrbStack の方が Docker Desktop より `docker exec` 往復が速い傾向（02 実測タスク 1）。

## ピン留めについて

タグは major.minor.patch まで固定している。完全な再現性が必要なら `docker buildx imagetools inspect <base>` で
ダイジェストを調べ、`FROM python:3.12.8-slim-bookworm@sha256:…` の形に書き換える（02 FR-X-05-1）。
イメージ構成を変えたら `packages/runner/src/languages.ts` の `IMAGE_TAG` を上げ、古いコンテナを使い続けないようにする。
