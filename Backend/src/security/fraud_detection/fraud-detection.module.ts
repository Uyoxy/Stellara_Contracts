import { Module } from '@nestjs/common';
import { FraudDetectionService } from './fraud-detection.service';
import { RiskScoringService } from './risk-scoring.service';
import { BehavioralAnalysisService } from './behavioral-analysis.service';
import { MitigationService } from './mitigation.service';
import { FraudDetectionController } from './fraud-detection.controller';

@Module({
  imports: [
    // Import required modules here
  ],
  controllers: [FraudDetectionController],
  providers: [
    FraudDetectionService,
    RiskScoringService,
    BehavioralAnalysisService,
    MitigationService,
  ],
  exports: [
    FraudDetectionService,
    RiskScoringService,
    BehavioralAnalysisService,
    MitigationService,
  ],
})
export class FraudDetectionModule {}
