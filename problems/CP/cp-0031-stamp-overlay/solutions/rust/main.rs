use std::io::{self, BufWriter, Read, Write};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    // 絵柄の行は空白を含まないので、空白区切りのトークンとして読める
    let mut it = input.split_ascii_whitespace();
    fn num(it: &mut std::str::SplitAsciiWhitespace) -> i64 {
        it.next().unwrap().parse().unwrap()
    }
    let h_all = num(&mut it);
    let w_all = num(&mut it);
    let n = num(&mut it);
    let mut canvas = vec![vec![b'.'; w_all as usize]; h_all as usize];
    for _ in 0..n {
        let h = num(&mut it);
        let w = num(&mut it);
        let r = num(&mut it);
        let c = num(&mut it);
        for i in 0..h {
            let row = it.next().unwrap().as_bytes();
            let y = r - 1 + i; // 負になりうるので usize にする前に i64 のまま比べる
            if y < 0 || y >= h_all {
                continue;
            }
            for j in 0..w {
                let x = c - 1 + j;
                let ch = row[j as usize];
                if ch != b'.' && x >= 0 && x < w_all {
                    canvas[y as usize][x as usize] = ch;
                }
            }
        }
    }
    let stdout = io::stdout();
    let mut out = BufWriter::new(stdout.lock());
    for line in &canvas {
        out.write_all(line).unwrap();
        out.write_all(b"\n").unwrap();
    }
    out.flush().unwrap();
}
