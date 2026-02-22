import { Module, Global } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { CacheService } from './cache.service';
import { CacheInvalidationService } from './cache-invalidation.service';
import { CacheWarmingService } from './cache-warming.service';
import { CacheMonitoringService } from './cache-monitoring.service';
import { CacheConfigurationService } from './cache-configuration.service';
import { CacheShardingService } from './cache-sharding.service';
import { ClusterCacheWarmingService } from './cluster-cache-warming.service';
import { CacheConsistencyService } from './cache-consistency.service';
import { ClusterHealthMonitoringService } from './cluster-health-monitoring.service';
import { CacheController } from './cache.controller';

@Global()
@Module({
  imports: [RedisModule],
  controllers: [CacheController],
  providers: [
    CacheService,
    CacheInvalidationService,
    CacheWarmingService,
    CacheMonitoringService,
    CacheConfigurationService,
    CacheShardingService,
    ClusterCacheWarmingService,
    CacheConsistencyService,
    ClusterHealthMonitoringService,
  ],
  exports: [
    CacheService,
    CacheInvalidationService,
    CacheWarmingService,
    CacheMonitoringService,
    CacheConfigurationService,
    CacheShardingService,
    ClusterCacheWarmingService,
    CacheConsistencyService,
    ClusterHealthMonitoringService,
  ],
})
export class CacheModule {}
