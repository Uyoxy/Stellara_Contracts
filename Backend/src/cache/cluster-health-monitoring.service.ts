import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService, ClusterHealthStatus } from '../redis/redis.service';
import { CacheMonitoringService } from './cache-monitoring.service';

/**
 * Cluster node metrics
 */
export interface ClusterNodeMetrics {
  nodeId: string;
  host: string;
  port: number;
  role: 'master' | 'replica';
  status: 'online' | 'offline' | 'reconnecting';
  connectionsAccepted: number;
  connectionsReceived: number;
  commandsProcessed: number;
  bytesRead: number;
  bytesWritten: number;
  memoryUsage: number;
  cpuTime: number;
  lastUpdate: number;
}

/**
 * Cluster performance metrics
 */
export interface ClusterPerformanceMetrics {
  timestamp: number;
  totalNodes: number;
  connectedNodes: number;
  slotsAssigned: number;
  slotsOk: number;
  slotsFailing: number;
  replicationRatio: number;
  averageLatency: number;
  p99Latency: number;
  commandsPerSecond: number;
  keyspaceSize: number;
  memoryUsageBytes: number;
}

/**
 * Cluster alert
 */
export interface ClusterAlert {
  id: string;
  type:
    | 'NODE_DOWN'
    | 'SLOT_MIGRATION'
    | 'REPLICATION_LAG'
    | 'MEMORY_PRESSURE'
    | 'LATENCY_SPIKE'
    | 'FAILOVER';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  nodeId?: string;
  timestamp: number;
  resolved: boolean;
  context?: any;
}

/**
 * Cluster Health Monitoring Service
 * Monitors cluster-specific metrics and health status
 */
@Injectable()
export class ClusterHealthMonitoringService implements OnModuleInit {
  private readonly logger = new Logger(ClusterHealthMonitoringService.name);
  private nodeMetrics: Map<string, ClusterNodeMetrics> = new Map();
  private performanceMetrics: ClusterPerformanceMetrics[] = [];
  private alerts: Map<string, ClusterAlert> = new Map();
  private readonly METRICS_HISTORY_KEY = 'cache:cluster:metrics:history';
  private readonly ALERTS_KEY = 'cache:cluster:alerts';
  private lastHealthCheckTime = 0;

  constructor(
    private readonly redisService: RedisService,
    private readonly cacheMonitoringService: CacheMonitoringService,
  ) {}

  async onModuleInit() {
    this.logger.log('ClusterHealthMonitoringService initialized');
    if (this.redisService.isClusterMode()) {
      await this.loadHistoricalMetrics();
      await this.performInitialHealthCheck();
    }
  }

  /**
   * Perform initial health check on startup
   */
  private async performInitialHealthCheck(): Promise<void> {
    try {
      const status = await this.redisService.performHealthCheck();
      this.logger.log(
        `Initial cluster health check: ${status.isHealthy ? 'Healthy' : 'Unhealthy'}, Nodes: ${status.connectedNodes}/${status.totalNodes}`,
      );
    } catch (error) {
      this.logger.error(`Initial health check failed: ${error.message}`);
    }
  }

  /**
   * Collect comprehensive cluster metrics
   */
  async collectClusterMetrics(): Promise<ClusterPerformanceMetrics> {
    try {
      if (!this.redisService.isClusterMode()) {
        return this.getEmptyMetrics();
      }

      const client = this.redisService.getClient();
      const health = this.redisService.getClusterHealthStatus();

      // Collect info from cluster
      // @ts-ignore
      const info = await client.info('stats');
      const clusterInfo = await this.collectionClusterInfo();

      const metrics: ClusterPerformanceMetrics = {
        timestamp: Date.now(),
        totalNodes: health.totalNodes,
        connectedNodes: health.connectedNodes,
        slotsAssigned: health.slots.covered,
        slotsOk: health.slots.covered,
        slotsFailing: 0,
        replicationRatio: this.calculateReplicationRatio(health),
        averageLatency: await this.calculateAverageLatency(),
        p99Latency: await this.calculateP99Latency(),
        commandsPerSecond: this.parseInfoValue(info, 'instantaneous_ops_per_sec'),
        keyspaceSize: await this.calculateKeyspaceSize(),
        memoryUsageBytes: await this.calculateMemoryUsage(),
      };

      this.performanceMetrics.push(metrics);

      // Keep only last 1000 metrics
      if (this.performanceMetrics.length > 1000) {
        this.performanceMetrics = this.performanceMetrics.slice(-1000);
      }

      await this.saveMetrics(metrics);
      return metrics;
    } catch (error) {
      this.logger.error(
        `Failed to collect cluster metrics: ${error.message}`,
      );
      return this.getEmptyMetrics();
    }
  }

  /**
   * Collect cluster-specific information
   */
  private async collectionClusterInfo(): Promise<any> {
    try {
      const client = this.redisService.getClient();
      // @ts-ignore
      return await client.clusterInfo?.();
    } catch (error) {
      this.logger.warn(`Failed to collect cluster info: ${error.message}`);
      return {};
    }
  }

