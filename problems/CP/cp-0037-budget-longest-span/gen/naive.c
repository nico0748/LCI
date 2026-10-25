/* cp-0037 の素朴解（C でも TLE させる想定）: 開始日ごとに予算を超えるまで右へ足す O(N^2)。
   hidden-max-all-fit では N^2/2 = 2×10^10 回の加算になり、-O2 でも 2 秒×1.5 を大きく超える。 */
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int n;
    long long b;
    if (scanf("%d %lld", &n, &b) != 2) return 0;
    long long *a = malloc(sizeof(long long) * n);
    for (int i = 0; i < n; i++)
        if (scanf("%lld", &a[i]) != 1) return 1;
    int best_len = 0, best_l = 0;
    for (int l = 0; l < n; l++) {
        long long s = 0;
        for (int r = l; r < n; r++) {
            s += a[r];
            if (s > b) break;
            if (r - l + 1 > best_len) {
                best_len = r - l + 1;
                best_l = l + 1;
            }
        }
    }
    if (best_len) printf("%d %d\n", best_len, best_l);
    else printf("0\n");
    free(a);
    return 0;
}
