#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int h, w;
    if (scanf("%d %d", &h, &w) != 2) return 1;
    int w2 = w + 2; /* 周りを壁で囲んだ 1 次元の盤面にして、範囲チェックを省く */
    size_t cells = (size_t)w2 * (h + 2);
    unsigned char *free_cell = calloc(cells, 1); /* 1 = まだ訪れていない道のマス */
    int *dist = calloc(cells, sizeof(int));
    int *queue = malloc(sizeof(int) * (size_t)h * w);
    char *row = malloc(w + 2);
    int tail = 0, dots = 0;
    for (int i = 0; i < h; i++) {
        if (scanf("%s", row) != 1) return 1; /* バッファは W + 1 文字以上 */
        int base = (i + 1) * w2 + 1;
        for (int j = 0; j < w; j++) {
            if (row[j] == '.') {
                free_cell[base + j] = 1;
                dots++;
            } else if (row[j] == 'S') {
                queue[tail++] = base + j; /* 避難所は距離 0 として最初からキューへ */
            }
        }
    }
    if (tail == 0) {
        printf("-1 %d\n", dots);
        return 0;
    }
    int shelters = tail, head = 0, far = 0;
    int step[4] = {-1, 1, -w2, w2};
    while (head < tail) {
        int p = queue[head++];
        int d = dist[p] + 1;
        for (int k = 0; k < 4; k++) {
            int q = p + step[k];
            if (free_cell[q]) {
                free_cell[q] = 0;
                dist[q] = d;
                if (d > far) far = d;
                queue[tail++] = q;
            }
        }
    }
    printf("%d %d\n", far, dots - (tail - shelters));
    return 0;
}
