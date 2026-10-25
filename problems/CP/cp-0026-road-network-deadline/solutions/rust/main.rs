use std::cmp::Reverse;
use std::collections::BinaryHeap;
use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|x| x.parse::<i64>().unwrap());
    let n = it.next().unwrap() as usize;
    let m = it.next().unwrap() as usize;
    let t = it.next().unwrap(); // 最大 10^12 なので i64
    let mut adj: Vec<Vec<(usize, i64)>> = vec![Vec::new(); n + 1];
    for _ in 0..m {
        let u = it.next().unwrap() as usize;
        let v = it.next().unwrap() as usize;
        let w = it.next().unwrap();
        adj[u].push((v, w));
        adj[v].push((u, w));
    }
    // BinaryHeap は最大ヒープなので Reverse で最小ヒープにする
    let mut dist: Vec<i64> = vec![i64::MAX; n + 1];
    dist[1] = 0;
    let mut pq = BinaryHeap::new();
    pq.push(Reverse((0i64, 1usize)));
    while let Some(Reverse((d, u))) = pq.pop() {
        if d > dist[u] {
            continue; // 古い要素は捨てる
        }
        for &(v, w) in &adj[u] {
            let nd = d + w;
            if nd < dist[v] {
                dist[v] = nd;
                pq.push(Reverse((nd, v)));
            }
        }
    }
    let within = dist[1..].iter().filter(|&&d| d <= t).count();
    let last = if dist[n] == i64::MAX { -1 } else { dist[n] };
    println!("{}\n{}", within, last);
}
