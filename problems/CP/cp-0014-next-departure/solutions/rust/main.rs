use std::fmt::Write as _;
use std::io::{self, Read};

fn to_min(s: &str) -> i32 {
    let (h, m) = s.split_once(':').unwrap();
    h.parse::<i32>().unwrap() * 60 + m.parse::<i32>().unwrap()
}

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace();
    let n: usize = it.next().unwrap().parse().unwrap();
    let mut deps: Vec<i32> = (0..n).map(|_| to_min(it.next().unwrap())).collect();
    deps.sort_unstable(); // 時刻表は時刻順とは限らない
    let q: usize = it.next().unwrap().parse().unwrap();
    let mut out = String::new();
    for _ in 0..q {
        let u = to_min(it.next().unwrap());
        // ちょうどの時刻の便にも乗れる（>=）。無ければ翌日の始発で、待ち時間に 1440 を足す
        let (dep, wait) = match deps.iter().find(|&&d| d >= u) {
            Some(&d) => (d, d - u),
            None => (deps[0], deps[0] + 1440 - u),
        };
        writeln!(out, "{:02}:{:02} {}", dep / 60, dep % 60, wait).unwrap();
    }
    print!("{}", out);
}
