use std::fmt::Write as _;
use std::io::{self, Read, Write};

const P: u64 = 998_244_353;

fn power(mut a: u64, mut e: u64) -> u64 {
    let mut r = 1;
    a %= P;
    while e > 0 {
        if e & 1 == 1 {
            r = r * a % P;
        }
        a = a * a % P;
        e >>= 1;
    }
    r
}

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|s| s.parse::<usize>().unwrap());
    let q = it.next().unwrap();
    let qs: Vec<(usize, usize)> = (0..q).map(|_| (it.next().unwrap(), it.next().unwrap())).collect();
    let m = qs.iter().map(|&(n, _)| n).max().unwrap();
    // 階乗と、その逆元（フェルマーの小定理: a^(P−2)）を n の最大値まで前計算する。積は u64 に収まる（P^2 < 2^64）
    let mut fact = vec![1u64; m + 1];
    for i in 1..=m {
        fact[i] = fact[i - 1] * i as u64 % P;
    }
    let mut inv = vec![1u64; m + 1];
    inv[m] = power(fact[m], P - 2);
    for i in (1..=m).rev() {
        inv[i - 1] = inv[i] * i as u64 % P;
    }
    let mut out = String::with_capacity(q * 11);
    for (n, r) in qs {
        let ans = if r > n { 0 } else { fact[n] * inv[r] % P * inv[n - r] % P };
        writeln!(out, "{}", ans).unwrap();
    }
    io::stdout().write_all(out.as_bytes()).unwrap();
}
