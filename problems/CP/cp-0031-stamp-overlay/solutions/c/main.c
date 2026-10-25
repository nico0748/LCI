#include <stdio.h>

static char canvas[50][51];

int main(void) {
    int H, W, N;
    if (scanf("%d %d %d", &H, &W, &N) != 3) return 1;
    for (int y = 0; y < H; y++) {
        for (int x = 0; x < W; x++) canvas[y][x] = '.';
        canvas[y][W] = '\0';
    }
    char row[64];
    for (int k = 0; k < N; k++) {
        int h, w, r, c;
        if (scanf("%d %d %d %d", &h, &w, &r, &c) != 4) return 1;
        for (int i = 0; i < h; i++) {
            if (scanf("%63s", row) != 1) return 1; /* 絵柄の行は空白を含まない */
            int y = r - 1 + i;
            if (y < 0 || y >= H) continue; /* 範囲外に書くとエラーにならず他のメモリを壊すので必ず弾く */
            for (int j = 0; j < w; j++) {
                int x = c - 1 + j;
                if (row[j] != '.' && x >= 0 && x < W) canvas[y][x] = row[j];
            }
        }
    }
    for (int y = 0; y < H; y++) puts(canvas[y]);
    return 0;
}
