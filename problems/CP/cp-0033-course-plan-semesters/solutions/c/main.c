#include <stdio.h>
#include <stdlib.h>

static char *buf;
static int read_int(void) {
    while (*buf && (*buf < '0' || *buf > '9')) buf++;
    int x = 0;
    while (*buf >= '0' && *buf <= '9') x = x * 10 + (*buf++ - '0');
    return x;
}

int main(void) {
    /* 入力をまとめて読む */
    size_t cap = 1 << 16, len = 0, r;
    char *all = malloc(cap);
    while ((r = fread(all + len, 1, cap - len - 1, stdin)) > 0) {
        len += r;
        if (len + 1 == cap) all = realloc(all, cap *= 2);
    }
    all[len] = '\0';
    buf = all;

    int n = read_int(), m = read_int();
    int *us = malloc(sizeof(int) * (m + 1)), *vs = malloc(sizeof(int) * (m + 1));
    int *indeg = calloc(n + 1, sizeof(int));
    int *start = calloc(n + 2, sizeof(int)); /* CSR: u の出辺は adj[start[u] .. start[u+1]) */
    for (int i = 0; i < m; i++) {
        us[i] = read_int();
        vs[i] = read_int();
        start[us[i] + 1]++;
        indeg[vs[i]]++; /* 重複した辺もそのまま数える */
    }
    for (int u = 1; u <= n + 1; u++) start[u] += start[u - 1];
    int *fill = malloc(sizeof(int) * (n + 2));
    for (int u = 0; u <= n + 1; u++) fill[u] = start[u];
    int *adj = malloc(sizeof(int) * (m + 1));
    for (int i = 0; i < m; i++) adj[fill[us[i]]++] = vs[i];

    /* 段ごとの Kahn 法。queue[lo..hi) が今の学期の科目 */
    int *queue = malloc(sizeof(int) * n);
    int *counts = malloc(sizeof(int) * n);
    int tail = 0, s = 0;
    for (int v = 1; v <= n; v++)
        if (indeg[v] == 0) queue[tail++] = v;
    int lo = 0;
    while (lo < tail) {
        int hi = tail;
        counts[s++] = hi - lo;
        for (; lo < hi; lo++) {
            int u = queue[lo];
            for (int e = start[u]; e < start[u + 1]; e++)
                if (--indeg[adj[e]] == 0) queue[tail++] = adj[e];
        }
    }
    if (tail < n) {
        puts("-1");
        return 0;
    }
    /* 出力もまとめて書く（最大 2×10^5 文字程度） */
    char *ob = malloc((size_t)s * 8 + 32), *op = ob;
    op += sprintf(op, "%d\n", s);
    for (int i = 0; i < s; i++) op += sprintf(op, i ? " %d" : "%d", counts[i]);
    *op++ = '\n';
    fwrite(ob, 1, op - ob, stdout);
    return 0;
}
