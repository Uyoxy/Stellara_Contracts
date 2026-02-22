# Redis Cluster Integration Examples

## Complete Integration Guide with Real-World Scenarios

### 1. Initialize Services in Your Module

```typescript
// app.module.ts or feature.module.ts
import { Module } from '@nestjs/common';
import { CacheModule } from './cache/cache.module';
import { UserService } from './user/user.service';

@Module({
  imports: [CacheModule],
  providers: [UserService],
})
export class AppModule {}
```

### 2. Basic Cache Operations with Cluster

```typescript
// user.service.ts
import { Injectable } from '@nestjs/common';
import { CacheService } from './cache/cache.service';

@Injectable()
export class UserService {
  constructor(private cacheService: CacheService) {}

  async getUser(userId: string) {
    // Automatically uses cluster sharding
    return this.cacheService.get(
      `user:${userId}:profile`,
      () => this.fetchUserFromDB(userId),
      {
        ttl: 3600, // 1 hour
        tags: ['user', 'profile'],
        strategy: 'cache-aside',
      }
    );
  }

  async updateUser(userId: string, data: any) {
    // Write-through strategy ensures consistency
    return this.cacheService.set(
      `user:${userId}:profile`,
      data,
      {
        ttl: 3600,
        tags: ['user', 'profile'],
        strategy: 'write-through',
      }
    );
  }

  async deleteUser(userId: string) {
    // Invalidate from cache
    await this.cacheService.delete(`user:${userId}:profile`);
    await this.cacheService.invalidateByTag('user', [userId]);
  }

  private async fetchUserFromDB(userId: string) {
    // Original database fetch
    return { id: userId, name: 'User' };
  }
}
```

### 3. Cache Warming on Application Startup

```typescript
// app.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { CacheWarmingService } from './cache/cache-warming.service';
import { ClusterCacheWarmingService } from './cache/cluster-cache-warming.service';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(
    private cacheWarmingService: CacheWarmingService,
    private clusterWarmingService: ClusterCacheWarmingService,
    private configService: ConfigService,
    private ratesService: RatesService,
  ) {}

  async onModuleInit() {
    await this.setupCacheWarming();
  }

  private async setupCacheWarming() {
    // Register critical data warmup group
    await this.cacheWarmingService.registerWarmupGroup({
      name: 'critical-data',
      enabled: true,
      entries: [
        {
          key: 'config:app',
          loader: () => this.configService.loadAppConfig(),
          ttl: 86400, // 24 hours
          priority: 'high',
          schedule: 'startup',
          tags: ['config', 'system'],
        },
        {
          key: 'rates:stellar',
          loader: () => this.ratesService.getStellarRates(),
          ttl: 300, // 5 minutes
          priority: 'high',
          schedule: 'startup',
          tags: ['rates', 'market-data'],
        },
        {
          key: 'currencies:list',
          loader: () => this.ratesService.getCurrencyList(),
          ttl: 86400,
          priority: 'medium',
          schedule: 'daily',
          tags: ['currencies', 'reference'],
        },
      ],
    });

    // Register hourly data warmup
    await this.cacheWarmingService.registerWarmupGroup({
      name: 'hourly-data',
      enabled: true,
      entries: [
        {
          key: 'stats:hourly',
          loader: () => this.statsService.getHourlyStats(),
          ttl: 3600,
          priority: 'medium',
          schedule: 'hourly',
          tags: ['stats', 'analytics'],
        },
      ],
    });

    // Perform distributed warmup across cluster
    try {
      const stats = await this.clusterWarmingService.performDistributedWarmup(
        'critical-data',
        {
          parallelShards: 3, // Warm 3 shards in parallel
          replicaAware: true, // Consider replica lagging
          checkConsistency: true, // Validate after warmup
          rollbackOnFailure: false, // Allow partial warmup
        }
      );

      console.log(`Cache warmup: ${stats.totalDuration}ms`);
      console.log(`Success rate: ${Object.values(stats.successPerShard)}`);
    } catch (error) {
      console.error('Cache warmup failed:', error);
      // Application can continue with cache miss fallback
    }
  }
}
```

### 4. Consistency Verification on Writes

