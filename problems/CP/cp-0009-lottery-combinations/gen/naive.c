/* 素朴解（TLE させる想定）: クエリごとに n(n−1)…(n−r+1) と r! を掛け、最後に 1 回だけ逆元を取る。O(r) / クエリ。
 * C でも hidden-max-half（r ≒ 5×10^5 のクエリが 9×10^4 個 ≒ 4.5×10^10 回の剰余付き掛け算）は間に合わない。 */
#include <stdio.h>

#define P 998244353LL

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
    int q;
    if (scanf("%d", &q) != 1) return 1;
    for (int i = 0; i < q; i++) {
        long long n, r;
        if (scanf("%lld %lld", &n, &r) != 2) return 1;
        if (r > n) {
            printf("0\n");
            continue;
        }
        if (n - r < r) r = n - r;
        long long num = 1, den = 1;
        for (long long k = 0; k < r; k++) {
            num = num * ((n - k) % P) % P;
            den = den * (k + 1) % P;
        }
        printf("%lld\n", num * power(den, P - 2) % P);
    }
    return 0;
}
