#include <stdio.h>
#include <stdlib.h>

static char *buf;
static size_t len, pos;

static void read_all(void) {
    size_t cap = 1 << 16, r;
    buf = malloc(cap);
    while ((r = fread(buf + len, 1, cap - len, stdin)) > 0) {
        len += r;
        if (len == cap) buf = realloc(buf, cap *= 2);
    }
}

static long long next_ll(void) {
    while (pos < len && (buf[pos] < '0' || buf[pos] > '9')) pos++;
    long long x = 0;
    while (pos < len && buf[pos] >= '0' && buf[pos] <= '9') x = x * 10 + (buf[pos++] - '0');
    return x;
}

typedef struct {
    long long t, d;
} Event;

/* 時刻の昇順、同じ時刻は終了（負の増減）を先に。引き算は溢れうるので比較で返す */
static int cmp(const void *a, const void *b) {
    const Event *x = a, *y = b;
    if (x->t != y->t) return x->t < y->t ? -1 : 1;
    return (x->d > y->d) - (x->d < y->d);
}

int main(void) {
    read_all();
    int n = (int)next_ll();
    Event *ev = malloc(sizeof(Event) * 2 * n);
    for (int i = 0; i < n; i++) {
        long long s = next_ll(), e = next_ll(), c = next_ll();
        ev[2 * i] = (Event){s, c};
        ev[2 * i + 1] = (Event){e, -c};
    }
    qsort(ev, 2 * n, sizeof(Event), cmp);
    long long cur = 0, best = -1, at = -1; /* 合計は最大 10^14 なので long long */
    for (int i = 0; i < 2 * n; i++) {
        cur += ev[i].d;
        if (cur > best) {
            best = cur;
            at = ev[i].t;
        }
    }
    printf("%lld %lld\n", best, at);
    return 0;
}
