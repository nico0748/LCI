use std::io::{self, Read};

fn main() {
    let mut input = Vec::new();
    io::stdin().read_to_end(&mut input).unwrap();
    let mut it = input.split(|c| c.is_ascii_whitespace()).filter(|s| !s.is_empty());
    let num = |s: &[u8]| s.iter().fold(0usize, |a, &c| a * 10 + (c - b'0') as usize);
    let h = num(it.next().unwrap());
    let w = num(it.next().unwrap());
    let w2 = w + 2;
    // 周りを壁で 1 周囲んだ 1 次元の盤。true = 未訪問の空き区画（範囲チェックが要らない）
    let mut g = vec![false; (h + 2) * w2];
    for r in 1..=h {
        let row = it.next().unwrap();
        for c in 0..w {
            g[r * w2 + c + 1] = row[c] == b'.';
        }
    }
    // 再帰ではなく Vec の明示的なスタック（メインスレッドのスタック 8MB を使わない）
    let mut stack: Vec<usize> = Vec::new();
    let (mut count, mut best) = (0usize, 0usize);
    for v in w2..(h + 1) * w2 {
        if !g[v] {
            continue;
        }
        count += 1;
        g[v] = false; // 訪問済みの印は積むときに付ける
        stack.push(v);
        let mut area = 0;
        while let Some(x) = stack.pop() {
            area += 1;
            for y in [x - 1, x + 1, x - w2, x + w2] {
                if g[y] {
                    g[y] = false;
                    stack.push(y);
                }
            }
        }
        best = best.max(area);
    }
    println!("{} {}", count, best);
}
