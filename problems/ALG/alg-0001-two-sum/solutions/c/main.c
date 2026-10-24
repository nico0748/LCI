#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>

/* オープンアドレス法のハッシュ表。値 → 最初に現れた添字 */
#define CAP (1 << 19)
static long long keys[CAP];
static int vals[CAP];
static unsigned char used[CAP];

static size_t slot(long long k) {
  uint64_t h = (uint64_t)k * 0x9E3779B97F4A7C15ULL;
  return (size_t)(h >> 45) & (CAP - 1);
}

static int find(long long k) {
  for (size_t s = slot(k); used[s]; s = (s + 1) & (CAP - 1))
    if (keys[s] == k) return vals[s];
  return -1;
}

static void insert_first(long long k, int v) {
  size_t s = slot(k);
  for (; used[s]; s = (s + 1) & (CAP - 1))
    if (keys[s] == k) return;
  used[s] = 1; keys[s] = k; vals[s] = v;
}

int main(void) {
  int n; long long k;
  if (scanf("%d %lld", &n, &k) != 2) return 1;
  for (int j = 0; j < n; j++) {
    long long x;
    if (scanf("%lld", &x) != 1) return 1;
    int i = find(k - x);
    if (i >= 0) { printf("%d %d\n", i + 1, j + 1); return 0; }
    insert_first(x, j);
  }
  printf("-1\n");
  return 0;
}
