use anyhow::Result;
use reqwest::Client;
use serde_json::Value;
use std::{env, fs::File, io::{BufRead, BufReader}};

#[tokio::main]
async fn main() -> Result<()> {
    let opensearch = env::var("OPENSEARCH_URL").unwrap_or_else(|_| "http://localhost:9200".to_string());
    let index = env::var("SEARCH_INDEX").unwrap_or_else(|_| "posts".to_string());
    let file = env::var("BULK_FILE").unwrap_or_else(|_| "./sample_posts.jsonl".to_string());

    let client = Client::new();
    let f = File::open(&file)?;
    let reader = BufReader::new(f);

    let mut bulk = String::new();
    let mut count = 0;
    for line in reader.lines() {
        let l = line?;
        if l.trim().is_empty() { continue; }
        // Bulk action header
        let v: Value = serde_json::from_str(&l)?;
        let id = v.get("id").and_then(|x| x.as_str()).unwrap_or("");
        let action = serde_json::json!({ "index": { "_index": index, "_id": id }});
        bulk.push_str(&serde_json::to_string(&action)?);
        bulk.push('\n');
        bulk.push_str(&l);
        bulk.push('\n');
        count += 1;

        if count % 1000 == 0 {
            let url = format!("{}/_bulk", opensearch.trim_end_matches('/'));
            let res = client.post(&url).body(bulk.clone()).send().await?;
            println!("bulk response: {}", res.status());
            bulk.clear();
        }
    }

    if !bulk.is_empty() {
        let url = format!("{}/_bulk", opensearch.trim_end_matches('/'));
        let res = client.post(&url).body(bulk.clone()).send().await?;
        println!("final bulk response: {}", res.status());
    }

    Ok(())
}
