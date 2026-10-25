use std::io::{self, Read, Write};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|s| s.parse::<usize>().unwrap());
    let n = it.next().unwrap();
    let m = it.next().unwrap();
    let mut edges = Vec::with_capacity(m);
    let mut indeg = vec![0u32; n + 1];
    let mut start = vec![0usize; n + 2]; // CSR: u の出辺は adj[start[u]..start[u+1]]
    for _ in 0..m {
        let u = it.next().unwrap();
        let v = it.next().unwrap();
        edges.push((u, v));
        start[u + 1] += 1;
        indeg[v] += 1; // 重複した辺もそのまま数える
    }
    for u in 1..=n + 1 {
        start[u] += start[u - 1];
    }
    let mut fill = start.clone();
    let mut adj = vec![0usize; m];
    for &(u, v) in &edges {
        adj[fill[u]] = v;
        fill[u] += 1;
    }
    // 段ごとの Kahn 法（再帰は使わない）
    let mut queue: Vec<usize> = (1..=n).filter(|&v| indeg[v] == 0).collect();
    let mut counts = Vec::new();
    let mut lo = 0;
    while lo < queue.len() {
        let hi = queue.len();
        counts.push(hi - lo);
        while lo < hi {
            let u = queue[lo];
            for &v in &adj[start[u]..start[u + 1]] {
                indeg[v] -= 1;
                if indeg[v] == 0 {
                    queue.push(v);
                }
            }
            lo += 1;
        }
    }
    let mut out = String::new();
    if queue.len() < n {
        out.push_str("-1\n");
    } else {
        out.push_str(&format!("{}\n", counts.len()));
        let line: Vec<String> = counts.iter().map(|c| c.to_string()).collect();
        out.push_str(&line.join(" "));
        out.push('\n');
    }
    io::stdout().write_all(out.as_bytes()).unwrap();
}
