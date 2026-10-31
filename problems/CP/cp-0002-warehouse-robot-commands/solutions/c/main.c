#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static char grid[100][104];
static char seen[100][100];
static char cmds[100005];

int main(void) {
    int h, w, n;
    if (scanf("%d %d", &h, &w) != 2) return 1;
    int r = 0, c = 0;
    for (int i = 0; i < h; i++) {
        if (scanf("%103s", grid[i]) != 1) return 1;
        char *p = strchr(grid[i], 'S');
        if (p) {
            r = i;
            c = (int)(p - grid[i]);
        }
    }
    if (scanf("%d %100004s", &n, cmds) != 2) return 1;
    /* 向き 0=北 1=東 2=南 3=西。L は (d + 3) % 4（C の % は負の数に負を返すので d - 1 は使わない） */
    static const int dr[4] = {-1, 0, 1, 0};
    static const int dc[4] = {0, 1, 0, -1};
    seen[r][c] = 1; /* 出発マスも数える */
    int count = 1, d = 0;
    for (int k = 0; cmds[k]; k++) {
        if (cmds[k] == 'F') {
            int nr = r + dr[d], nc = c + dc[d];
            if (nr >= 0 && nr < h && nc >= 0 && nc < w && grid[nr][nc] != '#') {
                r = nr;
                c = nc;
                if (!seen[r][c]) {
                    seen[r][c] = 1;
                    count++;
                }
            }
        } else if (cmds[k] == 'R') {
            d = (d + 1) % 4;
        } else {
            d = (d + 3) % 4;
        }
    }
    printf("%d %d\n%d\n", r + 1, c + 1, count);
    return 0;
}
