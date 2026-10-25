#include <stdio.h>
#include <stdlib.h>

static char *buf;
static int read_int(void) {
    while (*buf && (*buf < '0' || *buf > '9')) buf++;
    int x = 0;
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

    int k = read_int();
    int n = 1 << k;
    int *s = malloc(sizeof(int) * (n + 1));
    int *line = calloc(n, sizeof(int)); /* 今の回戦に残っている選手番号（表の左から） */
    int *wins = calloc(n + 1, sizeof(int));
    for (int i = 1; i <= n; i++) s[i] = read_int();
    for (int i = 0; i < n; i++) line[i] = read_int();
    for (int cnt = n; cnt > 1; cnt /= 2) {
        for (int i = 0; i < cnt; i += 2) {
            int a = line[i], b = line[i + 1];
            int w = (s[a] > s[b] || (s[a] == s[b] && a < b)) ? a : b; /* 同じ強さなら番号が小さい方 */
            wins[w]++;
            line[i / 2] = w; /* 前から詰めて上書きしても、まだ読んでいない位置は壊さない */
        }
    }
    char *ob = malloc((size_t)n * 3 + 32), *op = ob;
    op += sprintf(op, "%d\n", line[0]);
    for (int i = 1; i <= n; i++) op += sprintf(op, i > 1 ? " %d" : "%d", wins[i]);
    *op++ = '\n';
    fwrite(ob, 1, op - ob, stdout);
    return 0;
}
