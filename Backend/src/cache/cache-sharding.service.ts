import { Injectable, Logger } from '@nestjs/common';
import { RedisClusterConfigService } from '../redis/redis-cluster.config';
import * as crypto from 'crypto';

/**
 * Shard information
 */
export interface ShardInfo {
  id: number;
  slot: number;
  nodeIndex: number;
}

/**
 * Cache sharding strategy
 */
export enum ShardingStrategy {
  CONSISTENT_HASH = 'consistent-hash',
  KEY_RANGE = 'key-range',
  CRC16 = 'crc16',
}

/**
 * Cache Sharding Service
 * Implements consistent hashing and key distribution strategies
 */
@Injectable()
export class CacheShardingService {
  private readonly logger = new Logger(CacheShardingService.name);
  private strategy: ShardingStrategy;
  private numberOfNodes: number;
  private hashRing: Map<number, number> = new Map(); // hash -> nodeIndex
  private readonly VIRTUAL_NODES = 160; // 160 virtual nodes per physical node
  private slotMap: Map<number, number> = new Map(); // slot -> nodeIndex (for CRC16)

  constructor(
    private readonly clusterConfigService: RedisClusterConfigService,
  ) {
    const configStrategy =
      this.clusterConfigService.getShardingStrategy();
    this.strategy =
      configStrategy === 'consistent-hash'
        ? ShardingStrategy.CONSISTENT_HASH
        : ShardingStrategy.CRC16;

    const nodes = this.clusterConfigService.getClusterNodes();
    this.numberOfNodes = nodes.length || 1;

    this.initializeSharding();
  }

  /**
   * Initialize sharding based on strategy
   */
  private initializeSharding(): void {
    switch (this.strategy) {
      case ShardingStrategy.CONSISTENT_HASH:
        this.initializeConsistentHash();
        break;
      case ShardingStrategy.CRC16:
        this.initializeCRC16();
        break;
      default:
        this.initializeSimpleModulo();
    }

    this.logger.log(
      `Sharding initialized with strategy: ${this.strategy}, nodes: ${this.numberOfNodes}`,
    );
  }

  /**
   * Initialize consistent hash ring
   */
  private initializeConsistentHash(): void {
    this.hashRing.clear();

    for (let nodeIndex = 0; nodeIndex < this.numberOfNodes; nodeIndex++) {
      for (let i = 0; i < this.VIRTUAL_NODES; i++) {
        const virtualKey = `${nodeIndex}-${i}`;
        const hash = this.hashKey(virtualKey);
        this.hashRing.set(hash, nodeIndex);
      }
    }

    this.logger.log(
      `Consistent hash ring initialized with ${this.hashRing.size} virtual nodes`,
    );
  }

  /**
   * Initialize CRC16 slot mapping (Redis Cluster compatible)
   */
  private initializeCRC16(): void {
    this.slotMap.clear();

    // Redis Cluster has 16384 slots (0-16383)
    const slotsPerNode = Math.ceil(16384 / this.numberOfNodes);

    for (let slot = 0; slot < 16384; slot++) {
      const nodeIndex = Math.floor(slot / slotsPerNode) % this.numberOfNodes;
      this.slotMap.set(slot, nodeIndex);
    }

    this.logger.log(
      `CRC16 slot mapping initialized: ${this.numberOfNodes} nodes, ${slotsPerNode} slots per node`,
    );
  }

  /**
   * Simple modulo initialization
   */
  private initializeSimpleModulo(): void {
    this.logger.log(
      `Simple modulo sharding initialized with ${this.numberOfNodes} nodes`,
    );
  }

  /**
   * Get shard index for a key
   */
  getShardIndex(key: string): number {
    switch (this.strategy) {
      case ShardingStrategy.CONSISTENT_HASH:
        return this.getShardIndexConsistentHash(key);
      case ShardingStrategy.CRC16:
        return this.getShardIndexCRC16(key);
      default:
        return this.getShardIndexModulo(key);
    }
  }

  /**
   * Get shard using consistent hash
   */
  private getShardIndexConsistentHash(key: string): number {
    const hash = this.hashKey(key);

    // Find the first node with hash >= key hash
    let sortedHashes = Array.from(this.hashRing.keys()).sort((a, b) => a - b);
    for (const nodeHash of sortedHashes) {
      if (nodeHash >= hash) {
        return this.hashRing.get(nodeHash) || 0;
      }
    }

    // Wrap around: return first node
    return this.hashRing.get(sortedHashes[0]) || 0;
  }

