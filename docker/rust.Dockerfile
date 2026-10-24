# lci/rust:v1 — rustc 直接（cargo は使わない: 依存解決とビルド時間が 3 s 目標を超えるため、02 R5）
FROM rust:1.83-slim-bookworm
RUN groupadd -g 1000 runner && useradd -u 1000 -g 1000 -M -d /tmp -s /bin/bash runner
# run.sh: exec ごとに timeout/ulimit を掛けて結果を 1 行ヘッダで返すラッパ（backend-docker.ts と対）
COPY run.sh /opt/lci/run.sh
RUN chmod 755 /opt/lci/run.sh && mkdir -p /work && chown 1000:1000 /work
# std の rlib はイメージ同梱。hello と --test を一度ビルドしてリンカ／ローダを温める（02 FR-X-05-3）
RUN printf 'fn main(){ println!("hi"); }\n#[test] fn t(){ assert_eq!(1,1); }\n' > /tmp/h.rs \
 && rustc -O --edition 2021 -o /tmp/h /tmp/h.rs && /tmp/h \
 && rustc --test --edition 2021 -o /tmp/ht /tmp/h.rs && /tmp/ht \
 && rm -f /tmp/h /tmp/ht /tmp/h.rs
ENV RUST_BACKTRACE=0
USER 1000:1000
WORKDIR /work
CMD ["sleep", "infinity"]
