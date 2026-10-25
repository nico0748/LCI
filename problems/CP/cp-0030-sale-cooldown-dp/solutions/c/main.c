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

/* dp[i] = 店 1..i だけを使ったときの割引の最大（最大 2×10^14 なので long long） */
static long long dp[200001];

int main(void) {
    read_all();
    int n = (int)next_ll();
    long long d = next_ll(); /* D は最大 10^9 */
    for (int i = 1; i <= n; i++) {
        long long a = next_ll();
        long long j = i - d; /* 店 i で買うなら、直前に買えるのは店 i−D 以前 */
        long long take = a + (j >= 0 ? dp[j] : 0);
        dp[i] = take > dp[i - 1] ? take : dp[i - 1];
    }
    printf("%lld\n", dp[n]);
    return 0;
}