```typescript
// payment.service.ts
import { Injectable } from '@nestjs/common';
import { CacheConsistencyService } from './cache/cache-consistency.service';

@Injectable()
export class PaymentService {
  constructor(
    private consistencyService: CacheConsistencyService,
  ) {}

  async recordPayment(transactionId: string, details: any) {
    const key = `transaction:${transactionId}`;

    // Record write with version tracking
    const versionInfo = await this.consistencyService.trackWrite(
      key,
      details,
    );

    console.log(`Payment recorded: v${versionInfo.version}`);

    // Verify consistency immediately
    const consistency = await this.consistencyService.verifyConsistency(key);
    
    if (!consistency.consistent) {
      console.warn(`Consistency check failed for ${key}`);
      // Resolution happens automatically via LWW strategy
    }

    return versionInfo;
  }

  async getPaymentHistory(userId: string) {
    // Get all payment keys for user
    const keys = ['payment:user:' + userId + ':*'];
    
    // Audit subset for consistency
    const audit = await this.consistencyService.performAudit(
      `payment:user:${userId}:*`
    );

    if (audit.inconsistentKeys.length > 0) {
      console.warn(
        `Found ${audit.inconsistentKeys.length} inconsistent payments`
      );
    }

    return audit;
  }

  async enableRealTimeConsistencyMonitoring() {
    // Start checking consistency every 5 minutes
    this.consistencyService.startConsistencyMonitoring(300000);
  }
}
```

### 5. Health Monitoring and Alerting

```typescript
// monitoring.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ClusterHealthMonitoringService } from './cache/cluster-health-monitoring.service';

@Controller('api/health')
export class HealthController {
  constructor(
    private healthMonitoring: ClusterHealthMonitoringService,
  ) {}

  @Get('cluster')
  async getClusterHealth() {
    return this.healthMonitoring.getClusterHealthSummary();
  }

  @Get('metrics')
  async getMetrics() {
    const history = this.healthMonitoring.getMetricsHistory(24);
    return {
      metrics: history,
      latest: history[history.length - 1],
    };
  }

  @Get('alerts')
  async getAlerts() {
    const alerts = this.healthMonitoring.getActiveAlerts();
    return {
      totalAlerts: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical'),
      high: alerts.filter(a => a.severity === 'high'),
      medium: alerts.filter(a => a.severity === 'medium'),
    };
  }

  @Get('alerts/:alertId/resolve')
  async resolveAlert(alertId: string) {
    await this.healthMonitoring.resolveAlert(alertId);
    return { success: true };
  }
}
```

### 6. Batch Operations with Sharding

```typescript
// analytics.service.ts
import { Injectable } from '@nestjs/common';
import { CacheShardingService } from './cache/cache-sharding.service';
import { CacheService } from './cache/cache.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private shardingService: CacheShardingService,
    private cacheService: CacheService,
  ) {}

  async trackUserEvents(userId: string, events: any[]) {
    // Get shard mapping for all user events
    const eventKeys = events.map(
      (_, i) => `analytics:user:${userId}:event:${i}`
    );
    
    const shardMap = this.shardingService.getShardMap(eventKeys);

    console.log(
      `Events distributed across ${shardMap.size} shards`
    );

    // Store events in parallel per shard
    const promises = [];
    for (const [shardIndex, keys] of shardMap.entries()) {
      const keysForShard = keys.map((k, i) => {
        return this.cacheService.set(k, events[i], {
          ttl: 3600,
          tags: ['analytics', `user:${userId}`],
        });
      });
      promises.push(...keysForShard);
    }

    await Promise.all(promises);
  }

  async validateShardBalance() {
    // Create test keys
    const testKeys = Array.from(
      { length: 1000 },
      (_, i) => `test:key:${i}`
    );

    // Check distribution balance
    const validation = await this.shardingService.validateDistribution(
      testKeys
    );

    if (!validation.balanced) {
      console.warn(
        `Imbalance detected: ${(validation.imbalanceRatio * 100).toFixed(2)}%`
      );
    }

    return validation;
  }

  async handleNodeAddition(newNodeCount: number) {
    // Rebalance after adding nodes
    this.shardingService.rebalance(newNodeCount);
    
    console.log(`Cluster rebalanced for ${newNodeCount} nodes`);
  }
}
```

