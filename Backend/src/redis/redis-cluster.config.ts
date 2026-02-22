import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Redis Cluster node configuration
 */
export interface ClusterNode {
  host: string;
  port: number;
}

/**
 * Redis Cluster options
 */
export interface ClusterOptions {
  enableReadyCheck?: boolean;
  enableOfflineQueue?: boolean;
  dnsLookup?: string;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  retryDelayOnClusterDown?: number;
  slotsRefreshTimeout?: number;
  dnsLookupAsync?: boolean;
  socket?: any;
  clusterRetryStrategy?: (times: number) => number;
  sentinels?: any;
}

/**
 * Redis Cluster configuration interface
 * Supports both cluster and replica configurations
 */
export interface RedisClusterConfig {
  nodes: ClusterNode[];
  options: ClusterOptions;
  enableMetrics: boolean;
  enableSharding: boolean;
  shardingStrategy: 'consistent-hash' | 'key-range';
  retryStrategy: RetryStrategy;
  connectionPoolSize: number;
  maxRetriesToReadKey: number;
}

export interface RetryStrategy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Redis Cluster Configuration Service
 * Manages cluster setup, nodes, and strategy configuration
 */
@Injectable()
export class RedisClusterConfigService {
  private readonly logger = new Logger(RedisClusterConfigService.name);
  private clusterConfig: RedisClusterConfig;

  constructor(private readonly configService: ConfigService) {
    this.initializeClusterConfig();
  }

  /**
   * Initialize cluster configuration from environment variables
   */
  private initializeClusterConfig(): void {
    const nodesConfig = process.env.REDIS_CLUSTER_NODES ||
      process.env.REDIS_CLUSTER_NODES_FILE ||
      'localhost:6379,localhost:6380,localhost:6381';

    // Parse nodes from configuration
    const nodes = this.parseClusterNodes(nodesConfig);

    // Define retry strategy
    const retryStrategy: RetryStrategy = {
      maxRetries: this.configService.get('REDIS_MAX_RETRIES', 5),
      initialDelayMs: this.configService.get(
        'REDIS_RETRY_INITIAL_DELAY_MS',
        100,
      ),
      maxDelayMs: this.configService.get('REDIS_RETRY_MAX_DELAY_MS', 3000),
      backoffMultiplier: this.configService.get(
        'REDIS_RETRY_BACKOFF_MULTIPLIER',
        2,
      ),
    };

    // Build cluster options
    const options: ClusterOptions = {
      enableReadyCheck: true,
      enableOfflineQueue: false,
      dnsLookup: 'ipv4first',
      clusterRetryStrategy: (times: number) => {
        return Math.min(times * retryStrategy.backoffMultiplier * 100, 3000);
      },
      sentinels: undefined,
      maxRetriesPerRequest: retryStrategy.maxRetries,
      retryDelayOnFailover: retryStrategy.initialDelayMs,
      retryDelayOnClusterDown: retryStrategy.initialDelayMs,
      slotsRefreshTimeout: 1000,
      dnsLookupAsync: true,
      socket: {
        reconnectStrategy: (retries: number) => {
          const delay = Math.min(
            retryStrategy.initialDelayMs *
              Math.pow(retryStrategy.backoffMultiplier, retries),
            retryStrategy.maxDelayMs,
          );
          this.logger.debug(
            `Reconnecting to cluster (attempt ${retries + 1}), delay: ${delay}ms`,
          );
          return delay;
        },
        keepAlive: 30000,
        noDelay: true,
      },
    };

    this.clusterConfig = {
      nodes,
      options,
      enableMetrics: this.configService.get('REDIS_CLUSTER_METRICS', true),
      enableSharding: this.configService.get('REDIS_ENABLE_SHARDING', true),
      shardingStrategy: (this.configService.get(
        'REDIS_SHARDING_STRATEGY',
      ) as 'consistent-hash' | 'key-range') || 'consistent-hash',
      retryStrategy,
      connectionPoolSize: this.configService.get(
        'REDIS_CONNECTION_POOL_SIZE',
        10,
      ),
      maxRetriesToReadKey: this.configService.get(
        'REDIS_MAX_RETRIES_READ_KEY',
        3,
      ),
    };

    this.logger.log(
      `Redis Cluster configured with ${nodes.length} nodes, sharding: ${this.clusterConfig.enableSharding}`,
    );
    this.logger.debug(`Cluster nodes: ${JSON.stringify(nodes)}`);
  }

  /**
   * Parse cluster nodes from configuration string
   * Format: "host1:port1,host2:port2,host3:port3"
   */
  private parseClusterNodes(nodesConfig: string): ClusterNode[] {
    return nodesConfig
      .split(',')
      .map((node) => {
        const [host, port] = node.trim().split(':');
        return {
          host: host || 'localhost',
          port: parseInt(port, 10) || 6379,
        };
      })
      .filter((node) => node.host && node.port);
  }

  /**
   * Get cluster configuration
   */
  getClusterConfig(): RedisClusterConfig {
    return this.clusterConfig;
  }

  /**
   * Get cluster nodes
   */
  getClusterNodes(): ClusterNode[] {
    return this.clusterConfig.nodes;
  }

  /**
   * Get cluster options
   */
  getClusterOptions(): ClusterOptions {
    return this.clusterConfig.options;
  }

  /**
   * Get retry strategy configuration
   */
  getRetryStrategy(): RetryStrategy {
    return this.clusterConfig.retryStrategy;
  }

  /**
   * Check if sharding is enabled
   */
  isShardingEnabled(): boolean {
    return this.clusterConfig.enableSharding;
  }

  /**
   * Get sharding strategy
   */
  getShardingStrategy(): 'consistent-hash' | 'key-range' {
    return this.clusterConfig.shardingStrategy;
  }

  /**
   * Get connection pool size
   */
  getConnectionPoolSize(): number {
    return this.clusterConfig.connectionPoolSize;
  }

  /**
   * Get max retries for read operations
   */
  getMaxRetriesToReadKey(): number {
    return this.clusterConfig.maxRetriesToReadKey;
  }

  /**
   * Get metrics configuration
   */
  isMetricsEnabled(): boolean {
    return this.clusterConfig.enableMetrics;
  }

  /**
   * Log cluster configuration status
   */
  logConfigurationStatus(): void {
    this.logger.log('=== Redis Cluster Configuration ===');
    this.logger.log(
      `Nodes: ${this.clusterConfig.nodes.length} - ${this.clusterConfig.nodes.map((n) => `${n.host}:${n.port}`).join(', ')}`,
    );
    this.logger.log(
      `Sharding: ${this.clusterConfig.enableSharding} (${this.clusterConfig.shardingStrategy})`,
    );
    this.logger.log(
      `Connection Pool: ${this.clusterConfig.connectionPoolSize}`,
    );
    this.logger.log(
      `Max Retries: ${this.clusterConfig.retryStrategy.maxRetries}`,
    );
    this.logger.log(
      `Metrics Enabled: ${this.clusterConfig.enableMetrics}`,
    );
    this.logger.log('===================================');
  }
}
