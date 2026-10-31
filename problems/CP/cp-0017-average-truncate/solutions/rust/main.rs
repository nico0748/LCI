use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace();
    let n: i64 = it.next().unwrap().parse().unwrap();
    let people: Vec<(&str, i64)> = (0..n).map(|_| (it.next().unwrap(), it.next().unwrap().parse().unwrap())).collect();
    let total: i64 = people.iter().map(|p| p.1).sum();
    // 整数だけで: 平均×10 の切り捨て（format!("{:.1}") は丸めるので使わない）
    let v = total * 10 / n;
    let mut out = format!("{}.{}\n", v / 10, v % 10);
    // 「平均以上」は正確な平均と比べる: score >= total/n ⇔ score*n >= total
    for (name, score) in &people {
        if score * n >= total {
            out.push_str(name);
            out.push('\n');
        }
    }
    print!("{}", out);
}
