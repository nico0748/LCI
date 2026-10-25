#include <stdio.h>
#include <string.h>

static char g[50][52], nxt[50][52];

int main(void) {
    int h, w, t;
    if (scanf("%d %d %d", &h, &w, &t) != 3) return 1;
    for (int r = 0; r < h; r++)
        if (scanf("%51s", g[r]) != 1) return 1;
    for (int day = 0; day < t; day++) {
        /* 二重バッファ: 判定は前の日の g、書き込みは nxt。最後に nxt を g へ写す */
        memcpy(nxt, g, sizeof g);
        for (int r = 0; r < h; r++) {
            for (int c = 0; c < w; c++) {
                char ch = g[r][c];
                if (ch == '#') continue;
                int m = 0; /* 上下左右の苔の数（盤の外は数えない） */
                if (r > 0 && g[r - 1][c] == 'o') m++;
                if (r + 1 < h && g[r + 1][c] == 'o') m++;
                if (c > 0 && g[r][c - 1] == 'o') m++;
                if (c + 1 < w && g[r][c + 1] == 'o') m++;
                if (ch == '.') {
                    if (m >= 2) nxt[r][c] = 'o';
                } else if (m == 0 || m == 4) {
                    nxt[r][c] = '.';
                }
            }
        }
        memcpy(g, nxt, sizeof g);
    }
    for (int r = 0; r < h; r++) puts(g[r]);
    return 0;
}
