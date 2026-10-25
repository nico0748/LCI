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

static int n;
static long long k, *w;

/* 棚幅 cap で、左から詰めて K 段以内に収まるか（cap ≥ max(w) で呼ぶ） */
static int fits(long long cap) {
    long long count = 1, cur = 0;
    for (int i = 0; i < n; i++) {
        cur += w[i];
        if (cur > cap) {
            if (++count > k) return 0;
            cur = w[i];
        }
    }
    return 1;
}

int main(void) {
    char *p = read_all();
    n = (int)strtol(p, &p, 10);
    k = strtoll(p, &p, 10);
    w = malloc(sizeof(long long) * n);
    long long lo = 0, hi = 0; /* 答えは [max(w), Σw] の中。Σw は最大 2×10^14 なので long long */
    for (int i = 0; i < n; i++) {
        w[i] = strtoll(p, &p, 10);
        if (w[i] > lo) lo = w[i];
        hi += w[i];
    }
    while (lo < hi) {
        long long mid = (lo + hi) / 2;
        if (fits(mid)) hi = mid;
        else lo = mid + 1;
    }
    printf("%lld\n", lo);
    return 0;
}
