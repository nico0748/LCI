/* cp-0038 の素朴解（C でも TLE させる想定）: K 回の移動をそのままシミュレーションする O(K)。
   hidden-max-* は K ≈ 10^18 なので、C でも終わらない。 */
#include <stdio.h>
#include <stdlib.h>

#define MOD 1000000007LL

int main(void) {
    int n;
    long long k;
    if (scanf("%d %lld", &n, &k) != 2) return 1;
    int *t = malloc(sizeof(int) * (n + 1));
    long long *a = malloc(sizeof(long long) * (n + 1));
    for (int i = 1; i <= n; i++)
        if (scanf("%d", &t[i]) != 1) return 1;
    for (int i = 1; i <= n; i++)
        if (scanf("%lld", &a[i]) != 1) return 1;
    int x = 1;
    long long total = 0;
    for (long long s = 0; s < k; s++) {
        total = (total + a[x]) % MOD;
        x = t[x];
    }
    printf("%d %lld\n", x, total);
    free(t);
    free(a);
    return 0;
}
