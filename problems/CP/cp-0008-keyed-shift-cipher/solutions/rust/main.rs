use std::io::{self, Read, Write};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    // 暗号文には空白が続くことがあるので、行で読む（行末の \r だけ落とす）
    let mut lines = input.split('\n');
    let key: Vec<i32> = lines.next().unwrap().trim().bytes().map(|b| (b - b'a') as i32).collect();
    let s = lines.next().unwrap().trim_end_matches('\r').as_bytes();
    let m = key.len();
    let mut out = Vec::with_capacity(s.len() + 1);
    let mut j = 0; // 鍵の位置。英字を 1 文字戻したときだけ進める
    for &ch in s {
        let base = match ch {
            b'a'..=b'z' => b'a',
            b'A'..=b'Z' => b'A',
            _ => {
                out.push(ch);
                continue;
            }
        };
        // u8 の引き算は負にできないので i32 に広げ、rem_euclid で 0..26 に収める
        let v = (ch as i32 - base as i32 - key[j % m]).rem_euclid(26);
        out.push(base + v as u8);
        j += 1;
    }
    out.push(b'\n');
    io::stdout().write_all(&out).unwrap();
}
