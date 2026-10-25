/* 素朴解（TLE させたい解）の C 版: K×K 区画ごとに K^2 マスを足し直す O((H−K+1)(W−K+1)K^2)。
 * hidden-max-k500 で 501^2 × 500^2 ≈ 6.3×10^10 回。C でも 2 秒では終わらないことを selftest --naive で確かめる */
#include <stdio.h>

static char g[1000][1001];

int main(void) {
    int h, w, k;
    if (scanf("%d %d %d", &h, &w, &k) != 3) return 1;
    for (int i = 0; i < h; i++)
        if (scanf("%1000s", g[i]) != 1) return 1;
    long long best = -1;
    int br = 0, bc = 0;
    for (int r = 0; r + k <= h; r++) {
        for (int c = 0; c + k <= w; c++) {
            long long s = 0;
            for (int dr = 0; dr < k; dr++)
                for (int dc = 0; dc < k; dc++) s += g[r + dr][c + dc] - '0';
            if (s > best) {
                best = s;
                br = r;
                bc = c;
            }
        }
    }
    printf("%lld\n%d %d\n", best, br + 1, bc + 1);
    return 0;
}
