use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace();
    let h: usize = it.next().unwrap().parse().unwrap();
    let w: usize = it.next().unwrap().parse().unwrap();
    let b: usize = it.next().unwrap().parse().unwrap();
    let g: Vec<u8> = (0..h).flat_map(|_| it.next().unwrap().bytes()).collect(); // マス v = r*w + c
    let start = g.iter().position(|&x| x == b'S').unwrap();
    let goal = g.iter().position(|&x| x == b'G').unwrap();
    let k = b + 1;
    // 状態 = (マス, 残り) を v*k + e の 1 つの整数に。マスだけで訪問済みにすると充電の遠回りを捨てる
    let mut dist = vec![-1i32; h * w * k];
    let mut queue: Vec<u32> = Vec::with_capacity(h * w * k);
    dist[start * k + b] = 0;
    queue.push((start * k + b) as u32);
    let mut head = 0;
    while head < queue.len() {
        let s = queue[head] as usize;
        head += 1;
        let (v, e) = (s / k, s % k);
        if e == 0 {
            continue; // 電池切れ: 動けない
        }
        let d = dist[s] + 1;
        let (r, c) = (v / w, v % w);
        let nbs = [
            if r > 0 { Some(v - w) } else { None },
            if r + 1 < h { Some(v + w) } else { None },
            if c > 0 { Some(v - 1) } else { None },
            if c + 1 < w { Some(v + 1) } else { None },
        ];
        for u in nbs.into_iter().flatten() {
            if g[u] == b'#' {
                continue;
            }
            if u == goal {
                println!("{}", d); // 残り 0 で着いてもよい。BFS なので最初に着いた手数が最短
                return;
            }
            let t = u * k + if g[u] == b'C' { b } else { e - 1 };
            if dist[t] == -1 {
                dist[t] = d;
                queue.push(t as u32);
            }
        }
    }
    println!("-1");
}
