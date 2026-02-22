use axum::{extract::Json, http::StatusCode, routing::post, Router};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;
use tracing_subscriber;

#[derive(Debug, Deserialize)]
struct SearchRequest {
    query: String,
    filters: Option<serde_json::Value>,
    from: Option<u32>,
    size: Option<u32>
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let app = Router::new().route("/v1/search", post(handle_search));

    let port = env::var("PORT").unwrap_or_else(|_| "8081".to_string());
    let addr = format!("0.0.0.0:{}", port);

    tracing::info!("Starting search service on {}", addr);
    axum::Server::bind(&addr.parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap();
}

async fn handle_search(Json(payload): Json<SearchRequest>) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let opensearch = env::var("OPENSEARCH_URL").unwrap_or_else(|_| "http://localhost:9200".to_string());
    let index = env::var("SEARCH_INDEX").unwrap_or_else(|_| "posts".to_string());

    // Build a basic OpenSearch/Elasticsearch query
    let mut query_body = serde_json::json!({
        "from": payload.from.unwrap_or(0),
        "size": payload.size.unwrap_or(20),
        "query": {
            "bool": {
                "must": [
                    { "multi_match": { "query": payload.query, "fields": ["title^3","content","body"] } }
                ]
            }
        }
    });

    if let Some(filters) = payload.filters {
        // Attach filters as filter clause
        query_body["query"]["bool"]["filter"] = serde_json::Value::Array(vec![filters]);
    }

    let client = Client::new();
    let url = format!("{}/{}/_search", opensearch.trim_end_matches('/'), index);
    let res = client.post(&url).json(&query_body).send().await.map_err(|e| (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse { error: format!("upstream error: {}", e) })
    ))?;

    let json: serde_json::Value = res.json().await.map_err(|e| (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse { error: format!("invalid upstream response: {}", e) })
    ))?;

    Ok(Json(json))
}
