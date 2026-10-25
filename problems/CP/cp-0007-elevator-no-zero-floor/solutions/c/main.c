#include <stdio.h>
#include <stdlib.h>

/* 0 階が無いので、地下は 1 つずらして詰める: B1→0, B2→-1, B3→-2（地上はそのまま） */
static int level(const char *s) {
    return s[0] == 'B' ? 1 - atoi(s + 1) : atoi(s);
}

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 1;
    int total = 0, prev = 0;
    for (int i = 0; i < n; i++) {
        char s[8];
        if (scanf("%7s", s) != 1) return 1;
        int cur = level(s);
        if (i > 0) total += abs(cur - prev);
        prev = cur;
    }
    printf("%d\n", total);
    return 0;
}
