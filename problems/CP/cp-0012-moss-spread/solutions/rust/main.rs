use std::io::{self, Read, Write};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace();
    let h: usize = it.next().unwrap().parse().unwrap();
    let w: usize = it.next().unwrap().parse().unwrap();
    let t: usize = it.next().unwrap().parse().unwrap();
    let mut g: Vec<Vec<u8>> = (0..h).map(|_| it.next().unwrap().as_bytes().to_vec()).collect();
    for _ in 0..t {
        // 二重バッファ: 判定は前の日の g、書き込みは nxt
        let mut nxt = g.clone();
        for r in 0..h {
            for c in 0..w {
                let ch = g[r][c];
                if ch == b'#' {
                    continue;
                }
                // 上下左右の苔の数。usize なので r - 1 は r > 0 を先に確かめる（盤の外は数えない）
                let mut m = 0;
                if r > 0 && g[r - 1][c] == b'o' {
                    m += 1;
                }
                if r + 1 < h && g[r + 1][c] == b'o' {
                    m += 1;
                }
                if c > 0 && g[r][c - 1] == b'o' {
                    m += 1;
                }
                if c + 1 < w && g[r][c + 1] == b'o' {
                    m += 1;
                }
                if ch == b'.' {
                    if m >= 2 {
                        nxt[r][c] = b'o';
                    }
                } else if m == 0 || m == 4 {
                    nxt[r][c] = b'.';
                }
            }
        }
        g = nxt;
    }
    let mut out = Vec::with_capacity(h * (w + 1));
    for row in &g {
        out.extend_from_slice(row);
        out.push(b'\n');
    }
    io::stdout().write_all(&out).unwrap();
}
