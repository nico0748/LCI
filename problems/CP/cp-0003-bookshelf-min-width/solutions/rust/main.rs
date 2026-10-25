use std::io::{self, Read};

/// 棚幅 cap で、左から詰めて K 段以内に収まるか（cap ≥ max(w) で呼ぶ）
fn fits(w: &[u64], k: u64, cap: u64) -> bool {
    let (mut count, mut cur) = (1u64, 0u64);
    for &x in w {
        cur += x;
        if cur > cap {
            count += 1;
            if count > k {
                return false;
            }
            cur = x;
        }
    }
    true
}

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|s| s.parse::<u64>().unwrap());
    let n = it.next().unwrap() as usize;
    let k = it.next().unwrap();
    let w: Vec<u64> = (0..n).map(|_| it.next().unwrap()).collect();
    // 答えは [max(w), Σw] の中。Σw は最大 2×10^14 なので u64
    let mut lo = *w.iter().max().unwrap();
    let mut hi: u64 = w.iter().sum();
    while lo < hi {
        let mid = (lo + hi) / 2;
        if fits(&w, k, mid) {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }
    println!("{}", lo);
}
