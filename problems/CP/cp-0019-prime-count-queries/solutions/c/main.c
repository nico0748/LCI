#include <stdio.h>
#include <stdlib.h>

#define N 1000000
static char composite[N + 1]; /* 1 なら合成数（0 と 1 も素数でないので 1） */
static int pre[N + 1];        /* pre[x] = 1..x の素数の個数 */

int main(void) {
    composite[0] = composite[1] = 1;
    for (int i = 2; i * i <= N; i++)
        if (!composite[i])
            for (int j = i * i; j <= N; j += i) composite[j] = 1;
    for (int x = 1; x <= N; x++) pre[x] = pre[x - 1] + !composite[x];
    int q;
    if (scanf("%d", &q) != 1) return 1;
    for (int i = 0; i < q; i++) {
        int l, r;
        if (scanf("%d %d", &l, &r) != 2) return 1;
        printf("%d\n", pre[r] - pre[l - 1]); /* 両端を含む */
    }
    return 0;
}
