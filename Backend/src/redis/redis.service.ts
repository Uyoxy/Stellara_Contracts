import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { createCluster, RedisClusterType, RedisClientType, createClient } from 'redis';
import { RedisClusterConfigService } from './redis-cluster.config';

/**
 * Cluster connection info
 */
export interface ClusterNodeInfo {
  host: string;
  port: number;
  status: 'connected' | 'disconnected' | 'reconnecting';
  role: 'master' | 'replica' | 'unknown';
}

/**
 * Cluster health status
 */
export interface ClusterHealthStatus {
  isHealthy: boolean;
  connectedNodes: number;
  totalNodes: number;
  nodeStatuses: ClusterNodeInfo[];
  slots: {
    covered: number;
    uncovered: number;
  };
  lastHealthCheck: number;
}

/**
 * Redis Service with Cluster Support
 * Manages cluster connections and provides unified interface for cluster and standalone modes
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  // Cluster clients
  public clusterClient!: RedisClusterType;

  // Pub/Sub clients (using cluster-aware setup)
  public pubClient!: RedisClusterType | RedisClientType;
  public subClient!: RedisClusterType | RedisClientType;

  // Standalone fallback clients
  private standaloneClient!: RedisClientType;
  public client!: RedisClientType | RedisClusterType; // For backward compatibility

  private isConnected = false;
  private useCluster = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private clusterHealthStatus: ClusterHealthStatus = {
    isHealthy: false,
    connectedNodes: 0,
    totalNodes: 0,
    nodeStatuses: [],
    slots: { covered: 0, uncovered: 0 },
    lastHealthCheck: 0,
  };

  constructor(
    private readonly clusterConfigService: RedisClusterConfigService,
  ) {}

  async onModuleInit() {
    try {
      // Check if cluster mode is enabled
      const clusterNodes = this.clusterConfigService.getClusterNodes();
      this.useCluster = clusterNodes.length > 1;

      if (this.useCluster) {
        await this.initializeCluster();
      } else {
        await this.initializeStandalone();
      }

      this.isConnected = true;
      this.logger.log(
        `Redis ${this.useCluster ? 'Cluster' : 'Standalone'} connected successfully`,
      );

      // Log configuration
      this.clusterConfigService.logConfigurationStatus();

      // Start health checks
      this.startHealthChecks();
    } catch (error) {
      this.logger.warn(
        `Redis connection failed: ${error.message}, falling back to standalone mode`,
      );
      this.isConnected = false;
      try {
        await this.initializeStandalone();
      } catch (fallbackError) {
        this.logger.error(
          `Failed to initialize standalone Redis: ${fallbackError.message}`,
        );
      }
    }
  }

  /**
   * Initialize Redis Cluster connection
   */
  private async initializeCluster(): Promise<void> {
    const nodes = this.clusterConfigService.getClusterNodes();
    const options = this.clusterConfigService.getClusterOptions();

    this.logger.log(
      `Initializing Redis Cluster with ${nodes.length} nodes: ${nodes.map((n) => `${n.host}:${n.port}`).join(', ')}`,
    );

    // Create cluster client
    this.clusterClient = createCluster({
      nodes,
      ...options,
    }) as RedisClusterType;

    // For backward compatibility
    this.client = this.clusterClient;

    // Create pub/sub clients (also cluster-aware)
    this.pubClient = this.clusterClient.duplicate() as RedisClusterType;
    this.subClient = this.clusterClient.duplicate() as RedisClusterType;

    // Setup event handlers
    this.setupClusterEventHandlers();

    // Connect all clients
    await Promise.all([
      this.clusterClient.connect(),
      this.pubClient.connect(),
      this.subClient.connect(),
    ]);

    this.logger.log('Redis Cluster clients connected successfully');
  }

  /**
   * Initialize standalone Redis connection (fallback)
   */
  private async initializeStandalone(): Promise<void> {
    const url =
      process.env.REDIS_URL ||
      `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;

    this.logger.log(`Initializing Standalone Redis: ${url}`);

    this.standaloneClient = createClient({ url });
    this.client = this.standaloneClient; // For backward compatibility
    this.pubClient = this.standaloneClient;
    this.subClient = this.standaloneClient;

    // Setup basic event handlers
    this.standaloneClient.on('error', (err) => {
      this.logger.error(`Redis Standalone error: ${err.message}`);
    });

    this.standaloneClient.on('connect', () => {
      this.logger.log('Redis Standalone connected');
    });

    this.standaloneClient.on('reconnecting', () => {
      this.logger.warn('Redis Standalone reconnecting...');
    });

    await this.standaloneClient.connect();
    this.logger.log('Standalone Redis client connected successfully');
  }

  /**
   * Setup cluster-specific event handlers
   */
  private setupClusterEventHandlers(): void {
    if (!this.clusterClient) return;

    this.clusterClient.on('error', (err) => {
      this.logger.error(`Redis Cluster error: ${err.message}`);
    });

    this.clusterClient.on('connect', () => {
      this.logger.log('Redis Cluster client connected');
    });

    this.clusterClient.on('reconnecting', () => {
      this.logger.warn('Redis Cluster client reconnecting...');
    });

    this.clusterClient.on('ready', () => {
      this.logger.log('Redis Cluster client ready');
      this.performHealthCheck();
    });

    // Listen to cluster slot changes
    this.clusterClient.on('sharded-pub-sub-only', () => {
      this.logger.warn(
        'Redis Cluster operating in sharded pub/sub mode (read-only)',
      );
    });
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    const interval = 30000; // 30 seconds
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      interval,
    );

    this.logger.log(`Health checks started (interval: ${interval}ms)`);
  }

  /**
   * Perform cluster health check
   */
  async performHealthCheck(): Promise<ClusterHealthStatus> {
    if (!this.useCluster || !this.clusterClient) {
      return this.clusterHealthStatus;
    }

    try {
      const info = await this.clusterClient.clusterInfo();
      const nodes = await this.clusterClient.clusterNodes();

      // Parse cluster info
      const clusterState =
        info.match(/cluster_state:(\w+)/)?.[1] || 'unknown';
      const slotsAssigned = parseInt(
        info.match(/cluster_slots_assigned:(\d+)/)?.[1] || '0',
        10,
      );
      const slotsOk = parseInt(
        info.match(/cluster_slots_ok:/)?.[1]?.split('\r')[0] || '0',
        10,
      );
      const slotsFail = parseInt(
        info.match(/cluster_slots_pfail:(\d+)/)?.[1] || '0',
        10,
      );

      // Parse nodes
      const nodeStatuses = this.parseClusterNodes(nodes);
      const connectedCount = nodeStatuses.filter(
        (n) => n.status === 'connected',
      ).length;

      this.clusterHealthStatus = {
        isHealthy: clusterState === 'ok' && slotsAssigned === 16384,
        connectedNodes: connectedCount,
        totalNodes: nodeStatuses.length,
        nodeStatuses,
        slots: {
          covered: slotsAssigned,
          uncovered: 16384 - slotsAssigned,
        },
        lastHealthCheck: Date.now(),
      };

      this.logger.debug(
        `Cluster Health - State: ${clusterState}, Connected: ${connectedCount}/${nodeStatuses.length}, Slots: ${slotsAssigned}/16384`,
      );

      return this.clusterHealthStatus;
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      this.clusterHealthStatus.isHealthy = false;
      this.clusterHealthStatus.lastHealthCheck = Date.now();
      return this.clusterHealthStatus;
    }
  }

  /**
   * Parse cluster nodes information
   */
  private parseClusterNodes(nodesInfo: string): ClusterNodeInfo[] {
    const nodeList: ClusterNodeInfo[] = [];

    nodesInfo.split('\n').forEach((line) => {
      if (!line.trim()) return;

      const parts = line.split(' ');
      if (parts.length < 2) return;

      const hostPort = parts[1].split('@')[0];
      const [host, portStr] = hostPort.split(':');
      const port = parseInt(portStr, 10);

      // Determine role and status
      let role: 'master' | 'replica' | 'unknown' = 'unknown';
      let status: 'connected' | 'disconnected' | 'reconnecting' = 'disconnected';

      if (parts[2].includes('master')) {
        role = 'master';
      } else if (parts[2].includes('slave')) {
        role = 'replica';
      }

      if (parts[2].includes('connected')) {
        status = 'connected';
      } else if (parts[2].includes('reconnecting')) {
        status = 'reconnecting';
      }

      nodeList.push({
        host,
        port,
        role,
        status,
      });
    });

    return nodeList;
  }

  /**
   * Get client based on mode (cluster or standalone)
   */
  getClient(): RedisClusterType | RedisClientType {
    if (this.useCluster && this.clusterClient) {
      return this.clusterClient;
    }
    return this.standaloneClient;
  }

  /**
   * Get pub client
   */
  getPubClient(): RedisClusterType | RedisClientType {
    return this.pubClient;
  }

  /**
   * Get sub client
   */
  getSubClient(): RedisClusterType | RedisClientType {
    return this.subClient;
  }

  /**
   * Check if running in cluster mode
   */
  isClusterMode(): boolean {
    return this.useCluster && this.isConnected;
  }

  /**
   * Get cluster health status
   */
  getClusterHealthStatus(): ClusterHealthStatus {
    return this.clusterHealthStatus;
  }

  /**
   * Check if Redis is available
   */
  isRedisAvailable(): boolean {
    return this.isConnected;
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.isConnected) {
      try {
        if (this.useCluster) {
          await Promise.all([
            this.clusterClient.quit(),
            this.pubClient.quit?.(),
            this.subClient.quit?.(),
          ]);
          this.logger.log('Redis Cluster disconnected');
        } else {
          await this.standaloneClient.quit();
          this.logger.log('Standalone Redis disconnected');
        }
      } catch (error) {
        this.logger.error(`Error disconnecting Redis: ${error.message}`);
      }
    }
  }
}
