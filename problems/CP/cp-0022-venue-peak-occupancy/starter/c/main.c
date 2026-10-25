#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* 標準入力をまとめて読む（NUL 終端。*len に長さ）。scanf を何度も呼ぶより速い */
static char *read_all(size_t *len) {
    size_t cap = 1 << 16, n = 0, r;
    char *buf = malloc(cap);
    while ((r = fread(buf + n, 1, cap - n - 1, stdin)) > 0) {
        n += r;
        if (n + 1 == cap) {
            cap *= 2;
            buf = realloc(buf, cap);
        }
    }
    buf[n] = '\0';
    *len = n;
    return buf;
}

int main(void) {
    size_t len;
    char *input = read_all(&len);
    /* 例: char *p = input; long long n = strtoll(p, &p, 10);  （空白を含む行は strchr(p, '\n') で区切る） */
    /* TODO: 入力を解析して答えを求め、printf で出力する（最後に改行を付ける。和は long long） */
    free(input);
    return 0;
}
