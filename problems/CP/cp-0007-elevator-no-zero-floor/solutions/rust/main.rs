use std::io::{self, Read};

/// 0 階が無いので、地下は 1 つずらして詰める: B1→0, B2→-1, B3→-2（地上はそのまま）
fn level(s: &str) -> i32 {
    match s.strip_prefix('B') {
        Some(k) => 1 - k.parse::<i32>().unwrap(),
        None => s.parse().unwrap(),
    }
}

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace();
    let n: usize = it.next().unwrap().parse().unwrap();
    let lv: Vec<i32> = (0..n).map(|_| level(it.next().unwrap())).collect();
    let total: i32 = lv.windows(2).map(|p| (p[1] - p[0]).abs()).sum();
    println!("{}", total);
}
