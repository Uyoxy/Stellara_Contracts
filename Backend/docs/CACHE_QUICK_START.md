# Advanced Caching System - Quick Start Guide

## 🚀 Getting Started

### 1. Installation
The caching module is already integrated into your application. No additional installation required.

### 2. Basic Usage

#### Simple Cache-Aside Pattern
```typescript
import { CacheService } from './cache/cache.service';

@Injectable()
export class DataService {
  constructor(private readonly cacheService: CacheService) {}

  async getData(id: string) {
    return await this.cacheService.get(
      `data:${id}`,
      () => this.fetchFromDatabase(id), // Fallback function
      { ttl: 3600 } // 1 hour TTL
    );
  }
}
```

#### Write-Through Pattern
```typescript
async updateData(id: string, data: any) {
  // This will write to both cache and your data store
  await this.cacheService.set(
    `data:${id}`,
    data,
    { strategy: 'write-through', ttl: 3600 }
  );
}
```

### 3. Cache Invalidation

#### Invalidate Specific Key
```typescript
import { CacheInvalidationService } from './cache/cache-invalidation.service';

await this.invalidationService.invalidateKey(
  'user:123:profile', 
  'user profile updated'
);
```

#### Invalidate by Tag
```typescript
// Invalidates all entries tagged with 'user'
await this.invalidationService.invalidateByTag('user', 'bulk user update');
```

### 4. Cache Warming

#### Register and Execute Warmup
```typescript
import { CacheWarmingService } from './cache/cache-warming.service';

// Register warmup group
await this.warmingService.registerWarmupGroup({
  name: 'user-data',
  enabled: true,
  entries: [
    {
      key: 'users:active',
      loader: () => this.userService.getActiveUsers(),
      priority: 'high',
      schedule: 'startup',
      ttl: 1800
    }
  ]
});

// Execute immediately
await this.warmingService.warmupGroup('user-data');
```

### 5. Monitoring

#### Check Cache Health
```typescript
import { CacheMonitoringService } from './cache/cache-monitoring.service';

const health = await this.monitoringService.performHealthCheck();
console.log(`Cache status: ${health.status}`);
console.log(`Hit rate: ${(health.metrics.hitRate * 100).toFixed(2)}%`);
```

#### Get Performance Metrics
```typescript
// Via API endpoint
GET /cache/stats
GET /cache/health
GET /cache/metrics?hours=24
```

## 🎯 Common Use Cases

### 1. User Profile Caching
```typescript
// Cache user profiles with automatic invalidation
async getUserProfile(userId: string) {
  return await this.cacheService.get(
    `user:${userId}:profile`,
    () => this.userRepository.findById(userId),
    { 
      ttl: 1800, // 30 minutes
      tags: ['user', 'profile'] 
    }
  );
}

// Invalidate when user updates profile
async updateUserProfile(userId: string, updates: any) {
  await this.userRepository.update(userId, updates);
  await this.invalidationService.invalidateKey(
    `user:${userId}:profile`,
    'profile updated'
  );
}
```

### 2. Configuration Caching
```typescript
// Cache application configuration
async getAppConfig() {
  return await this.cacheService.get(
    'app:config',
    () => this.configRepository.load(),
    { 
      ttl: 3600, // 1 hour
      tags: ['system', 'config'],
      strategy: 'write-through'
    }
  );
}
```

### 3. Session Data
```typescript
// Cache session information
async getUserSession(sessionId: string) {
  return await this.cacheService.get(
    `session:${sessionId}`,
    () => this.sessionRepository.findById(sessionId),
    { 
      ttl: 1800, // 30 minutes
      tags: ['session'] 
    }
  );
}
```

## 📊 Monitoring and Debugging

### API Endpoints for Monitoring
```bash
# Get current cache statistics
curl http://localhost:3000/cache/stats

# Check cache health
curl http://localhost:3000/cache/health

# View active alerts
curl http://localhost:3000/cache/alerts

# Generate performance report
curl http://localhost:3000/cache/report?period=24
```

