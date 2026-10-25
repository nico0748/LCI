use std::io::{self, Read, Write};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|t| t.parse::<usize>().unwrap());
    let k = it.next().unwrap();
    let n = 1usize << k;
    let mut s = vec![0usize; n + 1];
    for i in 1..=n {
        s[i] = it.next().unwrap();
    }
    let mut line: Vec<usize> = (0..n).map(|_| it.next().unwrap()).collect(); // 表の左からの選手番号
    let mut wins = vec![0u32; n + 1];
    while line.len() > 1 {
        let next: Vec<usize> = line
            .chunks(2)
            .map(|p| {
                let (a, b) = (p[0], p[1]);
                // 強さが大きい方、同じなら番号が小さい方（表の左右ではない）
                let w = if s[a] > s[b] || (s[a] == s[b] && a < b) { a } else { b };
                wins[w] += 1;
                w
            })
            .collect();
        line = next;
    }
    let mut out = String::with_capacity(n * 3 + 16);
    out.push_str(&line[0].to_string());
    out.push('\n');
    for i in 1..=n {
        if i > 1 {
            out.push(' ');
        }
        out.push_str(&wins[i].to_string());
    }
    out.push('\n');
    io::stdout().write_all(out.as_bytes()).unwrap();
}
