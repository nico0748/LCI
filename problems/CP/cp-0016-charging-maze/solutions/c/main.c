#include <stdio.h>
#include <string.h>

#define MAXS (60 * 60 * 61)
static char g[60 * 60 + 1];
static int dist[MAXS], queue[MAXS];

int main(void) {
    int h, w, b;
    if (scanf("%d %d %d", &h, &w, &b) != 3) return 1;
    for (int r = 0; r < h; r++)
        if (scanf("%60s", g + r * w) != 1) return 1; /* マス v = r*w + c */
    int start = (int)(strchr(g, 'S') - g), goal = (int)(strchr(g, 'G') - g), k = b + 1;
    /* 状態 = (マス, 残り) を v*k + e の 1 つの整数に。マスだけで訪問済みにすると充電の遠回りを捨てる */
    memset(dist, -1, sizeof(int) * h * w * k);
    int head = 0, tail = 0;
    dist[start * k + b] = 0;
    queue[tail++] = start * k + b;
    while (head < tail) {
        int s = queue[head++], v = s / k, e = s % k;
        if (e == 0) continue; /* 電池切れ: 動けない */
        int d = dist[s] + 1, r = v / w, c = v % w;
        int nbs[4] = {r > 0 ? v - w : -1, r + 1 < h ? v + w : -1, c > 0 ? v - 1 : -1, c + 1 < w ? v + 1 : -1};
        for (int j = 0; j < 4; j++) {
            int u = nbs[j];
            if (u < 0 || g[u] == '#') continue;
            if (u == goal) { /* 残り 0 で着いてもよい。BFS なので最初に着いた手数が最短 */
                printf("%d\n", d);
                return 0;
            }
            int t = u * k + (g[u] == 'C' ? b : e - 1);
            if (dist[t] == -1) {
                dist[t] = d;
                queue[tail++] = t;
            }
        }
    }
    puts("-1");
    return 0;
}
