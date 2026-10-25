use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|s| s.parse::<i64>().unwrap());
    let n = it.next().unwrap() as usize;
    let c = it.next().unwrap();
    let mut bk: Vec<(i64, i64)> = (0..n).map(|_| (it.next().unwrap(), it.next().unwrap())).collect();
    bk.sort_unstable_by_key(|x| x.1); // 終了時刻の早い順
    let mut free_at = 0i64; // 次の予約が始まってよい最も早い時刻 = 直前の終了 + C（最大 3×10^9 なので i64）
    let mut cnt = 0;
    for (s, e) in bk {
        if s >= free_at {
            // ちょうど「終了 + C」に始まる予約は受けられる
            cnt += 1;
            free_at = e + c;
        }
    }
    println!("{}", cnt);
}
