#include <stdio.h>
#include <stdlib.h>

static char *buf;
static size_t len, pos;

static void read_all(void) {
    size_t cap = 1 << 16, r;
    buf = malloc(cap);
    while ((r = fread(buf + len, 1, cap - len, stdin)) > 0) {
        len += r;
        if (len == cap) buf = realloc(buf, cap *= 2);
    }
}

static long long next_ll(void) {
    while (pos < len && (buf[pos] < '0' || buf[pos] > '9')) pos++;
    long long x = 0;
    while (pos < len && buf[pos] >= '0' && buf[pos] <= '9') x = x * 10 + (buf[pos++] - '0');
    return x;
}

/* 二分ヒープ（距離 long long、拠点 int）。push は拠点 1 の 1 回と、両向きの各辺で高々 1 回ずつ */
static long long *hk;
static int *hv, hs;

static void push(long long key, int v) {
    int i = hs++;
    while (i > 0) {
        int p = (i - 1) / 2;
        if (hk[p] <= key) break;
        hk[i] = hk[p];
        hv[i] = hv[p];
        i = p;
    }
    hk[i] = key;
    hv[i] = v;
}

static void pop(long long *key, int *v) {
    *key = hk[0];
    *v = hv[0];
    hs--;
    long long lk = hk[hs];
    int lv = hv[hs], i = 0;
    for (;;) {
        int c = 2 * i + 1;
        if (c >= hs) break;
        if (c + 1 < hs && hk[c + 1] < hk[c]) c++;
        if (hk[c] >= lk) break;
        hk[i] = hk[c];
        hv[i] = hv[c];
        i = c;
    }
    hk[i] = lk;
    hv[i] = lv;
}

int main(void) {
    read_all();
    int n = (int)next_ll(), m = (int)next_ll();
    long long T = next_ll(); /* 最大 10^12 なので long long */
    int *eu = malloc(sizeof(int) * (m + 1)), *ev = malloc(sizeof(int) * (m + 1));
    int *ew = malloc(sizeof(int) * (m + 1));
    int *start = calloc(n + 2, sizeof(int));
    for (int j = 0; j < m; j++) {
        eu[j] = (int)next_ll();
        ev[j] = (int)next_ll();
        ew[j] = (int)next_ll();
        start[eu[j] + 1]++;
        start[ev[j] + 1]++;
    }
    /* 隣接リストを CSR（拠点 v の辺は to[start[v]] .. to[start[v+1]-1]）で持つ */
    for (int v = 1; v <= n + 1; v++) start[v] += start[v - 1];
    int *fill = malloc(sizeof(int) * (n + 2));
    for (int v = 0; v <= n + 1; v++) fill[v] = start[v];
    int *to = malloc(sizeof(int) * (2 * m + 1)), *wt = malloc(sizeof(int) * (2 * m + 1));
    for (int j = 0; j < m; j++) {
        to[fill[eu[j]]] = ev[j];
        wt[fill[eu[j]]++] = ew[j];
        to[fill[ev[j]]] = eu[j];
        wt[fill[ev[j]]++] = ew[j];
    }
    hk = malloc(sizeof(long long) * (2 * m + 2));
    hv = malloc(sizeof(int) * (2 * m + 2));
    long long *dist = malloc(sizeof(long long) * (n + 1));
    for (int v = 0; v <= n; v++) dist[v] = -1; /* -1 = 未到達 */
    dist[1] = 0;
    push(0, 1);
    while (hs > 0) {
        long long d;
        int u;
        pop(&d, &u);
        if (d > dist[u]) continue; /* 古い要素は捨てる */
        for (int e = start[u]; e < start[u + 1]; e++) {
            long long nd = d + wt[e];
            int v = to[e];
            if (dist[v] < 0 || nd < dist[v]) {
                dist[v] = nd;
                push(nd, v);
            }
        }
    }
    int within = 0;
    for (int v = 1; v <= n; v++)
        if (dist[v] >= 0 && dist[v] <= T) within++;
    printf("%d\n%lld\n", within, dist[n]);
    return 0;
}
