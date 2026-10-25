use std::io::{self, Read, Write};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    // 本文には空白が続くことがあるので、空白で区切らず行で読む
    let lines: Vec<&str> = input.split('\n').collect();
    let n: usize = lines[0].trim().parse().unwrap();
    let words: Vec<&[u8]> = (0..n).map(|i| lines[1 + i].trim().as_bytes()).collect();
    let s = lines[1 + n].trim_end_matches('\r').as_bytes();
    // 原文の上で一致を探して印だけ付ける（置き換えた文字列で次の語を探さない。重なった一致も拾う）
    let mut mark = vec![false; s.len()];
    for wd in &words {
        if wd.len() > s.len() {
            continue;
        }
        for i in 0..=s.len() - wd.len() {
            if &s[i..i + wd.len()] == *wd {
                mark[i..i + wd.len()].iter_mut().for_each(|m| *m = true);
            }
        }
    }
    let mut out: Vec<u8> = s.iter().zip(&mark).map(|(&ch, &m)| if m { b'*' } else { ch }).collect();
    out.push(b'\n');
    io::stdout().write_all(&out).unwrap();
}
