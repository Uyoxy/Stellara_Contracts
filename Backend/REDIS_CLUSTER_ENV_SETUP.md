# Redis Cluster Environment Configuration

## Environment Variables Reference

Copy and customize for your environment:

```bash
## ============================================================
## Redis Cluster Configuration
## ============================================================

# Cluster node addresses (comma-separated)
# Can be DNS names or IP addresses with ports
REDIS_CLUSTER_NODES=redis-master-1:6379,redis-master-2:6380,redis-master-3:6381

# Enable cluster mode detection
REDIS_ENABLE_CLUSTER=true

# Sharding strategy: 'consistent-hash' or 'key-range'
REDIS_SHARDING_STRATEGY=consistent-hash

# Enable sharding (set to false for testing)
REDIS_ENABLE_SHARDING=true

## ============================================================
## Connection and Retry Settings
## ============================================================

# Connection pool size per cluster node
REDIS_CONNECTION_POOL_SIZE=10

# Maximum retry attempts for failed operations
REDIS_MAX_RETRIES=5

# Maximum retries specifically for read operations
REDIS_MAX_RETRIES_READ_KEY=3

# Initial retry delay in milliseconds
REDIS_RETRY_INITIAL_DELAY_MS=100

# Maximum retry delay in milliseconds (exponential backoff cap)
REDIS_RETRY_MAX_DELAY_MS=3000

# Exponential backoff multiplier
REDIS_RETRY_BACKOFF_MULTIPLIER=2

## ============================================================
## Cache Configuration
## ============================================================

# Enable caching
CACHE_ENABLED=true

# Default TTL for cache entries (seconds)
CACHE_DEFAULT_TTL=3600

# Default cache strategy: 'cache-aside', 'write-through', 'write-behind'
CACHE_DEFAULT_STRATEGY=cache-aside

# Enable cache compression for entries > threshold
CACHE_COMPRESSION_ENABLED=true

# Compression threshold in bytes
CACHE_COMPRESSION_THRESHOLD=1024

# Enable write-through caching
CACHE_WRITE_THROUGH_ENABLED=true

# Enable write-behind caching
CACHE_WRITE_BEHIND_ENABLED=false

# Warm up cache on startup
CACHE_WARMUP_ON_STARTUP=true

# Enable scheduled cache warming
CACHE_SCHEDULED_WARMUP_ENABLED=true

# Maximum batch size for cache operations
CACHE_MAX_BATCH_SIZE=100

# Enable pipeline for batch operations
CACHE_PIPELINE_ENABLED=true

## ============================================================
## Monitoring and Health Checks
## ============================================================

# Enable Redis metrics collection
REDIS_CLUSTER_METRICS=true

# Enable cache monitoring
CACHE_MONITORING_ENABLED=true

# Health check interval in milliseconds
REDIS_HEALTH_CHECK_INTERVAL=30000

# Enable cluster health monitoring
CLUSTER_HEALTH_MONITORING_ENABLED=true

# Enable automatic consistency checking
CACHE_CONSISTENCY_MONITORING_ENABLED=true

# Consistency check interval in milliseconds
CACHE_CONSISTENCY_CHECK_INTERVAL=300000

## ============================================================
## Cluster-Specific Settings
## ============================================================

# Number of parallel shard operations for warmup
CLUSTER_WARMUP_PARALLEL_SHARDS=3

# Enable replica-aware operations
CLUSTER_REPLICA_AWARE=true

# Check consistency after cache warming
CLUSTER_CHECK_CONSISTENCY_AFTER_WARMUP=true

# Rollback on warmup failure
CLUSTER_ROLLBACK_ON_FAILURE=false

## ============================================================
## Performance Tuning
## ============================================================

# Maximum memory per Redis node
REDIS_MAX_MEMORY=1gb

# Memory eviction policy
REDIS_MAX_MEMORY_POLICY=allkeys-lru

# TCP backlog
REDIS_TCP_BACKLOG=511

# TCP keepalive in seconds
REDIS_TCP_KEEPALIVE=300

# Client output buffer limits (normal|replica|pubsub)
REDIS_CLIENT_OUTPUT_BUFFER_LIMIT_NORMAL=0_0_0
REDIS_CLIENT_OUTPUT_BUFFER_LIMIT_REPLICA=256mb_64mb_60
REDIS_CLIENT_OUTPUT_BUFFER_LIMIT_PUBSUB=32mb_8mb_60

## ============================================================
## Logging and Debugging
## ============================================================

# Redis log level: 'debug', 'verbose', 'notice', 'warning'
REDIS_LOG_LEVEL=notice

# Enable debug logging for cache operations
CACHE_DEBUG_LOGGING=false

# Enable debug logging for cluster operations
CLUSTER_DEBUG_LOGGING=false

# Log slow queries slower than (microseconds)
REDIS_SLOWLOG_THRESHOLD=10000

# Maximum slow log entries
REDIS_SLOWLOG_MAX_LEN=128

## ============================================================
## Development vs Production
## ============================================================

# Node environment
NODE_ENV=production

# Enable dev tools (should be false in production)
DEBUG_REDIS=false
DEBUG_CACHE=false
DEBUG_CLUSTER=false

## ============================================================
## Docker Compose Defaults
## ============================================================

# Default compose file
COMPOSE_FILE=docker-compose.redis-cluster.yml

# Redis image version
REDIS_VERSION=7-alpine

# Prometheus data retention
PROMETHEUS_RETENTION=30d
```

