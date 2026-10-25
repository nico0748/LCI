#include <stdio.h>

int main(void) {
    int n;
    long long x, y;
    if (scanf("%d %lld %lld", &n, &x, &y) != 3) return 1;
    long long s = 0;
    for (int i = 0; i < n; i++) {
        char name[16]; /* 品名は使わない（英小文字 10 文字以下） */
        long long p, q;
        if (scanf("%15s %lld %lld", name, &p, &q) != 3) return 1;
        s += p * q;
    }
    /* クーポンは「X 円以上」で使える。割引後は 0 円で止める */
    long long t = s;
    if (s >= x) {
        t = s - y;
        if (t < 0) t = 0;
    }
    /* 税は整数で切り捨てる（printf("%.0f", t * 1.1) は四捨五入になるので使わない） */
    printf("%lld\n", t + t * 10 / 100);
    return 0;
}
