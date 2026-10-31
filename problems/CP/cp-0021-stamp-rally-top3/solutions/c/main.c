#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char name[11];
    int score;
    int got; /* 押した地点のビット集合（M ≤ 20）。同じ地点は 1 回だけ数える */
} Person;

static Person people[1000];

/* 得点の降順、同点は名前の昇順（strcmp は短い方が先: an < ann） */
static int cmp(const void *a, const void *b) {
    const Person *x = a, *y = b;
    if (x->score != y->score) return y->score - x->score;
    return strcmp(x->name, y->name);
}

int main(void) {
    int n, m;
    if (scanf("%d %d", &n, &m) != 2) return 1;
    int points[21];
    for (int j = 0; j < m; j++)
        if (scanf("%d", &points[j]) != 1) return 1;
    int cnt = 0;
    for (int i = 0; i < n; i++) {
        char name[16];
        int c;
        if (scanf("%15s %d", name, &c) != 2) return 1;
        int k = 0;
        while (k < cnt && strcmp(people[k].name, name) != 0) k++; /* 人数は高々 1000 なので線形探索で十分 */
        if (k == cnt) {
            strcpy(people[cnt].name, name);
            people[cnt].score = 0;
            people[cnt].got = 0;
            cnt++;
        }
        if (people[k].got >> c & 1) continue;
        people[k].got |= 1 << c;
        people[k].score += points[c - 1];
    }
    qsort(people, cnt, sizeof(Person), cmp);
    for (int i = 0; i < cnt && i < 3; i++) printf("%s %d\n", people[i].name, people[i].score);
    return 0;
}
