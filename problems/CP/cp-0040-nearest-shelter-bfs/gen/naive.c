/* cp-0040 の素朴解（C でも TLE させる想定）: 避難所ごとに BFS をやり直し、各マスの距離の最小を取る O(S × HW)。
   hidden-max-many-shelters は避難所 S ≈ 10^4、HW = 10^6 なので約 10^10 回になり、-O2 でも間に合わない。 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(void) {
    int h, w;
    if (scanf("%d %d", &h, &w) != 2) return 1;
    char *g = malloc((size_t)h * w + 1);
    char *line = malloc(w + 2);
    for (int i = 0; i < h; i++) {
        if (scanf("%s", line) != 1) return 1;
        memcpy(g + (size_t)i * w, line, w);
    }
    int n = h * w;
    int *best = malloc(sizeof(int) * n);
    int *dist = malloc(sizeof(int) * n);
    int *q = malloc(sizeof(int) * n);
    for (int i = 0; i < n; i++) best[i] = -1;
    int shelters = 0;
    for (int s = 0; s < n; s++) {
        if (g[s] != 'S') continue;
        shelters++;
        for (int i = 0; i < n; i++) dist[i] = -1;
        int head = 0, tail = 0;
        dist[s] = 0;
        q[tail++] = s;
        while (head < tail) {
            int p = q[head++];
            int d = dist[p];
            if (best[p] < 0 || d < best[p]) best[p] = d;
            int y = p / w, x = p % w;
            int nb[4] = {y > 0 ? p - w : -1, y < h - 1 ? p + w : -1, x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1};
            for (int k = 0; k < 4; k++) {
                int r = nb[k];
                if (r >= 0 && g[r] != '#' && dist[r] < 0) {
                    dist[r] = d + 1;
                    q[tail++] = r;
                }
            }
        }
    }
    int far = 0, unreachable = 0, dots = 0;
    for (int i = 0; i < n; i++) {
        if (g[i] != '.') continue;
        dots++;
        if (best[i] < 0) unreachable++;
        else if (best[i] > far) far = best[i];
    }
    if (!shelters) printf("-1 %d\n", dots);
    else printf("%d %d\n", far, unreachable);
    return 0;
}
