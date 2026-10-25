use std::collections::HashMap;
use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|t| t.parse::<u64>().unwrap());
    let n = it.next().unwrap() as usize;
    let m = it.next().unwrap();
    // M は最大 10^9 なので配列ではなく HashMap で余りごとの個数を数える
    let mut cnt: HashMap<u64, u64> = HashMap::with_capacity(n);
    let mut ans: u64 = 0; // 最大約 2×10^10
    for _ in 0..n {
        let r = it.next().unwrap() % m;
        ans += cnt.get(&((m - r) % m)).copied().unwrap_or(0); // それまでに見た「組める余り」の袋の数
        *cnt.entry(r).or_insert(0) += 1;
    }
    println!("{}", ans);
}
