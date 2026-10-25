#include <stdio.h>
#include <stdlib.h>

typedef struct {
    long long s, e;
} Booking;

static int by_end(const void *pa, const void *pb) {
    const Booking *a = pa, *b = pb;
    return (a->e > b->e) - (a->e < b->e); /* 引き算で返さない（溢れの癖を付けない） */
}

int main(void) {
    int n;
    long long c;
    if (scanf("%d %lld", &n, &c) != 2) return 1;
    Booking *bk = malloc(sizeof(Booking) * n);
    for (int i = 0; i < n; i++)
        if (scanf("%lld %lld", &bk[i].s, &bk[i].e) != 2) return 1;
    qsort(bk, n, sizeof(Booking), by_end); /* 終了時刻の早い順 */
    long long free_at = 0; /* 次の予約が始まってよい最も早い時刻 = 直前の終了 + C（最大 3×10^9 なので long long） */
    int cnt = 0;
    for (int i = 0; i < n; i++)
        if (bk[i].s >= free_at) { /* ちょうど「終了 + C」に始まる予約は受けられる */
            cnt++;
            free_at = bk[i].e + c;
        }
    printf("%d\n", cnt);
    free(bk);
    return 0;
}
