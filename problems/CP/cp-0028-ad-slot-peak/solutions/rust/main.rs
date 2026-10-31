use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|x| x.parse::<i64>().unwrap());
    let n = it.next().unwrap() as usize;
    let mut ev: Vec<(i64, i64)> = Vec::with_capacity(2 * n);
    for _ in 0..n {
        let s = it.next().unwrap();
        let e = it.next().unwrap();
        let c = it.next().unwrap();
        ev.push((s, c));
        ev.push((e, -c));
    }
    // (時刻, 増減) の昇順 = 時刻の昇順、同じ時刻は終了（負の増減）が先
    ev.sort_unstable();
    let (mut cur, mut best, mut at) = (0i64, -1i64, -1i64); // 合計は最大 10^14 なので i64
    for &(t, d) in &ev {
        cur += d;
        if cur > best {
            best = cur;
            at = t;
        }
    }
    println!("{} {}", best, at);
}
