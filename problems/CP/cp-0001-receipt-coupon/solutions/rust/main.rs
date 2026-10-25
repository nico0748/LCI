use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace();
    let n: usize = it.next().unwrap().parse().unwrap();
    let x: i64 = it.next().unwrap().parse().unwrap();
    let y: i64 = it.next().unwrap().parse().unwrap();
    let mut s: i64 = 0;
    for _ in 0..n {
        let _name = it.next().unwrap(); // 品名は使わない
        let p: i64 = it.next().unwrap().parse().unwrap();
        let q: i64 = it.next().unwrap().parse().unwrap();
        s += p * q;
    }
    // クーポンは「X 円以上」で使える。割引後は 0 円で止める
    let t = if s >= x { (s - y).max(0) } else { s };
    // 税は整数で切り捨てる（t >= 0 なので整数の / が切り捨てになる）
    println!("{}", t + t * 10 / 100);
}
