                ┌───────────────────────────┐
                │         Clients           │
                │ (Web, Mobile, External)   │
                └─────────────┬─────────────┘
                              │
                              ▼
                ┌───────────────────────────┐
                │        API Gateway        │
                │ (Routing, Auth, Rate Lim.)│
                └─────────────┬─────────────┘
                              │
                              ▼
                ┌───────────────────────────┐
                │       Service Mesh        │
                │ (mTLS, RBAC, Observability)│
                └─────────────┬─────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
 ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
 │   Backend Svc  │   │   Auth Svc     │   │   Payment Svc   │
 │ (NestJS APIs)  │   │ (JWT/OAuth2)   │   │ (Transactions) │
 └────────────────┘   └────────────────┘   └────────────────┘
          │                   │                   │
          └─────────── Mesh Sidecars ─────────────┘
                              │
                              ▼
                ┌───────────────────────────┐
                │     Observability Stack   │
                │ (Prometheus, Grafana,     │
                │  Jaeger, Central Logging) │
                └───────────────────────────┘
