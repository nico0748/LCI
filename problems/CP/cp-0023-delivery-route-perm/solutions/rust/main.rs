use std::io::{self, Read};

struct Search {
    n: usize,
    need: Vec<u32>, // need[b]: b より先に訪れる地点の集合（ビット）
    d: Vec<Vec<f64>>,
    best: f64,
}

impl Search {
    // 使用済みの集合 mask（ビット 0 は営業所）を持ち、条件を満たす地点だけを次に置く再帰で順列を列挙する
    fn dfs(&mut self, last: usize, mask: u32, placed: usize, acc: f64) {
        if placed == self.n {
            let total = acc + self.d[last][0];
            if total < self.best {
                self.best = total;
            }
            return;
        }
        for v in 1..=self.n {
            if mask >> v & 1 == 1 || self.need[v] & !mask != 0 {
                continue;
            }
            let step = self.d[last][v];
            self.dfs(v, mask | 1 << v, placed + 1, acc + step);
        }
    }
}

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut it = input.split_ascii_whitespace().map(|x| x.parse::<i64>().unwrap());
    let n = it.next().unwrap() as usize;
    let m = it.next().unwrap() as usize;
    let pts: Vec<(f64, f64)> = (0..=n).map(|_| (it.next().unwrap() as f64, it.next().unwrap() as f64)).collect();
    let mut need = vec![0u32; n + 1];
    for _ in 0..m {
        let a = it.next().unwrap() as usize;
        let b = it.next().unwrap() as usize;
        need[b] |= 1 << a;
    }
    let d = pts.iter().map(|p| pts.iter().map(|q| (p.0 - q.0).hypot(p.1 - q.1)).collect()).collect();
    let mut s = Search { n, need, d, best: f64::INFINITY };
    s.dfs(0, 1, 0, 0.0);
    println!("{:.10}", s.best);
}
