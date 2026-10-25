use std::io::{self, Read};

const DAY: usize = 86400;

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|x| x.parse::<usize>().unwrap());
    let n = it.next().unwrap();
    // いもす法: [s, t) にいるので diff[s] += 1, diff[t] -= 1。t = 86400 があるので 86401 要素
    let mut diff = vec![0i32; DAY + 1];
    for _ in 0..n {
        let s = it.next().unwrap();
        let t = it.next().unwrap();
        diff[s] += 1;
        diff[t] -= 1;
    }
    let (mut cur, mut peak, mut first, mut seconds) = (0i32, -1i32, 0usize, 0usize);
    for (x, &dx) in diff.iter().take(DAY).enumerate() {
        cur += dx;
        if cur > peak {
            peak = cur;
            first = x;
            seconds = 1;
        } else if cur == peak {
            seconds += 1;
        }
    }
    println!("{}\n{}\n{}", peak, first, seconds);
}
