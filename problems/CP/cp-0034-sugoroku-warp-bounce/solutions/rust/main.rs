use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|s| s.parse::<i64>().unwrap());
    let n = it.next().unwrap();
    let k = it.next().unwrap() as usize;
    let dice: Vec<i64> = (0..k).map(|_| it.next().unwrap()).collect();
    let m = it.next().unwrap() as usize;
    let mut warp = vec![-1i64; n as usize + 1]; // 入口 → 出口（-1 はワープなし）
    for _ in 0..m {
        let s = it.next().unwrap() as usize;
        warp[s] = it.next().unwrap();
    }
    let mut pos: i64 = 0;
    for (t, &d) in dice.iter().enumerate() {
        pos += d;
        if pos > n {
            pos = n - (pos - n); // 越えた分だけ戻る
        }
        if pos == n {
            println!("GOAL {}", t + 1); // 残りの出目は使わない
            return;
        }
        if warp[pos as usize] >= 0 {
            pos = warp[pos as usize]; // 1 回だけ
        }
    }
    println!("{}", pos);
}
