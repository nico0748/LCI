#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int h, w;
    if (scanf("%d %d", &h, &w) != 2) return 1;
    int w2 = w + 2;
    /* 周りを '#' で 1 周囲んだ 1 次元の盤（範囲チェックが要らない）。上下左右は ±1, ±w2 */
    char *g = malloc((size_t)(h + 2) * w2 + 1);
    char *row = malloc(w + 2);
    for (int i = 0; i < (h + 2) * w2; i++) g[i] = '#';
    for (int r = 1; r <= h; r++) {
        if (scanf("%s", row) != 1) return 1;
        for (int c = 0; c < w; c++) g[r * w2 + c + 1] = row[c];
    }
    /* 再帰ではなくヒープに取った明示的なスタック（深さ 10^6 でもスタック 8MB を使わない） */
    int *stack = malloc(sizeof(int) * ((size_t)h * w + 1));
    int count = 0, best = 0;
    for (int v = w2; v < (h + 1) * w2; v++) {
        if (g[v] != '.') continue;
        count++;
        g[v] = '#'; /* 訪問済みの印は積むときに付ける */
        int top = 0, area = 0;
        stack[top++] = v;
        while (top > 0) {
            int x = stack[--top];
            area++;
            int nb[4] = {x - 1, x + 1, x - w2, x + w2};
            for (int j = 0; j < 4; j++)
                if (g[nb[j]] == '.') {
                    g[nb[j]] = '#';
                    stack[top++] = nb[j];
                }
        }
        if (area > best) best = area;
    }
    printf("%d %d\n", count, best);
    free(g);
    free(row);
    free(stack);
    return 0;
}
