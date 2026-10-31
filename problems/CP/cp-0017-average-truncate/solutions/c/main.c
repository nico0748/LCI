#include <stdio.h>

int main(void) {
    int n, scores[100], total = 0;
    char names[100][12];
    if (scanf("%d", &n) != 1) return 1;
    for (int i = 0; i < n; i++) {
        if (scanf("%11s %d", names[i], &scores[i]) != 2) return 1;
        total += scores[i];
    }
    /* 整数だけで: 平均×10 の切り捨て（printf の %.1f は四捨五入になるので使わない） */
    int v = total * 10 / n;
    printf("%d.%d\n", v / 10, v % 10);
    /* 「平均以上」は正確な平均と比べる: score >= total/n ⇔ score*n >= total */
    for (int i = 0; i < n; i++)
        if (scores[i] * n >= total) puts(names[i]);
    return 0;
}
