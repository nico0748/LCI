#include <stdio.h>
#include <stdlib.h>

#define P 998244353LL

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

static long long power(long long a, long long e) {
    long long r = 1;
    a %= P;
    while (e > 0) {
        if (e & 1) r = r * a % P;
        a = a * a % P;
        e >>= 1;
    }
    return r;
}

int main(void) {
    char *p = read_all();
    int q = (int)strtol(p, &p, 10);
    int *ns = malloc(sizeof(int) * q), *rs = malloc(sizeof(int) * q);
    int m = 0;
    for (int i = 0; i < q; i++) {
        ns[i] = (int)strtol(p, &p, 10);
        rs[i] = (int)strtol(p, &p, 10);
        if (ns[i] > m) m = ns[i];
    }
    /* 階乗と、その逆元（フェルマーの小定理: a^(P−2)）を n の最大値まで前計算する。積は long long で取る */
    long long *fact = malloc(sizeof(long long) * (m + 1));
    long long *inv = malloc(sizeof(long long) * (m + 1));
    fact[0] = 1;
    for (int i = 1; i <= m; i++) fact[i] = fact[i - 1] * i % P;
    inv[m] = power(fact[m], P - 2);
    for (int i = m; i >= 1; i--) inv[i - 1] = inv[i] * i % P;
    char *out = malloc((size_t)q * 12 + 1), *o = out;
    for (int i = 0; i < q; i++) {
        int n = ns[i], r = rs[i];
        long long ans = r > n ? 0 : fact[n] * inv[r] % P * inv[n - r] % P;
        o += sprintf(o, "%lld\n", ans);
    }
    fwrite(out, 1, (size_t)(o - out), stdout);
    return 0;
}
