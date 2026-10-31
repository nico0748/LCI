#include <stdio.h>
#include <stdlib.h>

#define DAY 86400

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

static int next_int(void) {
    while (pos < len && (buf[pos] < '0' || buf[pos] > '9')) pos++;
    int x = 0;
    while (pos < len && buf[pos] >= '0' && buf[pos] <= '9') x = x * 10 + (buf[pos++] - '0');
    return x;
}

static int diff[DAY + 1]; /* t = 86400 を書き込むので 86401 要素 */

int main(void) {
    read_all();
    int n = next_int();
    for (int i = 0; i < n; i++) {
        int s = next_int(), t = next_int();
        diff[s]++; /* [s, t) にいる */
        diff[t]--;
    }
    int cur = 0, peak = -1, first = -1, seconds = 0;
    for (int x = 0; x < DAY; x++) {
        cur += diff[x];
        if (cur > peak) {
            peak = cur;
            first = x;
            seconds = 1;
        } else if (cur == peak) {
            seconds++;
        }
    }
    printf("%d\n%d\n%d\n", peak, first, seconds);
    free(buf);
    return 0;
}
