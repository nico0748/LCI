#include <math.h>
#include <stdio.h>

static int n;
static int need[9]; /* need[b]: b より先に訪れる地点の集合（ビット） */
static double d[9][9];
static double best = INFINITY;

/* 使用済みの集合 mask（ビット 0 は営業所）を持ち、条件を満たす地点だけを次に置く再帰で順列を列挙する */
static void dfs(int last, int mask, int placed, double acc) {
    if (placed == n) {
        double total = acc + d[last][0];
        if (total < best) best = total;
        return;
    }
    for (int v = 1; v <= n; v++) {
        if (mask >> v & 1) continue;
        if (need[v] & ~mask) continue;
        dfs(v, mask | 1 << v, placed + 1, acc + d[last][v]);
    }
}

int main(void) {
    int m;
    if (scanf("%d %d", &n, &m) != 2) return 1;
    int x[9], y[9];
    for (int i = 0; i <= n; i++)
        if (scanf("%d %d", &x[i], &y[i]) != 2) return 1;
    for (int j = 0; j < m; j++) {
        int a, b;
        if (scanf("%d %d", &a, &b) != 2) return 1;
        need[b] |= 1 << a;
    }
    for (int i = 0; i <= n; i++)
        for (int j = 0; j <= n; j++) {
            double dx = x[i] - x[j], dy = y[i] - y[j];
            d[i][j] = sqrt(dx * dx + dy * dy);
        }
    dfs(0, 1, 0, 0.0);
    printf("%.10f\n", best); /* %g は有効数字 6 桁なので使わない */
    return 0;
}
