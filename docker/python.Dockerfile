# lci/python:v1 — CPython 標準ライブラリのみ（numpy 等は入れない、02 FR-X-05-5）
FROM python:3.12.8-slim-bookworm
RUN groupadd -g 1000 runner && useradd -u 1000 -g 1000 -M -d /tmp -s /bin/bash runner
# run.sh: exec ごとに timeout/ulimit を掛けて結果を 1 行ヘッダで返すラッパ（backend-docker.ts と対）
COPY run.sh /opt/lci/run.sh
RUN chmod 755 /opt/lci/run.sh && mkdir -p /work && chown 1000:1000 /work
# 標準ライブラリの .pyc を事前生成（read-only rootfs では実行時に書けないため）
RUN python3 -m compileall -q /usr/local/lib/python3.12 || true
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONIOENCODING=utf-8
USER 1000:1000
WORKDIR /work
CMD ["sleep", "infinity"]
