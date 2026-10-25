#include <stdio.h>
#include <string.h>

static char key[1010], s[200010];

static void chomp(char *t) {
    size_t m = strlen(t);
    while (m > 0 && (t[m - 1] == '\n' || t[m - 1] == '\r')) t[--m] = '\0';
}

int main(void) {
    /* 暗号文には空白が続くことがあるので、fgets で 1 行ずつ読む */
    if (!fgets(key, sizeof key, stdin) || !fgets(s, sizeof s, stdin)) return 1;
    chomp(key);
    chomp(s);
    int m = (int)strlen(key);
    int j = 0; /* 鍵の位置。英字を 1 文字戻したときだけ進める */
    for (int i = 0; s[i]; i++) {
        int c = (unsigned char)s[i];
        int k = key[j % m] - 'a';
        /* C の % は負の数に負を返すので、+26 してから取る */
        if (c >= 'a' && c <= 'z') {
            s[i] = (char)((c - 'a' - k + 26) % 26 + 'a');
            j++;
        } else if (c >= 'A' && c <= 'Z') {
            s[i] = (char)((c - 'A' - k + 26) % 26 + 'A');
            j++;
        }
    }
    puts(s); /* その場で書き換えたので、文字列の連結は要らない */
    return 0;
}
