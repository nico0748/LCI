/* 素朴解（TLE させる想定）: 期間ごとに L..R 日目を 1 日ずつ足す。O(N Q)。
 * hidden-max-full-range（ほぼ全期間のクエリ 5×10^4 個）では約 10^10 回になり、C でも間に合わない
 * （このコンテナで約 27 秒。05 §5 では「C の素朴解は通りうる」としていたが、この最大ケースでは落ちる）。 */
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int n, q;
    if (scanf("%d %d", &n, &q) != 2) return 1;
    long long *a = malloc(sizeof(long long) * n);
    for (int i = 0; i < n; i++)
        if (scanf("%lld", &a[i]) != 1) return 1;
    for (int j = 0; j < q; j++) {
        int l, r;
        if (scanf("%d %d", &l, &r) != 2) return 1;
        long long s = 0, c = 0;
        for (int d = l - 1; d < r; d++) {
            if (a[d] >= 0) {
                s += a[d];
                c++;
            }
        }
        printf("%lld %lld\n", s, c);
    }
    free(a);
    return 0;
}
