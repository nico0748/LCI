use std::fmt::Write as _;
use std::io::{self, Read, Write};

fn is_leap(y: i32) -> bool {
    y % 4 == 0 && (y % 100 != 0 || y % 400 == 0)
}

fn days_in(y: i32, m: i32) -> i32 {
    match m {
        2 => {
            if is_leap(y) {
                29
            } else {
                28
            }
        }
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    }
}

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace();
    let q: usize = it.next().unwrap().parse().unwrap();
    let mut out = String::with_capacity(q * 11);
    for _ in 0..q {
        let s = it.next().unwrap();
        let k: i32 = it.next().unwrap().parse().unwrap();
        let y: i32 = s[0..4].parse().unwrap();
        let m: i32 = s[5..7].parse().unwrap();
        let d: i32 = s[8..10].parse().unwrap();
        let idx = y * 12 + (m - 1) + k; // 月の通し番号（0 始まり）で k か月進める
        let (ty, tm) = (idx / 12, idx % 12 + 1);
        let last = days_in(ty, tm);
        let (ey, em, ed) = if d > last {
            (ty, tm, last) // 同じ日が無い → その月の末日
        } else if d > 1 {
            (ty, tm, d - 1) // 同じ日の前日
        } else {
            let (py, pm) = if tm > 1 { (ty, tm - 1) } else { (ty - 1, 12) }; // 1 日の前日は前の月の末日
            (py, pm, days_in(py, pm))
        };
        writeln!(out, "{:04}/{:02}/{:02}", ey, em, ed).unwrap();
    }
    io::stdout().write_all(out.as_bytes()).unwrap();
}
