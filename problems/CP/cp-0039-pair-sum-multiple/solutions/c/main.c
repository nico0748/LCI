#include <stdio.h>
#include <stdlib.h>

static char *buf;
static long long read_ll(void) {
    while (*buf && (*buf < '0' || *buf > '9')) buf++;
    long long x = 0;
    while (*buf >= '0' && *buf <= '9') x = x * 10 + (*buf++ - '0');
    return x;
}

static int cmp(const void *x, const void *y) {
    long long a = *(const long long *)x, b = *(const long long *)y;
    return (a > b) - (a < b);
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
    long long m = read_ll();
    /* M は最大 10^9 なので大きさ M の配列は取れない。余りをソートして同じ余りの塊を数える */
    long long *res = malloc(sizeof(long long) * n);
    for (int i = 0; i < n; i++) res[i] = read_ll() % m;
    qsort(res, n, sizeof(long long), cmp);
    /* 塊ごとに (余り, 個数) を作る */
    long long *val = malloc(sizeof(long long) * n), *num = malloc(sizeof(long long) * n);
    int g = 0;
    for (int i = 0; i < n; i++) {
        if (g > 0 && val[g - 1] == res[i]) num[g - 1]++;
        else {
            val[g] = res[i];
            num[g] = 1;
            g++;
        }
    }
    long long ans = 0; /* 最大約 2×10^10 */
    int lo = 0, hi = g - 1;
    /* 余り 0 と M/2 はその塊の中で c(c−1)/2、それ以外は r と M−r の塊を両端から突き合わせる */
    if (g > 0 && val[0] == 0) {
        ans += num[0] * (num[0] - 1) / 2;
        lo = 1;
    }
    while (lo <= hi) {
        long long s = val[lo] + val[hi];
        if (lo == hi) {
            if (2 * val[lo] == m) ans += num[lo] * (num[lo] - 1) / 2;
            break;
        }
        if (s == m) {
            ans += num[lo] * num[hi];
            lo++;
            hi--;
        } else if (s < m) {
            if (2 * val[lo] == m) ans += num[lo] * (num[lo] - 1) / 2;
            lo++;
        } else {
            if (2 * val[hi] == m) ans += num[hi] * (num[hi] - 1) / 2;
            hi--;
        }
    }
    printf("%lld\n", ans);
    return 0;
}
