import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CacheWarmingService, WarmupEntry } from './cache-warming.service';
import { RedisService } from '../redis/redis.service';
import { CacheShardingService } from './cache-sharding.service';
import { CacheService } from './cache.service';

/**
 * Cluster-aware warmup statistics
 */
export interface ClusterWarmupStats {
  totalEntries: number;
  entriesPerShard: Map<number, number>;
  successPerShard: Map<number, number>;
  failurePerShard: Map<number, number>;
  totalDuration: number;
  shardDurations: Map<number, number>;
  startTime: number;
  endTime?: number;
}

/**
 * Cluster Warmup Configuration
 */
export interface ClusterWarmupConfig {
  parallelShards: number;
  replicaAware: boolean;
  checkConsistency: boolean;
  rollbackOnFailure: boolean;
}

/**
 * Cluster Cache Warming Service
 * Extends cache warming with cluster-specific strategies
 */
@Injectable()
export class ClusterCacheWarmingService implements OnModuleInit {
  private readonly logger = new Logger(ClusterCacheWarmingService.name);
  private config: ClusterWarmupConfig = {
    parallelShards: 3,
    replicaAware: true,
    checkConsistency: true,
    rollbackOnFailure: false,
  };

  private warmupStats: ClusterWarmupStats = {
    totalEntries: 0,
    entriesPerShard: new Map(),
    successPerShard: new Map(),
    failurePerShard: new Map(),
    totalDuration: 0,
    shardDurations: new Map(),
    startTime: 0,
  };

  constructor(
    private readonly cacheWarmingService: CacheWarmingService,
    private readonly cacheService: CacheService,
    private readonly redisService: RedisService,
    private readonly shardingService: CacheShardingService,
  ) {}

  async onModuleInit() {
    this.logger.log('ClusterCacheWarmingService initialized');
    await this.validateClusterSetup();
  }

  /**
   * Validate cluster setup for warmup operations
   */
  private async validateClusterSetup(): Promise<void> {
    const isCluster = this.redisService.isClusterMode();
    this.logger.log(
      `Cluster mode: ${isCluster}, sharding enabled: ${this.shardingService}`,
    );

    if (isCluster) {
      const health = this.redisService.getClusterHealthStatus();
      this.logger.log(
        `Cluster health - Connected nodes: ${health.connectedNodes}/${health.totalNodes}, Healthy: ${health.isHealthy}`,
      );
    }
  }

