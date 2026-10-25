#include <stdio.h>
#include <stdlib.h>

#define MOD 1000000007LL

static char *buf;
static long long read_ll(void) {
    while (*buf && (*buf < '0' || *buf > '9')) buf++;
    long long x = 0;
    while (*buf >= '0' && *buf <= '9') x = x * 10 + (*buf++ - '0');
    return x;
}

int main(void) {
    size_t cap = 1 << 16, len = 0, r;
    char *all = malloc(cap);
    while ((r = fread(all + len, 1, cap - len - 1, stdin)) > 0) {
        len += r;
        if (len + 1 == cap) all = realloc(all, cap *= 2);
    }
    all[len] = '\0';
    buf = all;

    int n = (int)read_ll();
    long long k = read_ll(); /* 10^18 は long long に収まる */
    int *t = malloc(sizeof(int) * (n + 1));
    long long *a = malloc(sizeof(long long) * (n + 1));
    for (int i = 1; i <= n; i++) t[i] = (int)read_ll();
    for (int i = 1; i <= n; i++) a[i] = read_ll();

    int *first = malloc(sizeof(int) * (n + 1));
    int *order = malloc(sizeof(int) * (n + 1));
    long long *pre = malloc(sizeof(long long) * (n + 2));
    for (int i = 0; i <= n; i++) first[i] = -1;
    int cnt = 0, x = 1;
    pre[0] = 0;
    while (first[x] < 0) {
        first[x] = cnt;
        order[cnt] = x;
        pre[cnt + 1] = pre[cnt] + a[x]; /* 最大 2×10^14 */
        cnt++;
        x = t[x];
    }
    long long mu = first[x], lam = cnt - mu; /* 尾の長さと周期の長さ */
    if (k <= cnt) {
        printf("%d %lld\n", t[order[k - 1]], pre[k] % MOD);
        return 0;
    }
    long long q = (k - mu) / lam, rr = (k - mu) % lam;
    long long cyc = (pre[mu + lam] - pre[mu]) % MOD;
    long long total = (pre[mu + rr] % MOD + q % MOD * cyc) % MOD; /* mod してから掛ける（積は約 10^18） */
    printf("%d %lld\n", order[mu + rr], total);
    return 0;
}
