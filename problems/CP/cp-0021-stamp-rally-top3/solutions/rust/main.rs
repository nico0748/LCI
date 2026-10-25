use std::collections::{HashMap, HashSet};
use std::io::{self, BufWriter, Read, Write};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace();
    let n: usize = it.next().unwrap().parse().unwrap();
    let m: usize = it.next().unwrap().parse().unwrap();
    let points: Vec<i64> = (0..m).map(|_| it.next().unwrap().parse().unwrap()).collect();
    let mut seen: HashSet<(&str, usize)> = HashSet::new(); // (名前, 地点) を 1 回だけ数える
    let mut score: HashMap<&str, i64> = HashMap::new();
    for _ in 0..n {
        let name = it.next().unwrap();
        let c: usize = it.next().unwrap().parse().unwrap();
        if !seen.insert((name, c)) {
            continue;
        }
        *score.entry(name).or_insert(0) += points[c - 1];
    }
    // 得点の降順、同点は名前の昇順（&str の比較はバイト順 = 英小文字の辞書順）
    let mut rows: Vec<(&str, i64)> = score.into_iter().collect();
    rows.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(b.0)));
    let mut out = BufWriter::new(io::stdout().lock());
    for (name, s) in rows.iter().take(3) {
        writeln!(out, "{} {}", name, s).unwrap();
    }
}
