#include <stdio.h>

/* S[i][j] = 上 i 行・左 j 列の花の合計。約 4MB なので static に置く（関数内だとスタックを溢れうる） */
static int S[1001][1001];
static char row[1002];

int main(void) {
    int h, w, k;
    if (scanf("%d %d %d", &h, &w, &k) != 3) return 1;
    for (int i = 0; i < h; i++) {
        if (scanf("%1001s", row) != 1) return 1;
        int acc = 0;
        for (int j = 0; j < w; j++) {
            acc += row[j] - '0';
            S[i + 1][j + 1] = S[i][j + 1] + acc;
        }
    }
    int best = -1, br = 0, bc = 0;
    for (int r = 0; r + k <= h; r++) {
        for (int c = 0; c + k <= w; c++) {
            int v = S[r + k][c + k] - S[r][c + k] - S[r + k][c] + S[r][c];
            if (v > best) { /* 行優先で「より大きいときだけ」更新 → 同点は上・左が残る */
                best = v;
                br = r;
                bc = c;
            }
        }
    }
    printf("%d\n%d %d\n", best, br + 1, bc + 1);
    return 0;
}