## Development Setup (.env.dev)

```bash
REDIS_CLUSTER_NODES=localhost:6379,localhost:6380,localhost:6381
REDIS_ENABLE_CLUSTER=true
CACHE_ENABLED=true
CACHE_WARMUP_ON_STARTUP=true
REDIS_CLUSTER_METRICS=true
CACHE_DEBUG_LOGGING=true
CLUSTER_DEBUG_LOGGING=true
NODE_ENV=development
DEBUG_REDIS=true
DEBUG_CACHE=true
DEBUG_CLUSTER=true
```

## Staging Setup (.env.staging)

```bash
REDIS_CLUSTER_NODES=redis-staging-1:6379,redis-staging-2:6380,redis-staging-3:6381
REDIS_ENABLE_CLUSTER=true
REDIS_CONNECTION_POOL_SIZE=20
REDIS_MAX_RETRIES=10
CACHE_ENABLED=true
CACHE_WARMUP_ON_STARTUP=true
REDIS_CLUSTER_METRICS=true
CLUSTER_REPLICA_AWARE=true
CLUSTER_CHECK_CONSISTENCY_AFTER_WARMUP=true
CACHE_CONSISTENCY_MONITORING_ENABLED=true
NODE_ENV=staging
DEBUG_REDIS=false
DEBUG_CACHE=false
DEBUG_CLUSTER=false
```

## Production Setup (.env.production)

```bash
REDIS_CLUSTER_NODES=redis-prod-1:6379,redis-prod-2:6380,redis-prod-3:6381,redis-prod-4:6382,redis-prod-5:6383,redis-prod-6:6384
REDIS_ENABLE_CLUSTER=true
REDIS_CONNECTION_POOL_SIZE=50
REDIS_MAX_RETRIES=5
REDIS_RETRY_INITIAL_DELAY_MS=200
REDIS_RETRY_MAX_DELAY_MS=5000
CACHE_ENABLED=true
CACHE_WARMUP_ON_STARTUP=true
CACHE_DEFAULT_TTL=7200
CACHE_COMPRESSION_ENABLED=true
REDIS_CLUSTER_METRICS=true
REDIS_HEALTH_CHECK_INTERVAL=60000
CLUSTER_REPLICA_AWARE=true
CLUSTER_CHECK_CONSISTENCY_AFTER_WARMUP=true
CACHE_CONSISTENCY_MONITORING_ENABLED=true
CACHE_CONSISTENCY_CHECK_INTERVAL=600000
CLUSTER_WARMUP_PARALLEL_SHARDS=6
REDIS_MAX_MEMORY=32gb
NODE_ENV=production
DEBUG_REDIS=false
DEBUG_CACHE=false
DEBUG_CLUSTER=false
```

## High-Performance Setup (.env.highperf)

```bash
# For applications requiring maximum throughput
REDIS_CLUSTER_NODES=redis-hp-1:6379,redis-hp-2:6380,redis-hp-3:6381,redis-hp-4:6382,redis-hp-5:6383,redis-hp-6:6384,redis-hp-7:6385,redis-hp-8:6386
REDIS_ENABLE_CLUSTER=true
REDIS_CONNECTION_POOL_SIZE=100
REDIS_MAX_RETRIES=3
REDIS_RETRY_INITIAL_DELAY_MS=50
REDIS_RETRY_MAX_DELAY_MS=1000
REDIS_RETRY_BACKOFF_MULTIPLIER=1.5
CACHE_ENABLED=true
CACHE_DEFAULT_TTL=10800
CACHE_COMPRESSION_ENABLED=true
CACHE_COMPRESSION_THRESHOLD=2048
CACHE_PIPELINE_ENABLED=true
CACHE_MAX_BATCH_SIZE=500
CACHE_WRITE_THROUGH_ENABLED=true
REDIS_CLUSTER_METRICS=true
REDIS_HEALTH_CHECK_INTERVAL=120000
CLUSTER_WARMUP_PARALLEL_SHARDS=8
CLUSTER_REPLICA_AWARE=true
REDIS_MAX_MEMORY=64gb
REDIS_TCP_BACKLOG=2048
NODE_ENV=production
DEBUG_REDIS=false
```

