/* 素朴解（TLE させる想定）: 棚幅を max(w) から 1 ずつ増やして、最初に K 段に収まった幅を答える。
 * C でも、試す幅が「答え − max(w)」個（hidden-max-k2 では約 5×10^13 個）あるので終わらない。 */
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int n, k;
    if (scanf("%d %d", &n, &k) != 2) return 1;
    long long *w = malloc(sizeof(long long) * n);
    long long mx = 0;
    for (int i = 0; i < n; i++) {
        if (scanf("%lld", &w[i]) != 1) return 1;
        if (w[i] > mx) mx = w[i];
    }
    for (long long cap = mx;; cap++) {
        long long count = 1, cur = 0;
        for (int i = 0; i < n; i++) {
            if (cur + w[i] > cap) {
                count++;
                cur = w[i];
            } else {
                cur += w[i];
            }
        }
        if (count <= k) {
            printf("%lld\n", cap);
            break;
        }
    }
    free(w);
    return 0;
}
