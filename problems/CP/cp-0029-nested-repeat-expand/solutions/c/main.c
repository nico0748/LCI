#include <stdio.h>
#include <string.h>

/* 展開途中の文字列は常に最終結果の先頭部分（回数 ≥ 1 なので縮まない）なので、10^5 + 1 文字の 1 本のバッファで足りる */
static char out[100002];
static int len;
static char s[1002];

int main(void) {
    if (scanf("%1001s", s) != 1) return 1;
    int start[64], count[64], top = 0; /* 開いている括弧ごとの、中身の開始位置と回数 */
    for (int i = 0; s[i];) {
        char ch = s[i];
        if (ch >= '0' && ch <= '9') {
            int k = 0;
            while (s[i] >= '0' && s[i] <= '9') k = k * 10 + (s[i++] - '0'); /* 回数は複数桁 */
            if (s[i] == '(') {
                start[top] = len;
                count[top++] = k;
            } else { /* 直後の 1 文字だけを k 個 */
                memset(out + len, s[i], k);
                len += k;
            }
            i++;
        } else if (ch == ')') {
            top--;
            int b = start[top], body = len - b;
            for (int r = 1; r < count[top]; r++) { /* 中身はすでに 1 回分あるので、残り k−1 回を複製 */
                memcpy(out + len, out + b, body);
                len += body;
            }
            i++;
        } else {
            out[len++] = ch;
            i++;
        }
    }
    out[len] = '\0';
    puts(out);
    return 0;
}
