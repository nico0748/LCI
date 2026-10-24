#!/bin/bash
# /opt/lci/run.sh — ウォームコンテナ内で 1 コマンドを制限付きで実行するラッパ。
# 使い方: run.sh WALL_SEC MEM_KB OUT_CAP_BYTES -- cmd args...
#   stdin  : プログラムへの入力（全部読み切って .stdin に置く）
#   stdout : 1 行目 "LCI1 <exit> <elapsed_us> <oom_delta> <out_bytes> <err_bytes>"、
#            続けて stdout を OUT_CAP バイトまで、次に stderr を OUT_CAP バイトまで（区切りなし、長さは 1 行目）
# ホスト側（backend-docker.ts）は 1 行目の長さ情報でバイト単位に切り出す。
# 02 §サーバ内部の実行手順: timeout -s KILL と ulimit を exec ごとに掛け、cgroup の oom_kill を前後で比較する。
set -u
wall="$1"; memkb="$2"; cap="$3"; shift 3
[ "${1:-}" = "--" ] && shift

cat > .stdin

oom_count() { awk '/^oom_kill /{print $2}' /sys/fs/cgroup/memory.events 2>/dev/null || true; }
oom0=$(oom_count); oom0=${oom0:-0}

t0=${EPOCHREALTIME/./}
(
  if [ "$memkb" -gt 0 ]; then ulimit -v "$memkb" 2>/dev/null; fi
  # 出力ファイルの肥大化は SIGXFSZ で止める（OLE）。KB 単位、余裕 64KB
  ulimit -f $(( cap / 1024 + 64 )) 2>/dev/null
  ulimit -c 0 2>/dev/null
  exec timeout -s KILL "$wall" "$@" < .stdin > .out 2> .err
)
ec=$?
t1=${EPOCHREALTIME/./}
oom1=$(oom_count); oom1=${oom1:-0}

outlen=$(stat -c %s .out 2>/dev/null || echo 0)
errlen=$(stat -c %s .err 2>/dev/null || echo 0)
printf 'LCI1 %s %s %s %s %s\n' "$ec" "$(( 10#$t1 - 10#$t0 ))" "$(( oom1 - oom0 ))" "$outlen" "$errlen"
head -c "$cap" .out
head -c "$cap" .err
rm -f .stdin .out .err
exit 0
