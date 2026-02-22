import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { CacheService } from './cache.service';

/**
 * Cache version information
 */
export interface CacheVersionInfo {
  key: string;
  version: string;
  timestamp: number;
  nodeId: string;
  checksum: string;
}

/**
 * Consistency check result
 */
export interface ConsistencyCheckResult {
  key: string;
  consistent: boolean;
  versions: CacheVersionInfo[];
  conflicts: boolean;
  lastUpdate: number;
}

/**
 * Synchronization event
 */
export interface SyncEvent {
  id: string;
  key: string;
  action: 'set' | 'delete' | 'update';
  version: string;
  timestamp: number;
  sourceNode: string;
  targetNodes: string[];
  status: 'pending' | 'completed' | 'failed';
  retries: number;
}

/**
 * Cache Consistency Service
 * Ensures data consistency across cluster nodes during replication
 */
@Injectable()
export class CacheConsistencyService {
  private readonly logger = new Logger(CacheConsistencyService.name);
  private readonly VERSION_PREFIX = 'cache:version:';
  private readonly SYNC_LOG_PREFIX = 'cache:sync:log:';
  private readonly CONSISTENCY_LOG_KEY = 'cache:consistency:log';
  private readonly nodeId = this.generateNodeId();
  private syncQueue: Map<string, SyncEvent> = new Map();
  private consistencyCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly redisService: RedisService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Generate unique node identifier
   */
  private generateNodeId(): string {
    return `node-${process.env.HOSTNAME || 'unknown'}-${process.pid}-${Date.now()}`;
  }

  /**
   * Get current node identifier
   */
  getNodeId(): string {
    return this.nodeId;
  }

