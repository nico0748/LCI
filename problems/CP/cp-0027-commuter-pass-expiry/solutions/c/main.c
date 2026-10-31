#include <stdio.h>

static int is_leap(int y) { return y % 4 == 0 && (y % 100 != 0 || y % 400 == 0); }

static int days_in(int y, int m) {
    if (m == 2) return is_leap(y) ? 29 : 28;
    return (m == 4 || m == 6 || m == 9 || m == 11) ? 30 : 31;
}

int main(void) {
    int q;
    if (scanf("%d", &q) != 1) return 1;
    for (int i = 0; i < q; i++) {
        int y, m, d, k;
        if (scanf("%d/%d/%d %d", &y, &m, &d, &k) != 4) return 1;
        int idx = y * 12 + (m - 1) + k; /* 月の通し番号（0 始まり）で k か月進める */
        int ty = idx / 12, tm = idx % 12 + 1;
        int last = days_in(ty, tm);
        int ey, em, ed;
        if (d > last) { /* 同じ日が無い → その月の末日 */
            ey = ty, em = tm, ed = last;
        } else if (d > 1) { /* 同じ日の前日 */
            ey = ty, em = tm, ed = d - 1;
        } else { /* 1 日の前日は前の月の末日 */
            ey = tm > 1 ? ty : ty - 1;
            em = tm > 1 ? tm - 1 : 12;
            ed = days_in(ey, em);
        }
        printf("%04d/%02d/%02d\n", ey, em, ed);
    }
    return 0;
}
