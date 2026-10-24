# lci/go:v1 — go build + go test。GOCACHE を /gocache に事前生成し、
# 実行時は名前付きボリューム lci-gocache に載せて read-only rootfs でもキャッシュを効かせる（02 FR-X-05-3）
FROM golang:1.23.4-bookworm
RUN groupadd -g 1000 runner && useradd -u 1000 -g 1000 -M -d /tmp -s /bin/bash runner
ENV GOCACHE=/gocache GOPATH=/tmp/go GOTOOLCHAIN=local GOFLAGS=-buildvcs=false CGO_ENABLED=0 GOTELEMETRY=off
# run.sh: exec ごとに timeout/ulimit を掛けて結果を 1 行ヘッダで返すラッパ（backend-docker.ts と対）
COPY run.sh /opt/lci/run.sh
RUN chmod 755 /opt/lci/run.sh && mkdir -p /work && chown 1000:1000 /work
RUN mkdir -p /gocache /tmp/warm && cd /tmp/warm \
 && printf 'module warm\n\ngo 1.22\n' > go.mod \
 && printf 'package main\nimport ("bufio";"fmt";"os";"sort";"strings";"strconv";"container/heap";"math")\nvar _ = heap.Init\nvar _ = math.Abs\nvar _ = sort.Ints\nvar _ = strings.Fields\nvar _ = strconv.Itoa\nfunc main(){ r:=bufio.NewReader(os.Stdin); _ = r; fmt.Println("hi") }\n' > main.go \
 && printf 'package main\nimport "testing"\nfunc TestX(t *testing.T){}\n' > main_test.go \
 && go build -o /tmp/warm/app . && go test -json -count=1 . > /dev/null \
 && go vet . && cd / && rm -rf /tmp/warm /tmp/go \
 && chown -R 1000:1000 /gocache
USER 1000:1000
WORKDIR /work
CMD ["sleep", "infinity"]