## How to Use

### 1. Select Environment

```bash
# Development
cp .env.dev .env
npm run start:dev

# Staging
cp .env.staging .env
npm run build && npm run start

# Production
cp .env.production .env
npm run build && npm run start:prod
```

### 2. With Docker Compose

```bash
# Load from .env file
docker-compose --env-file .env.production -f docker-compose.redis-cluster.yml up -d

# Or set inline
docker-compose -e REDIS_CLUSTER_NODES=host1:6379,host2:6380,host3:6381 up -d
```

### 3. Kubernetes Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stellara-backend
spec:
  template:
    spec:
      containers:
      - name: app
        image: stellara:latest
        env:
        - name: REDIS_CLUSTER_NODES
          valueFrom:
            configMapKeyRef:
              name: redis-config
              key: cluster-nodes
        - name: NODE_ENV
          value: production
        - name: REDIS_CONNECTION_POOL_SIZE
          value: "50"
```

### 4. Verify Configuration

```bash
# Test Redis connectivity with configured nodes
npm run redis:test

# Verify cluster health
npm run redis:cluster-info

# Check cache configuration
npm run cache:status
```

## Configuration Management

### Load from File

```bash
# Load from custom env file
source .env.production
npm run start

# Using dotenv CLI
dotenv -e .env.production -- npm run start
```

### Load from Environment Variables

```bash
# Directly set
export REDIS_CLUSTER_NODES='localhost:6379,localhost:6380,localhost:6381'
npm run start

# Using AWS Systems Manager Parameter Store
aws ssm get-parameter --name /app/redis-nodes --query 'Parameter.Value'
```

### Load from ConfigMaps (Kubernetes)

```bash
kubectl create configmap redis-config \
  --from-literal=cluster-nodes='redis-1:6379,redis-2:6380,redis-3:6381'

kubectl set env deployment/stellara-backend \
  --from=configmap/redis-config
```

## Validation and Testing

### Test Configuration

```bash
# Create test.env with custom values
cat > test.env << EOF
REDIS_CLUSTER_NODES=localhost:6379,localhost:6380,localhost:6381
REDIS_ENABLE_CLUSTER=true
CACHE_ENABLED=true
EOF

# Test Redis connection
dotenv -e test.env -- npm run test:redis

# Test cache functions
dotenv -e test.env -- npm run test:cache

# Full integration test
dotenv -e test.env -- npm run test:integration
```

### Configuration Validation

```bash
# Validate YAML/env format
yq eval '.redis' .env.production

# Check for missing required variables
grep -E "REDIS_|CACHE_|CLUSTER_" .env | wc -l

# Print active configuration
npm run config:show
```

## Migration Between Environments

### Stage to Production

```bash
# Export current staging config
npm run config:export > config-backup.json

# Verify production config
diff .env.staging .env.production

# Activate production
cp .env.production .env
npm run build
npm run start:prod

# Verify health
curl http://localhost:3000/api/health/cluster
```

## Security Considerations

### Production Security

```bash
# Don't store in version control
echo ".env.production" >> .gitignore
echo ".env.*.local" >> .gitignore

# Use encrypted env files
openssl enc -aes-256-cbc -in .env.production -out .env.production.enc

# Use secrets management
aws secretsmanager create-secret --name redis/production --secret-string file://.env.production

# Or with HashiCorp Vault
vault kv put secret/stellara/redis @.env.production
```

### Access Control

```yaml
# Kubernetes RBAC
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: redis-reader
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  resourceNames: ["redis-config"]
  verbs: ["get"]
```

---

For more information, see:
- [REDIS_CLUSTER_IMPLEMENTATION.md](Backend/docs/REDIS_CLUSTER_IMPLEMENTATION.md)
- [REDIS_CLUSTER_QUICK_START.md](Backend/REDIS_CLUSTER_QUICK_START.md)
- [REDIS_CLUSTER_EXAMPLES.md](Backend/REDIS_CLUSTER_EXAMPLES.md)
