/* cp-0039 の素朴解（C でも TLE させる想定）: すべての組 i < j について (A_i + A_j) % M を調べる O(N^2)。
   N = 2×10^5 では 2×10^10 回の 64bit 剰余になり、-O2 でも 2 秒×1.5 を大きく超える。 */
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int n;
    long long m;
    if (scanf("%d %lld", &n, &m) != 2) return 1;
    long long *a = malloc(sizeof(long long) * n);
    for (int i = 0; i < n; i++)
        if (scanf("%lld", &a[i]) != 1) return 1;
    long long ans = 0;
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j < n; j++)
            if ((a[i] + a[j]) % m == 0) ans++;
    printf("%lld\n", ans);
    free(a);
    return 0;
}
