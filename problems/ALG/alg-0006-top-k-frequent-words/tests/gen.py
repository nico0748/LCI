"""テストケース生成（固定シードで決定的）。期待値は全件ソートで計算する（参照解はヒープなので独立）。

実行: python3 tests/gen.py   （problem ディレクトリで）
"""
import os
import random
import string

HERE = os.path.dirname(os.path.abspath(__file__))


def expected(words, k):
    counts = {}
    for w in words:
        counts[w] = counts.get(w, 0) + 1
    items = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    return items[:k]


def write(name, words, k):
    with open(os.path.join(HERE, f"{name}.in"), "w") as f:
        f.write(f"{len(words)} {k}\n{' '.join(words)}\n")
    with open(os.path.join(HERE, f"{name}.out"), "w") as f:
        f.write("".join(f"{w} {c}\n" for w, c in expected(words, k)))


def rand_word(rng, lo=1, hi=8):
    return "".join(rng.choice(string.ascii_lowercase) for _ in range(rng.randint(lo, hi)))


def main():
    rng = random.Random(6)
    write("01", "cat dog cat bird dog ant cat ant".split(), 3)
    write("02", "log log error warn error log".split(), 5)  # K > 種類数
    write("11", ["zeta", "alpha", "mid", "beta"], 2)        # 全部 1 回（同点のみ）
    write("12", ["same"] * 10, 1)
    # 出現順と辞書順が逆になる同点（most_common だと落ちる）
    write("13", ["pear"] * 3 + ["apple"] * 3 + ["fig"] * 2 + ["date"] * 2 + ["kiwi"], 4)
    write("14", ["a", "ab", "abc", "b", "ab", "a", "abc", "b"], 3)  # 接頭辞関係の辞書順
    vocab = [rand_word(rng) for _ in range(30)]
    write("15", [rng.choice(vocab) for _ in range(500)], 10)
    n = 200000
    # Zipf 風の分布の大ケース
    vocab = list({rand_word(rng, 3, 12) for _ in range(20000)})
    vocab.sort()
    rng.shuffle(vocab)
    weights = [1 / (i + 1) for i in range(len(vocab))]
    write("21", rng.choices(vocab, weights=weights, k=n), 50)
    # ほぼ全部が別ワード、同点が大量（K も大きい）
    uniq = list({rand_word(rng, 5, 10) for _ in range(n // 2)})
    words = (uniq * 2)[: n // 2]
    rng.shuffle(words)
    write("22", words, 1000)
    # 少数の種類だけで同点が多い大ケース
    few = [rand_word(rng, 1, 3) for _ in range(40)]
    write("23", [few[i % len(few)] for i in range(n // 2)], n // 2)


if __name__ == "__main__":
    main()
