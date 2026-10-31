use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace();
    let h: i32 = it.next().unwrap().parse().unwrap();
    let w: i32 = it.next().unwrap().parse().unwrap();
    let grid: Vec<&[u8]> = (0..h).map(|_| it.next().unwrap().as_bytes()).collect();
    let _n = it.next().unwrap();
    let cmds = it.next().unwrap().as_bytes();
    let (mut r, mut c) = (0i32, 0i32);
    for (i, row) in grid.iter().enumerate() {
        if let Some(j) = row.iter().position(|&b| b == b'S') {
            r = i as i32;
            c = j as i32;
        }
    }
    // 向き 0=北 1=東 2=南 3=西。座標は i32 で計算する（usize だと 0 - 1 で桁あふれする）
    let dr = [-1, 0, 1, 0];
    let dc = [0, 1, 0, -1];
    let mut seen = vec![false; (h * w) as usize];
    seen[(r * w + c) as usize] = true; // 出発マスも数える
    let mut count = 1;
    let mut d = 0usize;
    for &ch in cmds {
        match ch {
            b'F' => {
                let (nr, nc) = (r + dr[d], c + dc[d]);
                if nr >= 0 && nr < h && nc >= 0 && nc < w && grid[nr as usize][nc as usize] != b'#' {
                    r = nr;
                    c = nc;
                    let idx = (r * w + c) as usize;
                    if !seen[idx] {
                        seen[idx] = true;
                        count += 1;
                    }
                }
            }
            b'R' => d = (d + 1) % 4,
            _ => d = (d + 3) % 4, // L: -1 ではなく +3（usize で負にしない）
        }
    }
    println!("{} {}\n{}", r + 1, c + 1, count);
}