  /**
   * Track cache write for consistency
   */
  async trackWrite(
    key: string,
    value: any,
    version?: string,
  ): Promise<CacheVersionInfo> {
    const versionInfo: CacheVersionInfo = {
      key,
      version: version || this.generateVersion(),
      timestamp: Date.now(),
      nodeId: this.nodeId,
      checksum: this.calculateChecksum(value),
    };

    try {
      const versionKey = `${this.VERSION_PREFIX}${key}`;
      const client = this.redisService.getClient();

      // Store version information
      // @ts-ignore
      await client.hSet(versionKey, this.nodeId, JSON.stringify(versionInfo));

      // Set TTL for version tracking (24 hours)
      // @ts-ignore
      await client.expire(versionKey, 86400);

      // Log sync event
      await this.logSyncEvent({
        id: this.generateSyncId(),
        key,
        action: 'set',
        version: versionInfo.version,
        timestamp: versionInfo.timestamp,
        sourceNode: this.nodeId,
        targetNodes: [],
        status: 'completed',
        retries: 0,
      });

      this.logger.debug(
        `Tracked write for key ${key}, version: ${versionInfo.version}`,
      );

      return versionInfo;
    } catch (error) {
      this.logger.error(`Failed to track write for key ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify consistency of a key across nodes
   */
  async verifyConsistency(key: string): Promise<ConsistencyCheckResult> {
    try {
      const versionKey = `${this.VERSION_PREFIX}${key}`;
      const client = this.redisService.getClient();

      // @ts-ignore
      const versions = await client.hGetAll(versionKey);
      const versionArray = Object.values(versions).map((v: any) =>
        typeof v === 'string' ? JSON.parse(v) : v,
      ) as CacheVersionInfo[];

      // Check if all versions match
      const checksums = versionArray.map((v) => v.checksum);
      const uniqueChecksums = new Set(checksums);
      const consistent = uniqueChecksums.size <= 1;

      const result: ConsistencyCheckResult = {
        key,
        consistent,
        versions: versionArray,
        conflicts: uniqueChecksums.size > 1,
        lastUpdate: Math.max(...versionArray.map((v) => v.timestamp), 0),
      };

      if (!consistent) {
        this.logger.warn(
          `Consistency check failed for key ${key}: ${uniqueChecksums.size} different versions`,
        );
        await this.resolveConflict(key, versionArray);
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to verify consistency for key ${key}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Resolve consistency conflict using Last-Write-Wins strategy
   */
  private async resolveConflict(
    key: string,
    versions: CacheVersionInfo[],
  ): Promise<void> {
    try {
      this.logger.log(`Resolving conflict for key ${key}`);

      // Find the most recent version
      const latestVersion = versions.reduce((latest, current) =>
        current.timestamp > latest.timestamp ? current : latest,
      );

      // Get the actual value from the source node
      const client = this.redisService.getClient();
      // @ts-ignore
      const value = await client.get(key);

      if (value) {
        // Synchronize value to all nodes
        await this.synchronizeValue(key, value, latestVersion);
      }

      this.logger.log(
        `Conflict resolved for key ${key}, using version from node ${latestVersion.nodeId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to resolve conflict for key ${key}: ${error.message}`);
    }
  }

  /**
   * Synchronize value across cluster
   */
  private async synchronizeValue(
    key: string,
    value: any,
    version: CacheVersionInfo,
  ): Promise<void> {
    const syncEvent: SyncEvent = {
      id: this.generateSyncId(),
      key,
      action: 'update',
      version: version.version,
      timestamp: Date.now(),
      sourceNode: this.nodeId,
      targetNodes: [],
      status: 'pending',
      retries: 0,
    };

    try {
      const client = this.redisService.getClient();

      // Broadcast write to cluster
      // In Redis Cluster, writes are automatically replicated
      // @ts-ignore
      await client.set(key, value);

      syncEvent.status = 'completed';
      this.logger.debug(`Synchronized key ${key} across cluster`);
    } catch (error) {
      syncEvent.status = 'failed';
      this.logger.error(`Failed to synchronize key ${key}: ${error.message}`);
    }

    await this.logSyncEvent(syncEvent);
  }

  /**
   * Perform full consistency audit
   */
  async performAudit(keyPattern: string = '*'): Promise<{
    totalKeys: number;
    consistentKeys: number;
    inconsistentKeys: string[];
    duration: number;
  }> {
    const startTime = Date.now();
    const client = this.redisService.getClient();

    try {
      this.logger.log(`Starting consistency audit for pattern: ${keyPattern}`);

      // Scan keys matching pattern
      let keys: string[] = [];
      // @ts-ignore
      for await (const key of client.scanIterator({
        MATCH: keyPattern,
        COUNT: 100,
      })) {
        keys.push(key);
      }

      let consistentCount = 0;
      const inconsistentKeys: string[] = [];

      // Check consistency for each key
      for (const key of keys) {
        const result = await this.verifyConsistency(key);
        if (result.consistent) {
          consistentCount++;
        } else {
          inconsistentKeys.push(key);
        }
      }

      const duration = Date.now() - startTime;

      const auditResult = {
        totalKeys: keys.length,
        consistentKeys: consistentCount,
        inconsistentKeys,
        duration,
      };

      this.logger.log(
        `Audit completed: ${consistentCount}/${keys.length} consistent, ${duration}ms`,
      );

      return auditResult;
    } catch (error) {
      this.logger.error(`Audit failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enable automatic consistency checking
   */
  startConsistencyMonitoring(intervalMs: number = 300000): void {
    if (this.consistencyCheckInterval) {
      clearInterval(this.consistencyCheckInterval);
    }

    this.consistencyCheckInterval = setInterval(
      () => this.monitorConsistency(),
      intervalMs,
    );

    this.logger.log(
      `Consistency monitoring started (interval: ${intervalMs}ms)`,
    );
  }

  /**
   * Stop consistency monitoring
   */
  stopConsistencyMonitoring(): void {
    if (this.consistencyCheckInterval) {
      clearInterval(this.consistencyCheckInterval);
      this.consistencyCheckInterval = null;
      this.logger.log('Consistency monitoring stopped');
    }
  }

  /**
   * Monitor consistency periodically
   */
  private async monitorConsistency(): Promise<void> {
    try {
      // Sample-based checking to reduce overhead
      const sampleSize = 10;
      const keyPattern = 'cache:*';

      const client = this.redisService.getClient();
      let sampledKeys: string[] = [];

      // @ts-ignore
      for await (const key of client.scanIterator({
        MATCH: keyPattern,
        COUNT: sampleSize,
      })) {
        sampledKeys.push(key);
        if (sampledKeys.length >= sampleSize) break;
      }

      // Check sampled keys
      const results = await Promise.allSettled(
        sampledKeys.map((key) => this.verifyConsistency(key)),
      );

      const inconsistentCount = results.filter(
        (r) => r.status === 'fulfilled' && !(r.value as any).consistent,
      ).length;

      if (inconsistentCount > 0) {
        this.logger.warn(
          `Consistency monitoring found ${inconsistentCount} inconsistent keys in sample`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Consistency monitoring failed: ${error.message}`,
      );
    }
  }

  /**
   * Log sync event
   */
  private async logSyncEvent(event: SyncEvent): Promise<void> {
    try {
      const client = this.redisService.getClient();
      const logKey = `${this.SYNC_LOG_PREFIX}${event.key}`;

      // @ts-ignore
      await client.lPush(logKey, JSON.stringify(event));

      // Keep only last 100 events per key
      // @ts-ignore
      await client.lTrim(logKey, 0, 99);

      // Set TTL
      // @ts-ignore
      await client.expire(logKey, 604800); // 7 days
    } catch (error) {
      this.logger.error(`Failed to log sync event: ${error.message}`);
    }
  }

  /**
   * Get sync history for a key
   */
  async getSyncHistory(key: string): Promise<SyncEvent[]> {
    try {
      const client = this.redisService.getClient();
      const logKey = `${this.SYNC_LOG_PREFIX}${key}`;

      // @ts-ignore
      const events = await client.lRange(logKey, 0, 99);
      return events.map((e: any) =>
        typeof e === 'string' ? JSON.parse(e) : e,
      );
    } catch (error) {
      this.logger.error(`Failed to get sync history for key ${key}: ${error.message}`);
      return [];
    }
  }

  /**
   * Calculate checksum for value
   */
  private calculateChecksum(value: any): string {
    const crypto = require('crypto');
    const serialized = JSON.stringify(value);
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Generate unique version identifier
   */
  private generateVersion(): string {
    return `v-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate sync event ID
   */
  private generateSyncId(): string {
    return `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get consistency statistics
   */
  async getConsistencyStats(): Promise<any> {
    try {
      const client = this.redisService.getClient();

      // @ts-ignore
      const logCount = await client.dbSize();

      return {
        nodeId: this.nodeId,
        timestamp: Date.now(),
        totalKeys: logCount,
        syncQueueSize: this.syncQueue.size,
      };
    } catch (error) {
      this.logger.error(`Failed to get consistency stats: ${error.message}`);
      return {};
    }
  }
}
