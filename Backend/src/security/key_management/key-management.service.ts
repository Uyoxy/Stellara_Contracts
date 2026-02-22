import { Injectable } from '@nestjs/common';

export interface KeyMetadata {
  keyId: string;
  algorithm: string;
  keySize: number;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
  keyType: 'master' | 'data' | 'field';
}

export interface KeyRotationResult {
  oldKeyId: string;
  newKeyId: string;
  rotationTimestamp: Date;
  affectedDataCount: number;
}

export interface HSMStatus {
  connected: boolean;
  vendor: string;
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  lastHealthCheck: Date;
}

@Injectable()
export class KeyManagementService {
  private readonly keys: Map<string, KeyMetadata> = new Map();
  private readonly rotationInterval = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor() {
    this.initializeDefaultKeys();
  }

  private initializeDefaultKeys(): void {
    const masterKey: KeyMetadata = {
      keyId: 'master-key-001',
      algorithm: 'aes-256-gcm',
      keySize: 256,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.rotationInterval),
      isActive: true,
      keyType: 'master',
    };

    this.keys.set(masterKey.keyId, masterKey);
  }

  async generateKey(keyType: 'data' | 'field' = 'data'): Promise<KeyMetadata> {
    const keyId = this.generateKeyId();
    const keyMetadata: KeyMetadata = {
      keyId,
      algorithm: 'aes-256-gcm',
      keySize: 256,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.rotationInterval),
      isActive: true,
      keyType,
    };

    this.keys.set(keyId, keyMetadata);
    return keyMetadata;
  }

  async rotateKeys(): Promise<KeyRotationResult> {
    const oldKeyId = this.getCurrentActiveKey('master')?.keyId;
    const newKeyId = this.generateKeyId();

    // Deactivate old key
    if (oldKeyId) {
      const oldKey = this.keys.get(oldKeyId);
      if (oldKey) {
        oldKey.isActive = false;
        oldKey.expiresAt = new Date(); // Immediate expiration for old key
      }
    }

    // Generate new master key
    const newKey: KeyMetadata = {
      keyId: newKeyId,
      algorithm: 'aes-256-gcm',
      keySize: 256,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.rotationInterval),
      isActive: true,
      keyType: 'master',
    };

    this.keys.set(newKeyId, newKey);

    return {
      oldKeyId: oldKeyId || 'none',
      newKeyId,
      rotationTimestamp: new Date(),
      affectedDataCount: await this.countEncryptedData(oldKeyId),
    };
  }

  async revokeKey(keyId: string): Promise<boolean> {
    const key = this.keys.get(keyId);
    if (!key) {
      return false;
    }

    key.isActive = false;
    key.expiresAt = new Date();
    return true;
  }

  getCurrentActiveKey(keyType: 'master' | 'data' | 'field'): KeyMetadata | undefined {
    for (const key of this.keys.values()) {
      if (key.keyType === keyType && key.isActive) {
        return key;
      }
    }
    return undefined;
  }

  getKeyMetadata(keyId: string): KeyMetadata | undefined {
    return this.keys.get(keyId);
  }

  listKeys(keyType?: 'master' | 'data' | 'field'): KeyMetadata[] {
    const allKeys = Array.from(this.keys.values());
    return keyType ? allKeys.filter(key => key.keyType === keyType) : allKeys;
  }

  async getHSMStatus(): Promise<HSMStatus> {
    // In a real implementation, this would connect to actual HSM
    // For now, return a mock status
    return {
      connected: true,
      vendor: 'Nitrokey HSM',
      model: 'HSM 2000',
      serialNumber: 'HK-2024-001',
      firmwareVersion: '2.1.0',
      lastHealthCheck: new Date(),
    };
  }

  async validateHSMConnection(): Promise<boolean> {
    try {
      const hsmStatus = await this.getHSMStatus();
      return hsmStatus.connected;
    } catch (error) {
      console.error('HSM validation failed:', error);
      return false;
    }
  }

  async performHSMBackup(): Promise<{ success: boolean; backupId: string }> {
    // In a real implementation, this would trigger HSM backup
    const backupId = this.generateKeyId();
    
    return {
      success: true,
      backupId,
    };
  }

  private generateKeyId(): string {
    return `key-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async countEncryptedData(keyId: string): Promise<number> {
    // In a real implementation, this would query the database
    // For now, return a mock count
    return Math.floor(Math.random() * 1000) + 100;
  }

  getKeyRotationSchedule(): {
    nextRotation: Date;
    lastRotation: Date;
    interval: number;
  } {
    const currentKey = this.getCurrentActiveKey('master');
    return {
      nextRotation: currentKey ? new Date(currentKey.expiresAt.getTime()) : new Date(),
      lastRotation: currentKey ? new Date(currentKey.createdAt.getTime()) : new Date(),
      interval: this.rotationInterval,
    };
  }
}