  /**
   * Monitor individual node metrics
   */
  async monitorNodeMetrics(): Promise<Map<string, ClusterNodeMetrics>> {
    try {
      const health = this.redisService.getClusterHealthStatus();
      this.nodeMetrics.clear();

      for (const nodeInfo of health.nodeStatuses) {
        const metrics: ClusterNodeMetrics = {
          nodeId: `${nodeInfo.host}:${nodeInfo.port}`,
          host: nodeInfo.host,
          port: nodeInfo.port,
          role: (nodeInfo.role === 'master' || nodeInfo.role === 'replica') ? nodeInfo.role : 'master',
          status: nodeInfo.status === 'connected' ? 'online' : 'offline',
          connectionsAccepted: 0,
          connectionsReceived: 0,
          commandsProcessed: 0,
          bytesRead: 0,
          bytesWritten: 0,
          memoryUsage: 0,
          cpuTime: 0,
          lastUpdate: Date.now(),
        };

        // Try to get node-specific metrics
        try {
          const nodeMetrics = await this.getNodeInfo(nodeInfo.host, nodeInfo.port);
          Object.assign(metrics, nodeMetrics);
        } catch (error) {
          this.logger.warn(`Failed to get metrics for node ${metrics.nodeId}: ${error.message}`);
        }

        this.nodeMetrics.set(metrics.nodeId, metrics);
      }

      return this.nodeMetrics;
    } catch (error) {
      this.logger.error(`Failed to monitor node metrics: ${error.message}`);
      return new Map();
    }
  }

