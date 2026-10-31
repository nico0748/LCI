use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|s| s.parse::<i64>().unwrap());
    let n = it.next().unwrap() as usize;
    let m = it.next().unwrap() as usize;
    let mut price = vec![0i64; n];
    let mut mask = vec![0usize; n];
    for i in 0..n {
        price[i] = it.next().unwrap();
        let k = it.next().unwrap();
        for _ in 0..k {
            mask[i] |= 1 << (it.next().unwrap() - 1); // 栄養 a をビット a-1 に
        }
    }
    let full = (1usize << m) - 1;
    let size = 1usize << n;
    let mut cover = vec![0usize; size]; // 集合 s の栄養の OR
    let mut cost = vec![0i64; size]; // 集合 s の合計（最大 1.5×10^10 なので i64）
    let (mut best, mut ways) = (-1i64, 0u32);
    for s in 1..size {
        let i = s.trailing_zeros() as usize; // 最下位の 1 ビット = 番号が最小の料理
        let rest = s & (s - 1);
        cover[s] = cover[rest] | mask[i];
        cost[s] = cost[rest] + price[i];
        if cover[s] == full {
            if best == -1 || cost[s] < best {
                best = cost[s];
                ways = 1;
            } else if cost[s] == best {
                ways += 1;
            }
        }
    }
    if best == -1 {
        println!("-1");
    } else {
        println!("{} {}", best, ways);
    }
}