  /**
   * Get shard using CRC16 (Redis Cluster compatible)
   */
  private getShardIndexCRC16(key: string): number {
    const slot = this.calculateSlot(key);
    return this.slotMap.get(slot) || 0;
  }

  /**
   * Get shard using simple modulo
   */
  private getShardIndexModulo(key: string): number {
    const hash = this.hashKey(key);
    return Math.abs(hash) % this.numberOfNodes;
  }

  /**
   * Hash a key using MD5
   */
  private hashKey(key: string): number {
    const hash = crypto.createHash('md5').update(key).digest();
    let result = 0;
    for (let i = 0; i < 4; i++) {
      result |= hash[i] << (i * 8);
    }
    return Math.abs(result);
  }

  /**
   * Calculate Redis Cluster compatible CRC16 slot
   * This is simplified - Redis uses specific CRC16-CCITT poly
   */
  private calculateSlot(key: string): number {
    // Extract hash tag if present: {user:1000}.followers -> user:1000
    const tagMatch = key.match(/\{([^}]+)\}/);
    const hashKey = tagMatch ? tagMatch[1] : key;

    // Simplified CRC16 calculation
    let crc = 0;
    for (const char of hashKey) {
      const byte = char.charCodeAt(0);
      for (let i = 0; i < 8; i++) {
        const b = ((byte >> i) ^ crc) & 1;
        crc = crc >> 1;
        if (b) crc ^= 0xa001; // CRC16-CCITT polynomial
      }
    }

    return crc & 0x3fff; // 14 bits for 16384 slots
  }

  /**
   * Get shard information for multiple keys
   */
  getShardMap(keys: string[]): Map<number, string[]> {
    const shardMap = new Map<number, string[]>();

    for (const key of keys) {
      const shardIndex = this.getShardIndex(key);
      if (!shardMap.has(shardIndex)) {
        shardMap.set(shardIndex, []);
      }
      shardMap.get(shardIndex)!.push(key);
    }

    return shardMap;
  }

  /**
   * Get all keys for a shard
   */
  getKeysForShard(shardIndex: number, prefix: string = ''): string[] {
    const keys: string[] = [];

    if (this.strategy === ShardingStrategy.CONSISTENT_HASH) {
      // For consistent hash, we'd need to track which keys are in which shard
      // This would require maintaining a registry or scanning
      this.logger.warn(
        'Getting keys for shard is not efficient with consistent hash',
      );
    } else if (this.strategy === ShardingStrategy.CRC16) {
      // For CRC16, we can determine the slot range for this node
      const slotsPerNode = Math.ceil(16384 / this.numberOfNodes);
      const startSlot = shardIndex * slotsPerNode;
      const endSlot = Math.min(startSlot + slotsPerNode, 16384);

      for (let slot = startSlot; slot < endSlot; slot++) {
        // This is a simplified version; actual implementation would need key scanning
        keys.push(`${prefix}:slot:${slot}`);
      }
    }

    return keys;
  }

  /**
   * Rebalance shards (called when nodes are added/removed)
   */
  rebalance(newNumberOfNodes: number): void {
    this.numberOfNodes = newNumberOfNodes;
    this.initializeSharding();
    this.logger.log(
      `Sharding rebalanced for ${newNumberOfNodes} nodes`,
    );
  }

  /**
   * Get sharding statistics
   */
  getStatistics(): {
    strategy: string;
    numberofNodes: number;
    ringSize: number;
    slotCount: number;
  } {
    return {
      strategy: this.strategy,
      numberofNodes: this.numberOfNodes,
      ringSize: this.hashRing.size,
      slotCount: this.slotMap.size,
    };
  }

  /**
   * Validate shard consistency
   * Check if keys are distributed evenly
   */
  async validateDistribution(testKeys: string[]): Promise<{
    balanced: boolean;
    distribution: Map<number, number>;
    imbalanceRatio: number;
  }> {
    const distribution = new Map<number, number>();

    for (const key of testKeys) {
      const shardIndex = this.getShardIndex(key);
      distribution.set(
        shardIndex,
        (distribution.get(shardIndex) || 0) + 1,
      );
    }

    // Calculate balance
    const counts = Array.from(distribution.values());
    const avg = counts.reduce((a, b) => a + b, 0) / this.numberOfNodes;
    const maxDeviation = Math.max(...counts.map((c) => Math.abs(c - avg)));
    const imbalanceRatio = maxDeviation / avg;
    const balanced = imbalanceRatio < 0.2; // Less than 20% imbalance

    return {
      balanced,
      distribution,
      imbalanceRatio,
    };
  }
}