  /**
   * Perform distributed warmup across cluster
   */
  async performDistributedWarmup(
    groupName: string,
    config?: Partial<ClusterWarmupConfig>,
  ): Promise<ClusterWarmupStats> {
    const group = this.cacheWarmingService.getWarmupGroup(groupName);
    if (!group || !group.enabled) {
      this.logger.warn(`Group ${groupName} not found or disabled`);
      return this.warmupStats;
    }

    // Merge configuration
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.warmupStats = {
      totalEntries: group.entries.length,
      entriesPerShard: new Map(),
      successPerShard: new Map(),
      failurePerShard: new Map(),
      totalDuration: 0,
      shardDurations: new Map(),
      startTime: Date.now(),
    };

    try {
      this.logger.log(
        `Starting distributed warmup for group: ${groupName} with config: ${JSON.stringify(this.config)}`,
      );

      // Distribute entries across shards
      const shardMap = this.shardingService.getShardMap(
        group.entries.map((e) => e.key),
      );

      // Update entry count per shard
      for (const [shardIndex, keys] of shardMap.entries()) {
        this.warmupStats.entriesPerShard.set(shardIndex, keys.length);
        this.warmupStats.successPerShard.set(shardIndex, 0);
        this.warmupStats.failurePerShard.set(shardIndex, 0);
      }

      // Perform shard-aware warmup
      const shardWarmupTasks: Promise<void>[] = [];
      const shardArray = Array.from(shardMap.entries());

      // Process shards in parallel with configured concurrency
      for (let i = 0; i < shardArray.length; i += this.config.parallelShards) {
        const batch = shardArray.slice(
          i,
          i + this.config.parallelShards,
        );
        const tasks = batch.map(([shardIndex, keys]) =>
          this.warmupShard(groupName, shardIndex, keys),
        );

        await Promise.all(tasks);
      }

      this.warmupStats.endTime = Date.now();
      this.warmupStats.totalDuration =
        this.warmupStats.endTime - this.warmupStats.startTime;

      // Validate consistency if enabled
      if (this.config.checkConsistency) {
        await this.validateWarmupConsistency(groupName, shardMap);
      }

      this.logWarmupResults();
      return this.warmupStats;
    } catch (error) {
      this.logger.error(
        `Distributed warmup failed: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Warmup entries for a specific shard
   */
  private async warmupShard(
    groupName: string,
    shardIndex: number,
    keys: string[],
  ): Promise<void> {
    const shardStartTime = Date.now();
    let successCount = 0;
    let failureCount = 0;

    try {
      this.logger.log(
        `Warming up shard ${shardIndex} with ${keys.length} entries`,
      );

      const group = this.cacheWarmingService.getWarmupGroup(groupName);
      if (!group) {
        throw new Error(`Group ${groupName} not found`);
      }

      // Get entries for this shard
      const shardEntries = group.entries.filter((e) => keys.includes(e.key));

      // Sort by priority
      const sortedEntries = [...shardEntries].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      // Warm up entries using connection targeted to this shard
      // Note: Redis Cluster automatically routes to correct shard
      for (const entry of sortedEntries) {
        try {
          await this.cacheWarmingService.warmupEntry(entry);
          successCount++;
        } catch (error) {
          this.logger.error(
            `Failed to warm up key ${entry.key} in shard ${shardIndex}: ${error.message}`,
          );
          failureCount++;
        }
      }

      const shardDuration = Date.now() - shardStartTime;
      this.warmupStats.shardDurations.set(shardIndex, shardDuration);
      this.warmupStats.successPerShard.set(shardIndex, successCount);
      this.warmupStats.failurePerShard.set(shardIndex, failureCount);

      this.logger.log(
        `Shard ${shardIndex} warmup completed: ${successCount} success, ${failureCount} failed, ${shardDuration}ms`,
      );
    } catch (error) {
      this.logger.error(
        `Shard ${shardIndex} warmup failed: ${error.message}`,
      );
      this.warmupStats.failurePerShard.set(
        shardIndex,
        (this.warmupStats.failurePerShard.get(shardIndex) || 0) +
          keys.length,
      );
    }
  }

  /**
   * Validate consistency across replicas
   */
  private async validateWarmupConsistency(
    groupName: string,
    shardMap: Map<number, string[]>,
  ): Promise<void> {
    this.logger.log(
      'Validating warmup consistency across cluster replicas',
    );

    const group = this.cacheWarmingService.getWarmupGroup(groupName);
    if (!group) return;

    const inconsistentKeys: string[] = [];

    // Check random sample of entries across shards
    const sampleSize = Math.min(
      10,
      Math.ceil(group.entries.length * 0.05),
    ); // 5% or 10 keys
    const randomEntries = this.getRandomSample(group.entries, sampleSize);

    for (const entry of randomEntries) {
      try {
        // Try to read from cache multiple times to check consistency
        const reads = await Promise.all([
          this.cacheService.get(entry.key, async () => null),
          this.cacheService.get(entry.key, async () => null),
        ]);

        // In a replica setup, reads should be consistent
        if (reads[0] !== reads[1]) {
          inconsistentKeys.push(entry.key);
        }
      } catch (error) {
        this.logger.warn(
          `Consistency check failed for key ${entry.key}: ${error.message}`,
        );
      }
    }

    if (inconsistentKeys.length > 0) {
      this.logger.warn(
        `Found ${inconsistentKeys.length} inconsistent keys during warmup validation`,
      );

      if (this.config.rollbackOnFailure) {
        this.logger.warn('Initiating rollback on inconsistency detection');
        await this.rollbackWarmup(groupName);
      }
    } else {
      this.logger.log('Warmup consistency validation passed');
    }
  }

  /**
   * Rollback keys loaded during warmup
   */
  private async rollbackWarmup(groupName: string): Promise<void> {
    this.logger.warn(`Rolling back warmup for group ${groupName}`);

    const group = this.cacheWarmingService.getWarmupGroup(groupName);
    if (!group) return;

    try {
      const rollbackCount = await Promise.all(
        group.entries.map(async (entry) => {
          try {
            // Delete the key to rollback the warmup
            const client = this.redisService.getClient();
            // @ts-ignore
            await client.del(entry.key);
            return 1;
          } catch {
            return 0;
          }
        }),
      );

      const successCount = rollbackCount.reduce((a, b) => a + b, 0);
      this.logger.log(`Rollback completed: ${successCount} keys deleted`);
    } catch (error) {
      this.logger.error(`Rollback failed: ${error.message}`);
    }
  }

  /**
   * Warmup with rebalancing (handles node addition/removal)
   */
  async warmupWithRebalancing(
    groupName: string,
    newNodeCount: number,
  ): Promise<ClusterWarmupStats> {
    this.logger.log(
      `Performing warmup with rebalancing for ${newNodeCount} nodes`,
    );

    // Rebalance shards for new topology
    this.shardingService.rebalance(newNodeCount);

    // Perform distributed warmup with new shard distribution
    return this.performDistributedWarmup(groupName);
  }

  /**
   * Preload critical data for cluster nodes
   */
  async preloadCriticalData(tags: string[]): Promise<number> {
    this.logger.log(`Preloading critical data with tags: ${tags.join(', ')}`);

    let totalWarmups = 0;

    for (const tag of tags) {
      try {
        const count = await this.cacheWarmingService.warmupByTag(tag);
        totalWarmups += count;
      } catch (error) {
        this.logger.error(
          `Failed to preload data for tag ${tag}: ${error.message}`,
        );
      }
    }

    this.logger.log(`Critical data preload completed: ${totalWarmups} entries`);
    return totalWarmups;
  }

  /**
   * Get cluster warmup statistics
   */
  getWarmupStats(): ClusterWarmupStats {
    return this.warmupStats;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.warmupStats = {
      totalEntries: 0,
      entriesPerShard: new Map(),
      successPerShard: new Map(),
      failurePerShard: new Map(),
      totalDuration: 0,
      shardDurations: new Map(),
      startTime: 0,
    };
  }

  /**
   * Get random sample from array
   */
  private getRandomSample<T>(array: T[], size: number): T[] {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(size, array.length));
  }

  /**
   * Log warmup results
   */
  private logWarmupResults(): void {
    const totalSuccess = Array.from(
      this.warmupStats.successPerShard.values(),
    ).reduce((a, b) => a + b, 0);
    const totalFailure = Array.from(
      this.warmupStats.failurePerShard.values(),
    ).reduce((a, b) => a + b, 0);

    this.logger.log('=== Cluster Warmup Results ===');
    this.logger.log(`Total Duration: ${this.warmupStats.totalDuration}ms`);
    this.logger.log(`Total Success: ${totalSuccess}`);
    this.logger.log(`Total Failures: ${totalFailure}`);
    this.logger.log(
      `Success Rate: ${((totalSuccess / (totalSuccess + totalFailure)) * 100).toFixed(2)}%`,
    );

    for (const [shardIndex, duration] of this.warmupStats.shardDurations) {
      const success = this.warmupStats.successPerShard.get(shardIndex) || 0;
      const failure = this.warmupStats.failurePerShard.get(shardIndex) || 0;
      this.logger.log(
        `Shard ${shardIndex}: ${duration}ms (${success}/${success + failure} entries)`,
      );
    }

    this.logger.log('=============================');
  }
}
