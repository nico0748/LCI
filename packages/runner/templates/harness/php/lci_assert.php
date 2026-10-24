<?php
/**
 * lci_assert.php — PHP 用の最小テストハーネス（追加依存ゼロ）。
 * 出力は TAP なので runner の "tap" パーサがそのまま読める。
 *
 * 使い方（問題側の harness/php/test.php）:
 *   <?php
 *   require __DIR__ . '/lci_assert.php';
 *   require __DIR__ . '/solution.php';     // ユーザーの userEntry
 *   lci_test('add small', fn() => lci_assert_eq(add(1, 2), 3));
 *   lci_test('add neg',   fn() => lci_assert_true(add(-1, 1) === 0, 'negatives'));
 *   lci_run();
 *
 * tests.json の command 例: "php -d display_errors=stderr test.php"
 */

final class LciAssertionFailed extends Exception {}

/** @var array<int, array{string, callable}> */
$GLOBALS['__lci_tests'] = [];

function lci_test(string $name, callable $fn): void {
  $GLOBALS['__lci_tests'][] = [$name, $fn];
}

function lci_fail(string $msg): never {
  throw new LciAssertionFailed($msg);
}

function lci_assert_true(bool $cond, string $msg = 'assertion failed'): void {
  if (!$cond) lci_fail($msg);
}

function lci_assert_eq(mixed $actual, mixed $expected, string $msg = ''): void {
  if ($actual !== $expected) {
    lci_fail(($msg !== '' ? $msg . ': ' : '') . 'expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
  }
}

function lci_assert_near(float $actual, float $expected, float $eps = 1e-6, string $msg = ''): void {
  if (abs($actual - $expected) > $eps) {
    lci_fail(($msg !== '' ? $msg . ': ' : '') . "expected $expected, got $actual");
  }
}

function lci_run(): never {
  $tests = $GLOBALS['__lci_tests'];
  echo "TAP version 13\n1.." . count($tests) . "\n";
  $failed = 0;
  foreach ($tests as $i => [$name, $fn]) {
    $n = $i + 1;
    try {
      $fn();
      echo "ok $n - $name\n";
    } catch (LciAssertionFailed $e) {
      $failed++;
      echo "not ok $n - $name\n# " . str_replace("\n", "\n# ", $e->getMessage()) . "\n";
    } catch (Throwable $e) {
      $failed++;
      echo "not ok $n - $name\n# " . get_class($e) . ': ' . str_replace("\n", "\n# ", $e->getMessage()) . ' (line ' . $e->getLine() . ")\n";
    }
  }
  exit($failed > 0 ? 1 : 0);
}
