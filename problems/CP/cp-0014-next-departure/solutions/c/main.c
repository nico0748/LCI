#include <stdio.h>

int main(void) {
    int n, q, deps[100];
    if (scanf("%d", &n) != 1) return 1;
    int first = 1440;
    for (int i = 0; i < n; i++) {
        int h, m;
        if (scanf("%d:%d", &h, &m) != 2) return 1;
        deps[i] = h * 60 + m; /* 分に直す */
        if (deps[i] < first) first = deps[i]; /* 時刻表は時刻順とは限らないので最小を覚える（翌日の始発） */
    }
    if (scanf("%d", &q) != 1) return 1;
    for (int j = 0; j < q; j++) {
        int h, m;
        if (scanf("%d:%d", &h, &m) != 2) return 1;
        int u = h * 60 + m, dep = -1;
        for (int i = 0; i < n; i++)
            if (deps[i] >= u && (dep == -1 || deps[i] < dep)) dep = deps[i]; /* ちょうどの時刻の便にも乗れる */
        int wait;
        if (dep == -1) {
            dep = first;
            wait = first + 1440 - u;
        } else {
            wait = dep - u;
        }
        printf("%02d:%02d %d\n", dep / 60, dep % 60, wait);
    }
    return 0;
}
