#include <stdio.h>
#include <stdlib.h>

/* 標準入力をまとめて読む（NUL 終端） */
static char *read_all(void) {
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
    return buf;
}

static int *parent, *size;

/* 根を返す。経路半減で木を浅く保つ（反復なので深さを気にしなくてよい） */
static int find(int x) {
    while (parent[x] != x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
    }
    return x;
}

int main(void) {
    char *p = read_all();
    int n = (int)strtol(p, &p, 10);
    int q = (int)strtol(p, &p, 10);
    parent = malloc(sizeof(int) * (n + 1));
    size = malloc(sizeof(int) * (n + 1));
    for (int i = 0; i <= n; i++) {
        parent[i] = i;
        size[i] = 1;
    }
    char *out = malloc((size_t)q * 8 + 1), *o = out;
    for (int j = 0; j < q; j++) {
        int t = (int)strtol(p, &p, 10);
        if (t == 2) {
            o += sprintf(o, "%d\n", size[find((int)strtol(p, &p, 10))]);
            continue;
        }
        int a = find((int)strtol(p, &p, 10));
        int b = find((int)strtol(p, &p, 10));
        if (t == 1) {
            if (a != b) { /* 既に同じ組なら何もしない。小さい組を大きい組の下に付ける */
                if (size[a] < size[b]) {
                    int tmp = a;
                    a = b;
                    b = tmp;
                }
                parent[b] = a;
                size[a] += size[b];
            }
        } else {
            o += sprintf(o, "%s\n", a == b ? "Yes" : "No");
        }
    }
    fwrite(out, 1, (size_t)(o - out), stdout);
    return 0;
}
