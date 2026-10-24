# lci/c:v1 — gcc（C17）。gcc 公式イメージは 1 GB 超なので debian-slim + apt の gcc にする
FROM debian:12.9-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc libc6-dev \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd -g 1000 runner && useradd -u 1000 -g 1000 -M -d /tmp -s /bin/bash runner
# run.sh: exec ごとに timeout/ulimit を掛けて結果を 1 行ヘッダで返すラッパ（backend-docker.ts と対）
COPY run.sh /opt/lci/run.sh
RUN chmod 755 /opt/lci/run.sh && mkdir -p /work && chown 1000:1000 /work
# ヘッダ解析・cc1 のページキャッシュを温める（初回コンパイルの体感を揃える）
RUN printf '#include <stdio.h>\n#include <math.h>\nint main(void){printf("%%f\\n", sqrt(2.0));return 0;}\n' > /tmp/h.c \
 && gcc -O2 -std=c17 -Wall -o /tmp/h /tmp/h.c -lm && /tmp/h && rm -f /tmp/h /tmp/h.c
USER 1000:1000
WORKDIR /work
CMD ["sleep", "infinity"]