### CLI Commands (via API)
```bash
# Clear entire cache
curl -X DELETE "http://localhost:3000/cache/clear?reason=maintenance"

# Warm up specific group
curl -X POST http://localhost:3000/cache/warmup/group/user-data/execute

# Invalidate by pattern
curl -X POST "http://localhost:3000/cache/invalidate/pattern/user:*:profile?reason=schema-change"
```

## ⚙️ Configuration

### Environment Variables
```bash
# Enable/disable caching
CACHE_ENABLED=true

# Default cache TTL (seconds)
CACHE_DEFAULT_TTL=3600

# Memory limits
CACHE_MAX_MEMORY=512mb

# Caching strategy
CACHE_STRATEGY=cache-aside

# Enable compression for large entries
CACHE_COMPRESSION_ENABLED=true
CACHE_COMPRESSION_THRESHOLD=1024

# Warmup settings
CACHE_WARMUP_ON_STARTUP=true
CACHE_SCHEDULED_WARMUP_ENABLED=true
```

## 🧪 Testing Your Implementation

### Unit Test Example
```typescript
describe('UserService with Cache', () => {
  let service: UserService;
  let cacheService: CacheService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          }
        }
      ]
    }).compile();

    service = module.get(UserService);
    cacheService = module.get(CacheService);
  });

  it('should cache user profiles', async () => {
    const userId = '123';
    const profile = { id: '123', name: 'John Doe' };
    
    (cacheService.get as jest.Mock).mockImplementation(
      async (key, fallback) => fallback()
    );

    const result = await service.getUserProfile(userId);
    
    expect(cacheService.get).toHaveBeenCalledWith(
      `user:${userId}:profile`,
      expect.any(Function),
      expect.objectContaining({ ttl: 1800 })
    );
  });
});
```

## 🚨 Troubleshooting

### Common Issues

1. **Low Cache Hit Rate**
   ```bash
   # Check current hit rate
   GET /cache/stats
   
   # Solutions:
   # - Increase TTL for frequently accessed data
   # - Add cache warming for critical data
   # - Review key patterns and caching strategy
   ```

2. **High Memory Usage**
   ```bash
   # Check memory usage
   GET /cache/health
   
   # Solutions:
   # - Reduce TTL values
   # - Enable compression for large entries
   # - Implement cache eviction policies
   ```

3. **Cache Invalidation Not Working**
   ```bash
   # Verify invalidation is working
   POST /cache/invalidate/key/test-key?reason=debug
   GET /cache/entry/test-key
   
   # Check if other instances received invalidation
   # Review Redis pub/sub configuration
   ```

### Performance Tuning

1. **Optimize TTL Settings**
   ```typescript
   // Hot data - shorter TTL
   { ttl: 300 } // 5 minutes
   
   // Warm data - medium TTL  
   { ttl: 1800 } // 30 minutes
   
   // Cold data - longer TTL
   { ttl: 7200 } // 2 hours
   ```

2. **Batch Operations**
   ```typescript
   // Instead of multiple individual calls
   await Promise.all([
     cacheService.get('key1', fallback1),
     cacheService.get('key2', fallback2)
   ]);
   
   // Use batch operations
   await cacheService.mget(['key1', 'key2']);
   ```

3. **Pipeline Operations**
   ```typescript
   // Enable pipelining in configuration
   CACHE_PIPELINE_ENABLED=true
   CACHE_MAX_BATCH_SIZE=100
   ```

## 📚 Additional Resources

- [Full Implementation Documentation](./ADVANCED_CACHING_IMPLEMENTATION.md)
- [API Reference](http://localhost:3000/api/docs) - When Swagger is enabled
- [Redis Documentation](https://redis.io/documentation)
- [NestJS Caching Guide](https://docs.nestjs.com/techniques/caching)

## 🎉 Ready to Use!

Your advanced caching system is now ready. Start by implementing caching for your most frequently accessed data and monitor the performance improvements!