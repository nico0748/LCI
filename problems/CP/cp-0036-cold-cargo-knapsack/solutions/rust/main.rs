use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|t| t.parse::<i64>().unwrap());
    let n = it.next().unwrap() as usize;
    let cap = it.next().unwrap() as usize;
    let c = it.next().unwrap() as usize;
    // dp[k][w] = 冷蔵品 k 個以下・重さ w 以下での報酬の最大（最大約 10^11 なので i64）
    let mut dp = vec![vec![0i64; cap + 1]; c + 1];
    for _ in 0..n {
        let w = it.next().unwrap() as usize;
        let v = it.next().unwrap();
        let f = it.next().unwrap() as usize;
        if w > cap {
            continue;
        }
        // k も重さも大きい方から: 右辺はこの荷物を使う前の値（同じ荷物を 2 回使わない）
        for k in (f..=c).rev() {
            for x in (w..=cap).rev() {
                let cand = dp[k - f][x - w] + v;
                if cand > dp[k][x] {
                    dp[k][x] = cand;
                }
            }
        }
    }
    println!("{}", dp[c][cap]);
}