### 7. Advanced: Custom Cache Strategy

```typescript
// session.service.ts
import { Injectable } from '@nestjs/common';
import { CacheService } from './cache/cache.service';
import { CacheConfigurationService } from './cache/cache-configuration.service';

@Injectable()
export class SessionService {
  constructor(
    private cacheService: CacheService,
    private configService: CacheConfigurationService,
  ) {}

  async initializeSessions() {
    // Register custom session caching strategy
    await this.configService.registerStrategy({
      name: 'session-strategy',
      pattern: 'session:*',
      ttl: 1800, // 30 minutes
      priority: 'high',
      compression: true,
      tags: ['session', 'auth'],
    });
  }

  async createSession(userId: string, sessionData: any) {
    const sessionId = this.generateSessionId();
    const key = `session:${sessionId}`;

    // Cache with strategy
    await this.cacheService.set(key, sessionData, {
      ttl: 1800,
      tags: ['session', `user:${userId}`],
      strategy: 'write-through',
      compress: true,
    });

    return sessionId;
  }

  async getSession(sessionId: string) {
    // Uses session-strategy automatically based on pattern
    return this.cacheService.get(
      `session:${sessionId}`,
      async () => null, // Session doesn't reload from DB
      { tags: ['session'] }
    );
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36)}`;
  }
}
```

### 8. Error Handling and Fallbacks

```typescript
// data.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache/cache.service';
import { RedisService } from './redis/redis.service';

@Injectable()
export class DataService {
  private readonly logger = new Logger(DataService.name);

  constructor(
    private cacheService: CacheService,
    private redisService: RedisService,
    private databaseService: DatabaseService,
  ) {}

  async getData(key: string, forceRefresh: boolean = false) {
    // Check cluster availability
    if (!this.redisService.isRedisAvailable()) {
      this.logger.warn('Cache unavailable, querying database directly');
      return this.databaseService.get(key);
    }

    try {
      if (forceRefresh) {
        // Bypass cache
        return await this.databaseService.get(key);
      }

      // Normal cache-aside flow with fallback
      return await this.cacheService.get(
        key,
        () => this.databaseService.get(key),
        { ttl: 3600 }
      );
    } catch (error) {
      // Log error but don't fail
      this.logger.error(`Cache operation failed: ${error.message}`);
      
      // Fallback to direct database access
      try {
        return await this.databaseService.get(key);
      } catch (dbError) {
        this.logger.error(`Database access also failed: ${dbError.message}`);
        throw dbError;
      }
    }
  }

  async getDataWithMetrics(key: string) {
    const startTime = Date.now();

    try {
      const data = await this.getData(key);
      const duration = Date.now() - startTime;

      return {
        success: true,
        data,
        duration,
        source: 'cache', // Could track actual source
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error.message,
        duration,
        source: 'error',
      };
    }
  }
}
```

### 9. Docker Local Testing

```bash
# Start cluster
docker-compose -f docker-compose.redis-cluster.yml up -d

# Test connection from app
npm run start:dev

# Verify cache operations in logs
docker logs -f redis-master-1 | grep -i "set\|get"

# Check cluster metrics
docker exec redis-master-1 redis-cli INFO stats | head -10

# Simulate node failure
docker stop redis-master-1

# Watch automatic failover
docker exec redis-master-2 redis-cli cluster info

# Restore node
docker start redis-master-1
```

### 10. Performance Optimization Tips

```typescript
// Good: Batch similar keys
const userIds = ['user1', 'user2', 'user3'];
const shardMap = shardingService.getShardMap(
  userIds.map(id => `user:${id}`)
);

// Bad: Sequential individual get
for (const id of userIds) {
  await cache.get(`user:${id}`);
}

// Good: Use tags for bulk invalidation
await cache.invalidateByTag('user', [userId]);

// Bad: Delete individual keys
for (const key of keys) {
  await cache.delete(key);
}

// Good: Set appropriate TTLs
const static = 86400; // Config: 24h
const dynamic = 3600; // User data: 1h
const realtime = 300; // Rates: 5min

// Good: Compress large values
await cache.set(key, largeData, { compress: true });
```

---

These examples demonstrate the complete integration of Redis Cluster into your Stellara Contracts application with production-ready patterns and error handling.
