use std::io::{self, Read};

const MOD: u64 = 1_000_000_007;

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|t| t.parse::<u64>().unwrap());
    let n = it.next().unwrap() as usize;
    let k = it.next().unwrap(); // 10^18 は u64 に収まる
    let t: Vec<usize> = std::iter::once(0).chain((0..n).map(|_| it.next().unwrap() as usize)).collect();
    let a: Vec<u64> = std::iter::once(0).chain((0..n).map(|_| it.next().unwrap())).collect();

    let mut first = vec![usize::MAX; n + 1];
    let mut order = Vec::with_capacity(n);
    let mut pre = vec![0u64]; // 最大 2×10^14
    let mut x = 1;
    while first[x] == usize::MAX {
        first[x] = order.len();
        order.push(x);
        pre.push(pre[pre.len() - 1] + a[x]);
        x = t[x];
    }
    let mu = first[x]; // 尾の長さ
    let lam = order.len() - mu; // 周期の長さ
    if k <= order.len() as u64 {
        let k = k as usize;
        println!("{} {}", t[order[k - 1]], pre[k] % MOD);
        return;
    }
    let d = k - mu as u64;
    let (q, r) = (d / lam as u64, (d % lam as u64) as usize);
    let cyc = (pre[mu + lam] - pre[mu]) % MOD;
    let total = (pre[mu + r] % MOD + q % MOD * cyc) % MOD; // mod してから掛ける（積は約 10^18）
    println!("{} {}", order[mu + r], total);
}
