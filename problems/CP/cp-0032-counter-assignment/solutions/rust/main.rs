use std::fmt::Write as _;
use std::io::{self, Read, Write};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|s| s.parse::<i64>().unwrap());
    let n = it.next().unwrap() as usize;
    let m = it.next().unwrap() as usize;
    let mut free = vec![0i64; m]; // 窓口 k が空く時刻。最大で約 2×10^13 なので i64
    let mut out = String::with_capacity(n * 16);
    for _ in 0..n {
        let a = it.next().unwrap();
        let d = it.next().unwrap();
        let s = a.max(*free.iter().min().unwrap()); // 案内時刻 = max(到着, 最も早く空く時刻)
        let k = free.iter().position(|&f| f <= s).unwrap(); // 時刻 s に空いている窓口のうち番号最小
        free[k] = s + d;
        writeln!(out, "{} {}", k + 1, s - a).unwrap();
    }
    io::stdout().write_all(out.as_bytes()).unwrap();
}
