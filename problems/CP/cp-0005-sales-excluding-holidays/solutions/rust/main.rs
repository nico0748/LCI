use std::fmt::Write as _;
use std::io::{self, Read, Write};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|s| s.parse::<i64>().unwrap());
    let n = it.next().unwrap() as usize;
    let q = it.next().unwrap() as usize;
    // 累積和を 2 本: ps[i] = 1..i 日目の営業日の売上合計（i64）、pc[i] = 営業日数
    let mut ps = vec![0i64; n + 1];
    let mut pc = vec![0i64; n + 1];
    for i in 0..n {
        let a = it.next().unwrap();
        // 休業日（-1）は足さない。売上 0 円の営業日は日数に数える
        ps[i + 1] = ps[i] + if a >= 0 { a } else { 0 };
        pc[i + 1] = pc[i] + if a >= 0 { 1 } else { 0 };
    }
    let mut out = String::with_capacity(q * 24);
    for _ in 0..q {
        let l = it.next().unwrap() as usize;
        let r = it.next().unwrap() as usize;
        // 両端を含む L..R は「R までの和 − (L−1) までの和」
        writeln!(out, "{} {}", ps[r] - ps[l - 1], pc[r] - pc[l - 1]).unwrap();
    }
    io::stdout().write_all(out.as_bytes()).unwrap();
}