  /**
   * Get individual node information
   */
  private async getNodeInfo(
    host: string,
    port: number,
  ): Promise<Partial<ClusterNodeMetrics>> {
    try {
      const client = this.redisService.getClient();
      // @ts-ignore
      const info = await client.info?.('stats');

      return {
        commandsProcessed: this.parseInfoValue(info, 'total_commands_processed'),
        bytesRead: this.parseInfoValue(info, 'total_net_input_bytes'),
        bytesWritten: this.parseInfoValue(info, 'total_net_output_bytes'),
        connectionsAccepted: this.parseInfoValue(info, 'total_connections_received'),
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Detect cluster anomalies
   */
  async detectAnomalies(): Promise<ClusterAlert[]> {
    const newAlerts: ClusterAlert[] = [];

    try {
      const metrics = await this.collectClusterMetrics();
      const health = this.redisService.getClusterHealthStatus();

      // Check for node failures
      if (!health.isHealthy) {
        newAlerts.push({
          id: this.generateAlertId(),
          type: 'NODE_DOWN',
          severity: 'critical',
          message: `Cluster is unhealthy. Connected: ${health.connectedNodes}/${health.totalNodes}`,
          timestamp: Date.now(),
          resolved: false,
          context: { health },
        });
      }

      // Check slot migration issues
      if (metrics.slotsFailing > 0) {
        newAlerts.push({
          id: this.generateAlertId(),
          type: 'SLOT_MIGRATION',
          severity: 'high',
          message: `Cluster has ${metrics.slotsFailing} failing slots`,
          timestamp: Date.now(),
          resolved: false,
          context: { slotsFailing: metrics.slotsFailing },
        });
      }

      // Check latency spikes
      if (metrics.p99Latency > 100) {
        // > 100ms
        newAlerts.push({
          id: this.generateAlertId(),
          type: 'LATENCY_SPIKE',
          severity: 'medium',
          message: `P99 latency is high: ${metrics.p99Latency.toFixed(2)}ms`,
          timestamp: Date.now(),
          resolved: false,
          context: { p99Latency: metrics.p99Latency },
        });
      }

      // Check memory pressure
      if (metrics.memoryUsageBytes > 80 * 1024 * 1024 * 1024) {
        // > 80GB
        newAlerts.push({
          id: this.generateAlertId(),
          type: 'MEMORY_PRESSURE',
          severity: 'high',
          message: `Cluster memory usage is high: ${(metrics.memoryUsageBytes / 1024 / 1024 / 1024).toFixed(2)}GB`,
          timestamp: Date.now(),
          resolved: false,
          context: { memoryUsage: metrics.memoryUsageBytes },
        });
      }

      // Check replication lag
      if (metrics.replicationRatio < 0.5) {
        newAlerts.push({
          id: this.generateAlertId(),
          type: 'REPLICATION_LAG',
          severity: 'medium',
          message: `Replication ratio is low: ${(metrics.replicationRatio * 100).toFixed(2)}%`,
          timestamp: Date.now(),
          resolved: false,
          context: { replicationRatio: metrics.replicationRatio },
        });
      }

      // Store new alerts
      for (const alert of newAlerts) {
        this.alerts.set(alert.id, alert);
        await this.logAlert(alert);
      }

      return newAlerts;
    } catch (error) {
      this.logger.error(`Anomaly detection failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Get cluster health summary
   */
  async getClusterHealthSummary(): Promise<any> {
    const health = this.redisService.getClusterHealthStatus();
    const metrics = this.performanceMetrics[this.performanceMetrics.length - 1];
    const nodeMetrics = Array.from(this.nodeMetrics.values());

    const activeAlerts = Array.from(this.alerts.values()).filter(
      (a) => !a.resolved,
    );

    return {
      timestamp: Date.now(),
      cluster: {
        healthy: health.isHealthy,
        connectedNodes: health.connectedNodes,
        totalNodes: health.totalNodes,
        slotsAssigned: health.slots.covered,
        slotsUncovered: health.slots.uncovered,
      },
      performance: metrics || this.getEmptyMetrics(),
      nodes: nodeMetrics,
      alerts: {
        total: activeAlerts.length,
        critical: activeAlerts.filter((a) => a.severity === 'critical').length,
        high: activeAlerts.filter((a) => a.severity === 'high').length,
        medium: activeAlerts.filter((a) => a.severity === 'medium').length,
        low: activeAlerts.filter((a) => a.severity === 'low').length,
      },
      lastHealthCheck: this.lastHealthCheckTime,
    };
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.timestamp = Date.now();
      await this.logAlert(alert);
      this.logger.log(`Alert ${alertId} resolved`);
    }
  }

  /**
   * Periodic health check
   */
  @Cron('*/30 * * * * *') // Every 30 seconds
  async periodicHealthCheck(): Promise<void> {
    try {
      this.lastHealthCheckTime = Date.now();

      // Collect metrics
      await this.collectClusterMetrics();

      // Monitor nodes
      await this.monitorNodeMetrics();

      // Detect anomalies
      await this.detectAnomalies();
    } catch (error) {
      this.logger.error(`Periodic health check failed: ${error.message}`);
    }
  }

  /**
   * Get performance metrics history
   */
  getMetricsHistory(hours: number = 24): ClusterPerformanceMetrics[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.performanceMetrics.filter((m) => m.timestamp >= cutoff);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): ClusterAlert[] {
    return Array.from(this.alerts.values()).filter((a) => !a.resolved);
  }

  /**
   * Helper methods
   */

  private calculateReplicationRatio(health: ClusterHealthStatus): number {
    if (health.totalNodes === 0) return 0;
    const replicaNodes = health.nodeStatuses.filter(
      (n) => n.role === 'replica',
    ).length;
    return replicaNodes / health.totalNodes;
  }

  private async calculateAverageLatency(): Promise<number> {
    const latencies = this.performanceMetrics
      .slice(-100)
      .map((m) => m.averageLatency);
    return (
      latencies.reduce((a, b) => a + b, 0) / Math.max(latencies.length, 1)
    );
  }

  private async calculateP99Latency(): Promise<number> {
    const latencies = this.performanceMetrics
      .slice(-100)
      .map((m) => m.p99Latency)
      .sort((a, b) => a - b);
    return latencies[Math.floor(latencies.length * 0.99)] || 0;
  }

  private async calculateKeyspaceSize(): Promise<number> {
    try {
      const client = this.redisService.getClient();
      // @ts-ignore
      const info = await client.info?.('keyspace');
      return this.parseInfoValue(info, 'db0');
    } catch {
      return 0;
    }
  }

  private async calculateMemoryUsage(): Promise<number> {
    try {
      const client = this.redisService.getClient();
      // @ts-ignore
      const info = await client.info?.('memory');
      return this.parseInfoValue(info, 'used_memory');
    } catch {
      return 0;
    }
  }

  private parseInfoValue(info: string, key: string): number {
    const match = info?.match(new RegExp(`${key}:(\\d+)`));
    return match ? parseInt(match[1], 10) : 0;
  }

  private getEmptyMetrics(): ClusterPerformanceMetrics {
    return {
      timestamp: Date.now(),
      totalNodes: 0,
      connectedNodes: 0,
      slotsAssigned: 0,
      slotsOk: 0,
      slotsFailing: 0,
      replicationRatio: 0,
      averageLatency: 0,
      p99Latency: 0,
      commandsPerSecond: 0,
      keyspaceSize: 0,
      memoryUsageBytes: 0,
    };
  }

  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async loadHistoricalMetrics(): Promise<void> {
    // Load from Redis if needed
    this.logger.log('Historical metrics loaded');
  }

  private async saveMetrics(metrics: ClusterPerformanceMetrics): Promise<void> {
    try {
      const client = this.redisService.getClient();
      // @ts-ignore
      await client.lPush(
        this.METRICS_HISTORY_KEY,
        JSON.stringify(metrics),
      );
      // @ts-ignore
      await client.lTrim(this.METRICS_HISTORY_KEY, 0, 9999);
    } catch (error) {
      this.logger.error(`Failed to save metrics: ${error.message}`);
    }
  }

  private async logAlert(alert: ClusterAlert): Promise<void> {
    try {
      const client = this.redisService.getClient();
      // @ts-ignore
      await client.lPush(this.ALERTS_KEY, JSON.stringify(alert));
      // @ts-ignore
      await client.lTrim(this.ALERTS_KEY, 0, 999);
    } catch (error) {
      this.logger.error(`Failed to log alert: ${error.message}`);
    }
  }
}
