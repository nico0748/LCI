/* cp-0019 の素朴解（C）。篩までは作るが累積和を作らず、クエリごとに L〜R を数え直す: O(Q·(R-L+1))。
 * hidden-max-wide は 10^5 クエリ × 約 10^6 = 10^11 回で、C でも制限を大きく超えることを確かめる（--naive）。 */
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int q;
    if (scanf("%d", &q) != 1) return 1;
    int *lo = malloc(sizeof(int) * q), *hi = malloc(sizeof(int) * q), n = 1;
    for (int k = 0; k < q; k++) {
        if (scanf("%d %d", &lo[k], &hi[k]) != 2) return 1;
        if (hi[k] > n) n = hi[k];
    }
    char *is_p = malloc(n + 1);
    for (int x = 0; x <= n; x++) is_p[x] = x >= 2;
    for (long long i = 2; i * i <= n; i++)
        if (is_p[i])
            for (long long j = i * i; j <= n; j += i) is_p[j] = 0;
    for (int k = 0; k < q; k++) {
        int cnt = 0;
        for (int x = lo[k]; x <= hi[k]; x++) cnt += is_p[x];
        printf("%d\n", cnt);
    }
    return 0;
}
