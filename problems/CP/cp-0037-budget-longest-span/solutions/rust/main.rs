use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|t| t.parse::<i64>().unwrap());
    let n = it.next().unwrap() as usize;
    let b = it.next().unwrap(); // 最大 10^15 なので i64
    let a: Vec<i64> = (0..n).map(|_| it.next().unwrap()).collect();
    let (mut best_len, mut best_l) = (0usize, 0usize);
    let mut s = 0i64;
    let mut l = 0usize;
    for r in 0..n {
        s += a[r];
        while s > b {
            // 費用は 0 以上なので、左端を進めれば合計は減る
            s -= a[l];
            l += 1;
        }
        if r + 1 - l > best_len {
            // 同じ長さなら早い開始日を残す
            best_len = r + 1 - l;
            best_l = l + 1;
        }
    }
    if best_len == 0 {
        println!("0");
    } else {
        println!("{} {}", best_len, best_l);
    }
}
