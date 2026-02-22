import { Module } from '@nestjs/common';

// Import sub-modules when they are ready
// import { FraudDetectionModule } from './fraud_detection/fraud-detection.module';
// import { EncryptionModule } from './encryption/encryption.module';
// import { KeyManagementModule } from './key_management/key-management.module';

@Module({
  imports: [
    // FraudDetectionModule,
    // EncryptionModule,
    // KeyManagementModule,
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class SecurityModule {}
