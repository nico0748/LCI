#include <stdio.h>
#include <stdlib.h>

/* 標準入力をまとめて読む（NUL 終端） */
static char *read_all(void) {
    size_t cap = 1 << 16, n = 0, r;
    char *buf = malloc(cap);
    while ((r = fread(buf + n, 1, cap - n - 1, stdin)) > 0) {
        n += r;
        if (n + 1 == cap) {
            cap *= 2;
            buf = realloc(buf, cap);
        }
    }
    buf[n] = '\0';
    return buf;
}

int main(void) {
    char *p = read_all();
    int n = (int)strtol(p, &p, 10);
    int q = (int)strtol(p, &p, 10);
    /* 累積和を 2 本: ps[i] = 1..i 日目の営業日の売上合計（long long）、pc[i] = 営業日数 */
    long long *ps = malloc(sizeof(long long) * (n + 1));
    int *pc = malloc(sizeof(int) * (n + 1));
    ps[0] = 0;
    pc[0] = 0;
    for (int i = 0; i < n; i++) {
        long long a = strtoll(p, &p, 10);
        /* 休業日（-1）は足さない。売上 0 円の営業日は日数に数える */
        ps[i + 1] = ps[i] + (a >= 0 ? a : 0);
        pc[i + 1] = pc[i] + (a >= 0 ? 1 : 0);
    }
    char *out = malloc((size_t)q * 32 + 1), *o = out;
    for (int j = 0; j < q; j++) {
        int l = (int)strtol(p, &p, 10);
        int r = (int)strtol(p, &p, 10);
        /* 両端を含む L..R は「R までの和 − (L−1) までの和」 */
        o += sprintf(o, "%lld %d\n", ps[r] - ps[l - 1], pc[r] - pc[l - 1]);
    }
    fwrite(out, 1, (size_t)(o - out), stdout);
    return 0;
}
