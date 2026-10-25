use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace();
    let h: usize = it.next().unwrap().parse().unwrap();
    let w: usize = it.next().unwrap().parse().unwrap();
    let k: usize = it.next().unwrap().parse().unwrap();
    // s[i * (W+1) + j] = 上 i 行・左 j 列の花の合計（0 の行と列を足した (H+1)×(W+1) を 1 次元で持つ）
    let w1 = w + 1;
    let mut s = vec![0i32; (h + 1) * w1];
    for i in 0..h {
        let g = it.next().unwrap().as_bytes();
        let mut acc = 0i32;
        for j in 0..w {
            acc += (g[j] - b'0') as i32;
            s[(i + 1) * w1 + j + 1] = s[i * w1 + j + 1] + acc;
        }
    }
    let (mut best, mut br, mut bc) = (-1i32, 0usize, 0usize);
    for r in 0..=h - k {
        let (top, bot) = (r * w1, (r + k) * w1);
        for c in 0..=w - k {
            let v = s[bot + c + k] - s[top + c + k] - s[bot + c] + s[top + c];
            if v > best {
                // 行優先で「より大きいときだけ」更新 → 同点は上・左が残る
                best = v;
                br = r;
                bc = c;
            }
        }
    }
    println!("{}\n{} {}", best, br + 1, bc + 1);
}
