#include <stdio.h>
#include <string.h>

int main(void) {
    int n, k, m;
    int dice[100], warp[101];
    if (scanf("%d %d", &n, &k) != 2) return 1;
    for (int i = 0; i < k; i++)
        if (scanf("%d", &dice[i]) != 1) return 1;
    if (scanf("%d", &m) != 1) return 1;
    memset(warp, -1, sizeof warp); /* 入口 → 出口（-1 はワープなし） */
    for (int j = 0; j < m; j++) {
        int s, t;
        if (scanf("%d %d", &s, &t) != 2) return 1;
        warp[s] = t;
    }
    int pos = 0;
    for (int t = 0; t < k; t++) {
        pos += dice[t];
        if (pos > n) pos = n - (pos - n); /* 越えた分だけ戻る */
        if (pos == n) {                   /* ちょうど止まったときだけゴール。残りの出目は使わない */
            printf("GOAL %d\n", t + 1);
            return 0;
        }
        if (warp[pos] >= 0) pos = warp[pos]; /* 1 回だけ（出口のワープは使わない） */
    }
    printf("%d\n", pos);
    return 0;
}
