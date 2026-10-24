/*
 * lci_assert.h — C 用の最小テストハーネス（追加依存ゼロ）。
 * 出力は TAP なので runner の "tap" パーサがそのまま読める。
 *
 * 使い方（問題側の harness/c/test.c）:
 *   #include "lci_assert.h"
 *   #include "solution.c"           // ユーザーの userEntry をそのまま取り込む
 *   LCI_TEST(add_small) { LCI_ASSERT_EQ_INT(add(1, 2), 3); }
 *   LCI_TEST(add_neg)   { LCI_ASSERT_TRUE(add(-1, 1) == 0, "negatives"); }
 *   LCI_MAIN(add_small, add_neg)
 *
 * tests.json の command 例: "gcc -O2 -std=c17 -Wall -o t test.c -lm && ./t"
 */
#ifndef LCI_ASSERT_H
#define LCI_ASSERT_H
#include <stdio.h>
#include <string.h>
#include <math.h>

static int lci_failed_in_test = 0;
/* 失敗メッセージは結果行（not ok）の後に `# ` 行で出したいので、テスト中はバッファに貯める */
static char lci_msg[2048];
static void lci_note(const char *file, int line, const char *msg) {
  size_t n = strlen(lci_msg);
  if (n < sizeof(lci_msg) - 1) snprintf(lci_msg + n, sizeof(lci_msg) - n, "# %s:%d: %s\n", file, line, msg);
  lci_failed_in_test = 1;
}

#define LCI_TEST(name) static void lci_test_##name(void)

#define LCI_FAIL(msg) lci_note(__FILE__, __LINE__, (msg))
#define LCI_ASSERT_TRUE(cond, msg) do { if (!(cond)) LCI_FAIL(msg); } while (0)
#define LCI_ASSERT_EQ_INT(a, b) do { long long _a = (long long)(a), _b = (long long)(b); \
  if (_a != _b) { char _m[128]; snprintf(_m, sizeof _m, "expected %lld, got %lld", _b, _a); LCI_FAIL(_m); } } while (0)
#define LCI_ASSERT_EQ_STR(a, b) do { const char *_a = (a), *_b = (b); \
  if (_a == NULL || _b == NULL || strcmp(_a, _b) != 0) { char _m[512]; snprintf(_m, sizeof _m, "expected \"%s\", got \"%s\"", _b ? _b : "(null)", _a ? _a : "(null)"); LCI_FAIL(_m); } } while (0)
#define LCI_ASSERT_NEAR(a, b, eps) do { double _a = (a), _b = (b); \
  if (fabs(_a - _b) > (eps)) { char _m[128]; snprintf(_m, sizeof _m, "expected %g, got %g", _b, _a); LCI_FAIL(_m); } } while (0)

typedef struct { const char *name; void (*fn)(void); } lci_case_t;

static int lci_run_all(const lci_case_t *cases, int n) {
  int failed = 0;
  printf("TAP version 13\n1..%d\n", n);
  for (int i = 0; i < n; i++) {
    lci_failed_in_test = 0;
    lci_msg[0] = 0;
    cases[i].fn();
    if (lci_failed_in_test) { failed++; printf("not ok %d - %s\n%s", i + 1, cases[i].name, lci_msg); }
    else printf("ok %d - %s\n", i + 1, cases[i].name);
  }
  fflush(stdout);
  return failed ? 1 : 0;
}

#define LCI_CASE(name) { #name, lci_test_##name }
#define LCI_MAIN(...) \
  int main(void) { \
    static const char *names = #__VA_ARGS__; \
    void (*fns[])(void) = { LCI_FNS(__VA_ARGS__) }; \
    int n = (int)(sizeof(fns) / sizeof(fns[0])); \
    lci_case_t cases[64]; char buf[1024]; strncpy(buf, names, sizeof(buf) - 1); buf[sizeof(buf) - 1] = 0; \
    int k = 0; for (char *tok = strtok(buf, ", "); tok && k < n && k < 64; tok = strtok(NULL, ", ")) { cases[k].name = tok; cases[k].fn = fns[k]; k++; } \
    return lci_run_all(cases, k); \
  }

/* 可変長引数を関数ポインタ列へ展開（最大 16 テスト） */
#define LCI_FN(x) lci_test_##x
#define LCI_FNS_1(a) LCI_FN(a)
#define LCI_FNS_2(a, ...) LCI_FN(a), LCI_FNS_1(__VA_ARGS__)
#define LCI_FNS_3(a, ...) LCI_FN(a), LCI_FNS_2(__VA_ARGS__)
#define LCI_FNS_4(a, ...) LCI_FN(a), LCI_FNS_3(__VA_ARGS__)
#define LCI_FNS_5(a, ...) LCI_FN(a), LCI_FNS_4(__VA_ARGS__)
#define LCI_FNS_6(a, ...) LCI_FN(a), LCI_FNS_5(__VA_ARGS__)
#define LCI_FNS_7(a, ...) LCI_FN(a), LCI_FNS_6(__VA_ARGS__)
#define LCI_FNS_8(a, ...) LCI_FN(a), LCI_FNS_7(__VA_ARGS__)
#define LCI_FNS_9(a, ...) LCI_FN(a), LCI_FNS_8(__VA_ARGS__)
#define LCI_FNS_10(a, ...) LCI_FN(a), LCI_FNS_9(__VA_ARGS__)
#define LCI_FNS_11(a, ...) LCI_FN(a), LCI_FNS_10(__VA_ARGS__)
#define LCI_FNS_12(a, ...) LCI_FN(a), LCI_FNS_11(__VA_ARGS__)
#define LCI_FNS_13(a, ...) LCI_FN(a), LCI_FNS_12(__VA_ARGS__)
#define LCI_FNS_14(a, ...) LCI_FN(a), LCI_FNS_13(__VA_ARGS__)
#define LCI_FNS_15(a, ...) LCI_FN(a), LCI_FNS_14(__VA_ARGS__)
#define LCI_FNS_16(a, ...) LCI_FN(a), LCI_FNS_15(__VA_ARGS__)
#define LCI_NARG(...) LCI_NARG_(__VA_ARGS__, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1)
#define LCI_NARG_(_1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, N, ...) N
#define LCI_CAT(a, b) LCI_CAT_(a, b)
#define LCI_CAT_(a, b) a##b
#define LCI_FNS(...) LCI_CAT(LCI_FNS_, LCI_NARG(__VA_ARGS__))(__VA_ARGS__)

#endif
