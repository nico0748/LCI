use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace();
    let mut next = || it.next().unwrap();
    let h: usize = next().parse().unwrap();
    let w: usize = next().parse().unwrap();
    let k: usize = next().parse().unwrap();
    for r in 0..h {
        let row = next().as_bytes();
        let mut run = 0; // この列で、いま続いている空席の数（列が変わったら 0 から数え直す）
        for c in 0..w {
            if row[c] == b'.' {
                run += 1;
                if run == k {
                    println!("{} {}", r + 1, c + 2 - k); // 左端は c+1-k（0 始まり）→ 1 始まり。usize なので引き算は最後に
                    return;
                }
            } else {
                run = 0;
            }
        }
    }
    println!("-1");
}
