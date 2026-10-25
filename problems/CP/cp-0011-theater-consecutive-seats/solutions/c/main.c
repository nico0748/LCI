#include <stdio.h>

int main(void) {
    int h, w, k;
    if (scanf("%d %d %d", &h, &w, &k) != 3) return 1;
    char row[128];
    for (int r = 0; r < h; r++) {
        if (scanf("%127s", row) != 1) return 1;
        int run = 0; /* この列で、いま続いている空席の数（列が変わったら 0 から数え直す） */
        for (int c = 0; c < w; c++) {
            if (row[c] == '.') {
                if (++run == k) {
                    printf("%d %d\n", r + 1, c - k + 2); /* 左端は c-k+1（0 始まり）→ 1 始まり */
                    return 0;
                }
            } else {
                run = 0;
            }
        }
    }
    puts("-1");
    return 0;
}
