use std::io::{self, Read, Write};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let s = input.trim().as_bytes();
    // stack の末尾は今いる括弧の中で、ここまでに展開した文字列
    let mut stack: Vec<Vec<u8>> = vec![Vec::new()];
    let mut counts: Vec<usize> = Vec::new(); // 開いている括弧ごとの回数
    let mut i = 0;
    while i < s.len() {
        let ch = s[i];
        if ch.is_ascii_digit() {
            let mut k = 0usize;
            while s[i].is_ascii_digit() {
                k = k * 10 + (s[i] - b'0') as usize; // 回数は複数桁（例: 999a、12(…)）
                i += 1;
            }
            if s[i] == b'(' {
                counts.push(k);
                stack.push(Vec::new());
            } else {
                let c = s[i];
                stack.last_mut().unwrap().extend(std::iter::repeat(c).take(k)); // 直後の 1 文字だけを k 個
            }
            i += 1;
        } else if ch == b')' {
            let body = stack.pop().unwrap();
            let k = counts.pop().unwrap();
            stack.last_mut().unwrap().extend(body.repeat(k));
            i += 1;
        } else {
            stack.last_mut().unwrap().push(ch);
            i += 1;
        }
    }
    let mut out = stack.pop().unwrap();
    out.push(b'\n');
    io::stdout().write_all(&out).unwrap();
}
