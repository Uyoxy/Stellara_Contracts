# Stellara Search - migration_samples/search

This folder contains reference artifacts for integrating OpenSearch into Stellara and a minimal search service.

Components
- `opensearch/` - example index mappings for `academy`, `posts`, and `trading` indices.
- `docker-compose.yml` - local OpenSearch + Dashboards for testing.
- `search_service/` - Rust `axum` service that forwards query DSL to OpenSearch.
- `indexer/` - simple Rust bulk indexer that ingests JSONL via the OpenSearch bulk API.
- `benchmarks/` - `k6` scripts to simulate search traffic.
- `grafana/` - dashboard skeleton for search metrics.

Quickstart (local)

1. Start OpenSearch and Dashboards:

```bash
cd "migration_samples/search"
docker-compose up -d
```

2. Create index with mapping (example for posts):

```bash
curl -XPUT "http://localhost:9200/posts" -H 'Content-Type: application/json' --data-binary @opensearch/mappings_posts.json
```

3. Bulk index sample data with the indexer (requires Rust):

```bash
cd migration_samples/search/indexer
cargo run --release -- -- (or set env: OPENSEARCH_URL, SEARCH_INDEX, BULK_FILE)
```

4. Run search service:

```bash
cd migration_samples/search/search_service
OPENSEARCH_URL=http://localhost:9200 SEARCH_INDEX=posts cargo run
```

5. Run k6 benchmark (requires k6):

```bash
k6 run migration_samples/search/benchmarks/search_k6.js
```

Notes
- This is a scaffold and reference implementation. For production, use secure OpenSearch deployment, TLS, auth, and stronger ingestion (Debezium/Kafka or NATS JetStream). Tune analyzers, shard counts, replicas, and refresh intervals to meet the 100ms P95 goal.
