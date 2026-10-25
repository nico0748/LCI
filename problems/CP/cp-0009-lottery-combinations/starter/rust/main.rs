use std::io::{self, BufWriter, Read, Write};

fn main() {
    // 標準入力をまとめて読む（read_line を繰り返すより速い）
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    // 出力は BufWriter に溜めて最後に flush する
    let stdout = io::stdout();
    let mut out = BufWriter::new(stdout.lock());
    // 例: let mut it = input.split_ascii_whitespace();
    //     let n: usize = it.next().unwrap().parse().unwrap();
    //     行ごとに読むなら input.lines()
    // TODO: 入力を解析して答えを求め、writeln!(out, "{}", ans).unwrap(); で出力する
    out.flush().unwrap();
}
