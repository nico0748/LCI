#include <stdio.h>
#include <string.h>

static void chomp(char *s) {
    size_t m = strlen(s);
    while (m > 0 && (s[m - 1] == '\n' || s[m - 1] == '\r')) s[--m] = '\0';
}

int main(void) {
    char line[1100], words[10][16], s[1100], mark[1100] = {0};
    if (!fgets(line, sizeof line, stdin)) return 1;
    int n = 0;
    sscanf(line, "%d", &n);
    for (int i = 0; i < n; i++) {
        if (!fgets(words[i], sizeof words[i], stdin)) return 1;
        chomp(words[i]);
    }
    /* 本文は空白を含むので scanf("%s") ではなく fgets で 1 行読む */
    if (!fgets(s, sizeof s, stdin)) return 1;
    chomp(s);
    int len = (int)strlen(s);
    /* 原文の上で一致を探して印だけ付ける（置き換えた文字列で次の語を探さない。重なった一致も拾う） */
    for (int t = 0; t < n; t++) {
        int m = (int)strlen(words[t]);
        for (int i = 0; i + m <= len; i++) {
            if (memcmp(s + i, words[t], m) == 0) memset(mark + i, 1, m);
        }
    }
    for (int i = 0; i < len; i++)
        if (mark[i]) s[i] = '*';
    puts(s);
    return 0;
}
