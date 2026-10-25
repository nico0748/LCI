#include <ctype.h>
#include <stdio.h>
#include <string.h>

static const char *SYMBOLS = "!#$%&*+-=?@_";

static int judge(const char *user, const char *pw) {
    int len = (int)strlen(pw);
    /* 規則 1: 長さ */
    if (len < 8 || len > 64) return 1;
    int upper = 0, lower = 0, digit = 0, symbol = 0;
    for (int i = 0; i < len; i++) {
        char c = pw[i];
        if (c >= 'A' && c <= 'Z') upper = 1;
        else if (c >= 'a' && c <= 'z') lower = 1;
        else if (c >= '0' && c <= '9') digit = 1;
        else if (strchr(SYMBOLS, c) != NULL) symbol = 1;
        else return 2; /* 規則 2: 使えない文字 */
    }
    /* 規則 3: 4 種類のうち 3 種類以上 */
    if (upper + lower + digit + symbol < 3) return 3;
    /* 規則 4: 同じ文字の 3 連続（数えた直後に判定するので末尾の連続も漏れない） */
    int run = 1;
    for (int i = 1; i < len; i++) {
        run = pw[i] == pw[i - 1] ? run + 1 : 1;
        if (run >= 3) return 4;
    }
    /* 規則 5: ユーザー名を含まない（両方を小文字にして strstr） */
    char lp[128], lu[32];
    for (int i = 0; i <= len; i++) lp[i] = (char)tolower((unsigned char)pw[i]);
    int ul = (int)strlen(user);
    for (int i = 0; i <= ul; i++) lu[i] = (char)tolower((unsigned char)user[i]);
    if (strstr(lp, lu) != NULL) return 5;
    return 0;
}

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 1;
    for (int i = 0; i < n; i++) {
        char user[32], pw[128];
        if (scanf("%31s %127s", user, pw) != 2) return 1; /* パスワードに空白は無いので %s で読める */
        int r = judge(user, pw);
        if (r == 0) puts("OK");
        else printf("%d\n", r);
    }
    return 0;
}
