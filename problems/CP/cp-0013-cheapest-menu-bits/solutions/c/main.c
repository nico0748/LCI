#include <stdio.h>

static int cover[1 << 15];
static long long cost[1 << 15]; /* 合計は最大 1.5×10^10 なので long long */

int main(void) {
    int n, m;
    if (scanf("%d %d", &n, &m) != 2) return 1;
    long long price[15];
    int mask[15] = {0};
    for (int i = 0; i < n; i++) {
        int k;
        if (scanf("%lld %d", &price[i], &k) != 2) return 1;
        for (int j = 0; j < k; j++) {
            int a;
            if (scanf("%d", &a) != 1) return 1;
            mask[i] |= 1 << (a - 1); /* 栄養 a をビット a-1 に */
        }
    }
    int full = (1 << m) - 1;
    long long best = -1;
    int ways = 0;
    for (int s = 1; s < (1 << n); s++) {
        int low = s & -s; /* 最下位の 1 ビット = 番号が最小の料理 */
        int i = __builtin_ctz(low);
        cover[s] = cover[s ^ low] | mask[i];
        cost[s] = cost[s ^ low] + price[i];
        if (cover[s] == full) {
            if (best == -1 || cost[s] < best) {
                best = cost[s];
                ways = 1;
            } else if (cost[s] == best) {
                ways++;
            }
        }
    }
    if (best == -1) puts("-1");
    else printf("%lld %d\n", best, ways);
    return 0;
}
