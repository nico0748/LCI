# lci/node:v1 — TypeScript は node --experimental-strip-types で直接実行（型検査はエディタ側のみ、02 言語別の決定）
FROM node:22.12.0-bookworm-slim
# node イメージには uid 1000 の node ユーザが既にいるのでそれを使う
ENV NODE_OPTIONS= NODE_DISABLE_COLORS=1 NO_COLOR=1
# run.sh: exec ごとに timeout/ulimit を掛けて結果を 1 行ヘッダで返すラッパ（backend-docker.ts と対）
COPY run.sh /opt/lci/run.sh
RUN chmod 755 /opt/lci/run.sh && mkdir -p /work && chown 1000:1000 /work
RUN printf 'const x: number = 1;\nconsole.log(x);\n' > /tmp/h.ts && node --experimental-strip-types --no-warnings /tmp/h.ts && rm -f /tmp/h.ts
USER 1000:1000
WORKDIR /work
CMD ["sleep", "infinity"]
