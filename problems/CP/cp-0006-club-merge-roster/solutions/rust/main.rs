use std::fmt::Write as _;
use std::io::{self, Read, Write};

/// 根を返す。再帰にしない。経路半減で木を浅く保つ
fn find(parent: &mut [usize], mut x: usize) -> usize {
    while parent[x] != x {
        parent[x] = parent[parent[x]];
        x = parent[x];
    }
    x
}

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|s| s.parse::<usize>().unwrap());
    let n = it.next().unwrap();
    let q = it.next().unwrap();
    let mut parent: Vec<usize> = (0..=n).collect();
    let mut size = vec![1usize; n + 1];
    let mut out = String::new();
    for _ in 0..q {
        let t = it.next().unwrap();
        if t == 2 {
            let a = it.next().unwrap();
            let r = find(&mut parent, a);
            writeln!(out, "{}", size[r]).unwrap();
            continue;
        }
        let (a, b) = (it.next().unwrap(), it.next().unwrap());
        let (mut ra, mut rb) = (find(&mut parent, a), find(&mut parent, b));
        if t == 1 {
            if ra != rb {
                // 既に同じ組なら何もしない。小さい組を大きい組の下に付ける
                if size[ra] < size[rb] {
                    std::mem::swap(&mut ra, &mut rb);
                }
                parent[rb] = ra;
                size[ra] += size[rb];
            }
        } else {
            out.push_str(if ra == rb { "Yes\n" } else { "No\n" });
        }
    }
    io::stdout().write_all(out.as_bytes()).unwrap();
}
