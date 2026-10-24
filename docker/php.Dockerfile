# lci/php:v1 — php-cli。拡張は追加しない（標準ビルドのみ）
FROM php:8.3.15-cli-bookworm
RUN groupadd -g 1000 runner && useradd -u 1000 -g 1000 -M -d /tmp -s /bin/bash runner
# run.sh: exec ごとに timeout/ulimit を掛けて結果を 1 行ヘッダで返すラッパ（backend-docker.ts と対）
COPY run.sh /opt/lci/run.sh
RUN chmod 755 /opt/lci/run.sh && mkdir -p /work && chown 1000:1000 /work
# opcache.enable_cli は短命プロセスでは逆効果なので無効のまま
USER 1000:1000
WORKDIR /work
CMD ["sleep", "infinity"]
