#include <stdio.h>
#include <stdlib.h>

static char *buf;
static long long read_ll(void) {
    while (*buf && (*buf < '0' || *buf > '9')) buf++;
    long long x = 0;
    while (*buf >= '0' && *buf <= '9') x = x * 10 + (*buf++ - '0');
    return x;
}

int main(void) {
    size_t cap = 1 << 16, len = 0, r;
    char *all = malloc(cap);
    while ((r = fread(all + len, 1, cap - len - 1, stdin)) > 0) {
        len += r;
        if (len + 1 == cap) all = realloc(all, cap *= 2);
    }
    all[len] = '\0';
    buf = all;

    int n = (int)read_ll();
    long long b = read_ll(); /* 最大 10^15 なので long long */
    long long *a = malloc(sizeof(long long) * n);
    for (int i = 0; i < n; i++) a[i] = read_ll();
    int best_len = 0, best_l = 0, l = 0;
    long long s = 0;
    for (int rr = 0; rr < n; rr++) {
        s += a[rr];
        while (s > b) s -= a[l++]; /* 費用は 0 以上なので、左端を進めれば合計は減る */
        if (rr - l + 1 > best_len) { /* 同じ長さなら早い開始日を残す */
            best_len = rr - l + 1;
            best_l = l + 1;
        }
    }
    if (best_len) printf("%d %d\n", best_len, best_l);
    else printf("0\n");
    return 0;
}
