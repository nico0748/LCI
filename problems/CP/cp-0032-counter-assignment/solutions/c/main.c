#include <stdio.h>

int main(void) {
    int n, m;
    if (scanf("%d %d", &n, &m) != 2) return 1;
    long long free_at[10] = {0}; /* 窓口 k が空く時刻。最大で約 2×10^13 なので 64bit */
    for (int i = 0; i < n; i++) {
        long long a, d;
        if (scanf("%lld %lld", &a, &d) != 2) return 1;
        long long s = free_at[0];
        for (int k = 1; k < m; k++)
            if (free_at[k] < s) s = free_at[k];
        if (a > s) s = a; /* 案内時刻 = max(到着, 最も早く空く時刻) */
        int k = 0;
        while (free_at[k] > s) k++; /* 時刻 s に空いている窓口のうち番号最小（free == s も空き） */
        free_at[k] = s + d;
        printf("%d %lld\n", k + 1, s - a);
    }
    return 0;
}
