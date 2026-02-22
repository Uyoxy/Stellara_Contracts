import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt);
const randomBytes = promisify(crypto.randomBytes);

export interface EncryptionResult {
  encryptedData: string;
  iv: string;
  keyId: string;
  algorithm: string;
}

export interface FieldEncryptionResult {
  encryptedField: string;
  fieldKey: string;
}

@Injectable()
export class EncryptionService {
  private readonly masterKey: string;
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyRotationInterval = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

  constructor() {
    // In production, this would be loaded from secure key management system
    this.masterKey = process.env.ENCRYPTION_MASTER_KEY || 'default-master-key-change-in-production';
  }

  async encryptData(data: string, additionalData?: string): Promise<EncryptionResult> {
    try {
      const iv = crypto.randomBytes(16);
      const key = await this.deriveKey(data);
      
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      cipher.setAAD(Buffer.from(additionalData || ''));
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        keyId: this.generateKeyId(),
        algorithm: this.algorithm,
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  async decryptData(encryptedData: string, iv: string, keyId: string, additionalData?: string): Promise<string> {
    try {
      const key = await this.retrieveKey(keyId);
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAAD(Buffer.from(additionalData || ''));
      decipher.setAuthTag(Buffer.from(encryptedData.slice(-32), 'hex'));
      
      let decrypted = decipher.update(encryptedData.slice(0, -32), 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  async encryptField(fieldData: string): Promise<FieldEncryptionResult> {
    try {
      const fieldKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipheriv(this.algorithm, fieldKey, iv);
      let encrypted = cipher.update(fieldData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return {
        encryptedField: encrypted,
        fieldKey: fieldKey.toString('hex'),
      };
    } catch (error) {
      throw new Error(`Field encryption failed: ${error.message}`);
    }
  }

  async decryptField(encryptedField: string, fieldKey: string): Promise<string> {
    try {
      const key = Buffer.from(fieldKey, 'hex');
      const iv = Buffer.alloc(16, 0); // Use zero IV for field encryption
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      
      let decrypted = decipher.update(encryptedField, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Field decryption failed: ${error.message}`);
    }
  }

  async hashData(data: string): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.scrypt(data, 'salt', 64, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey.toString('hex'));
      });
    });
  }

  async generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      }, (err: Error | null, publicKey: string, privateKey: string) => {
        if (err) reject(err);
        else resolve({ publicKey, privateKey });
      });
    });
  }

  private async deriveKey(data: string): Promise<Buffer> {
    const salt = crypto.randomBytes(32);
    return crypto.scrypt(data, 'salt', 64, 32, (err: Error | null, derivedKey: Buffer) => {
  }

  private generateKeyId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private async retrieveKey(keyId: string): Promise<Buffer> {
    // In production, this would retrieve from secure key store
    // For now, derive from master key
    return crypto.createHash('sha256').update(this.masterKey + keyId).digest();
  }

  async rotateKeys(): Promise<{ oldKeyId: string; newKeyId: string }> {
    const oldKeyId = this.generateKeyId();
    const newKeyId = this.generateKeyId();
    
    // In production, this would:
    // 1. Generate new master key
    // 2. Re-encrypt all data with new key
    // 3. Update key references
    // 4. Archive old key securely
    
    return {
      oldKeyId,
      newKeyId,
    };
  }

  getEncryptionStatus(): {
    algorithm: string;
    lastRotation: Date;
    nextRotation: Date;
    keyCount: number;
  } {
    return {
      algorithm: this.algorithm,
      lastRotation: new Date(),
      nextRotation: new Date(Date.now() + this.keyRotationInterval),
      keyCount: 1, // Simplified - would query actual count
    };
  }
}
