#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char title[24], genre[12];
    int year, r;
} Book;

static int G;

/* strcmp は文字コード順（数字 < 英大文字 < 英小文字、先頭一致は短いほうが前） */
static int cmp(const void *pa, const void *pb) {
    const Book *a = pa, *b = pb;
    if (a->r != b->r) return a->r - b->r;
    if (a->r == G) {
        int x = strcmp(a->genre, b->genre); /* 一覧に無いジャンルどうしはジャンル名順 */
        if (x) return x;
    }
    if (a->year != b->year) return b->year - a->year; /* 新しい順 */
    return strcmp(a->title, b->title);
}

int main(void) {
    char order[50][12];
    if (scanf("%d", &G) != 1) return 1;
    for (int i = 0; i < G; i++)
        if (scanf("%11s", order[i]) != 1) return 1;
    int n;
    if (scanf("%d", &n) != 1) return 1;
    Book *bk = malloc(sizeof(Book) * n);
    for (int i = 0; i < n; i++) {
        if (scanf("%23s %11s %d", bk[i].title, bk[i].genre, &bk[i].year) != 3) return 1;
        bk[i].r = G; /* 一覧に無いジャンルは順位 G */
        for (int k = 0; k < G; k++)
            if (strcmp(bk[i].genre, order[k]) == 0) {
                bk[i].r = k;
                break;
            }
    }
    qsort(bk, n, sizeof(Book), cmp);
    for (int i = 0; i < n; i++) puts(bk[i].title);
    free(bk);
    return 0;
}
