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

/* a - b は int の範囲を超えうるので、比較の結果だけを返す */
static int cmp(const void *a, const void *b) {
    int x = *(const int *)a, y = *(const int *)b;
    return (x > y) - (x < y);
}

int main(void) {
    char *p = read_all();
    int n = (int)strtol(p, &p, 10);
    int q = (int)strtol(p, &p, 10);
    int *xs = malloc(sizeof(int) * n);
    for (int i = 0; i < n; i++) xs[i] = (int)strtol(p, &p, 10);
    qsort(xs, n, sizeof(int), cmp);
    char *out = malloc((size_t)q * 12 + 1), *o = out;
    for (int j = 0; j < q; j++) {
        int h = (int)strtol(p, &p, 10);
        /* lower_bound: xs[lo] は h 以上で最小の駅（lo == n なら無い） */
        int lo = 0, hi = n;
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (xs[mid] < h) lo = mid + 1;
            else hi = mid;
        }
        int best;
        if (lo == 0) best = xs[0] - h;
        else if (lo == n) best = h - xs[n - 1];
        else best = xs[lo] - h < h - xs[lo - 1] ? xs[lo] - h : h - xs[lo - 1];
        o += sprintf(o, "%d\n", best);
    }
    fwrite(out, 1, (size_t)(o - out), stdout);
    return 0;
}
