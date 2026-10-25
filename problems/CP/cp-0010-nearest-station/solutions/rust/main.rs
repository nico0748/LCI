use std::fmt::Write as _;
use std::io::{self, Read, Write};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|s| s.parse::<i64>().unwrap());
    let n = it.next().unwrap() as usize;
    let q = it.next().unwrap() as usize;
    let mut xs: Vec<i64> = (0..n).map(|_| it.next().unwrap()).collect();
    xs.sort_unstable();
    let mut out = String::with_capacity(q * 11);
    for _ in 0..q {
        let h = it.next().unwrap();
        // partition_point は lower_bound と同じ: xs[i] は h 以上で最小の駅（i == n なら無い）
        let i = xs.partition_point(|&x| x < h);
        let mut best = i64::MAX;
        if i < n {
            best = xs[i] - h;
        }
        if i > 0 {
            best = best.min(h - xs[i - 1]);
        }
        writeln!(out, "{}", best).unwrap();
    }
    io::stdout().write_all(out.as_bytes()).unwrap();
}
