use std::collections::HashMap;
use std::io::{self, Read};

fn main() {
    let mut s = String::new();
    io::stdin().read_to_string(&mut s).unwrap();
    let mut it = s.split_ascii_whitespace().map(|t| t.parse::<i64>().unwrap());
    let n = it.next().unwrap() as usize;
    let k = it.next().unwrap();
    let mut seen: HashMap<i64, usize> = HashMap::with_capacity(n);
    for j in 0..n {
        let x = it.next().unwrap();
        if let Some(&i) = seen.get(&(k - x)) {
            println!("{} {}", i + 1, j + 1);
            return;
        }
        seen.entry(x).or_insert(j);
    }
    println!("-1");
}
