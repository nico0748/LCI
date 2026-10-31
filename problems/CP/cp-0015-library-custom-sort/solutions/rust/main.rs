use std::collections::HashMap;
use std::io::{self, Read, Write};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace();
    let g: usize = it.next().unwrap().parse().unwrap();
    let rank: HashMap<&str, usize> = (0..g).map(|i| (it.next().unwrap(), i)).collect();
    let n: usize = it.next().unwrap().parse().unwrap();
    // (順位, 一覧外ならジャンル名, 年, 書名)
    let mut books: Vec<(usize, &str, i32, &str)> = (0..n)
        .map(|_| {
            let title = it.next().unwrap();
            let genre = it.next().unwrap();
            let year: i32 = it.next().unwrap().parse().unwrap(); // 年は数値で比べる
            let r = *rank.get(genre).unwrap_or(&g); // 一覧に無いジャンルは順位 G
            (r, if r == g { genre } else { "" }, year, title)
        })
        .collect();
    // &str の Ord はバイト順（= 文字コード順）
    books.sort_unstable_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(b.1)).then(b.2.cmp(&a.2)).then_with(|| a.3.cmp(b.3)));
    let mut out = String::with_capacity(n * 16);
    for b in &books {
        out.push_str(b.3);
        out.push('\n');
    }
    io::stdout().write_all(out.as_bytes()).unwrap();
}
