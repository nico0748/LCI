use std::io::{self, BufWriter, Read, Write};

const SYMBOLS: &[u8] = b"!#$%&*+-=?@_";

fn judge(user: &str, pw: &str) -> &'static str {
    let p = pw.as_bytes();
    // 規則 1: 長さ
    if p.len() < 8 || p.len() > 64 {
        return "1";
    }
    let (mut upper, mut lower, mut digit, mut symbol) = (0, 0, 0, 0);
    for &c in p {
        match c {
            b'A'..=b'Z' => upper = 1,
            b'a'..=b'z' => lower = 1,
            b'0'..=b'9' => digit = 1,
            _ if SYMBOLS.contains(&c) => symbol = 1,
            _ => return "2", // 規則 2: 使えない文字
        }
    }
    // 規則 3: 4 種類のうち 3 種類以上
    if upper + lower + digit + symbol < 3 {
        return "3";
    }
    // 規則 4: 同じ文字の 3 連続（数えた直後に判定するので末尾の連続も漏れない）
    let mut run = 1;
    for i in 1..p.len() {
        run = if p[i] == p[i - 1] { run + 1 } else { 1 };
        if run >= 3 {
            return "4";
        }
    }
    // 規則 5: ユーザー名を含まない（大文字小文字を区別しない）
    if pw.to_ascii_lowercase().contains(&user.to_ascii_lowercase()) {
        return "5";
    }
    "OK"
}

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut lines = input.lines();
    let n: usize = lines.next().unwrap().trim().parse().unwrap();
    let mut out = BufWriter::new(io::stdout().lock());
    for _ in 0..n {
        let (user, pw) = lines.next().unwrap().split_once(' ').unwrap();
        writeln!(out, "{}", judge(user, pw)).unwrap();
    }
}
