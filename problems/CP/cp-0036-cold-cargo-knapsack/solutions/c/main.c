#include <stdio.h>

/* dp[k][w] = 冷蔵品 k 個以下・重さ w 以下での報酬の最大（最大約 10^11 なので long long） */
static long long dp[6][2001];

int main(void) {
    int n, W, C;
    if (scanf("%d %d %d", &n, &W, &C) != 3) return 1;
    for (int i = 0; i < n; i++) {
        int w, f;
        long long v;
        if (scanf("%d %lld %d", &w, &v, &f) != 3) return 1;
        if (w > W) continue;
        /* k も重さも大きい方から更新する。右辺はこの荷物を使う前の値なので 0/1 が守られる */
        for (int k = C; k >= f; k--)
            for (int x = W; x >= w; x--)
                if (dp[k - f][x - w] + v > dp[k][x]) dp[k][x] = dp[k - f][x - w] + v;
    }
    printf("%lld\n", dp[C][W]);
    return 0;
}
