import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FraudActivity, RiskFactor, AlertSeverity } from './models/fraud-activity.entity';

export interface UserActivity {
  userId: string;
  activityType: string;
  amount: number;
  timestamp: Date;
  ipAddress: string;
  deviceId: string;
  location?: string;
}

export interface RiskScore {
  userId: string;
  score: number;
  confidence: number;
  factors: RiskFactor[];
  timestamp: Date;
}

export interface FraudAlert {
  id: string;
  userId: string;
  riskScore: number;
  activityType: string;
  description: string;
  severity: AlertSeverity;
  timestamp: Date;
  mitigationActions: string[];
}

@Injectable()
export class FraudDetectionService {
  constructor(
    @InjectRepository(FraudActivity)
    private fraudActivityRepository: Repository<FraudActivity>,
  ) {}

  async analyzeUserActivity(activity: UserActivity): Promise<RiskScore> {
    const riskFactors = this.calculateRiskFactors(activity);
    const riskScore = this.calculateRiskScore(riskFactors);
    const confidence = this.calculateConfidence(riskFactors);

    // Store the analysis
    const fraudActivity = this.fraudActivityRepository.create({
      userId: activity.userId,
      activityType: activity.activityType,
      amount: activity.amount,
      timestamp: activity.timestamp,
      ipAddress: activity.ipAddress,
      deviceId: activity.deviceId,
      location: activity.location,
      riskScore,
      confidence,
      riskFactors,
      alertSeverity: this.determineAlertSeverity(riskScore),
      mitigationActions: this.generateMitigationActions(riskScore),
    });

    await this.fraudActivityRepository.save(fraudActivity);

    return {
      userId: activity.userId,
      score: riskScore,
      confidence,
      factors: riskFactors,
      timestamp: new Date(),
    };
  }

  private calculateRiskFactors(activity: UserActivity): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // Amount-based risk
    if (activity.amount > 10000) {
      factors.push({
        name: 'high_amount',
        weight: 0.3,
        value: activity.amount,
        explanation: 'Transaction amount exceeds typical user behavior threshold',
      });
    }

    // Frequency-based risk (simplified - in real implementation, would query DB)
    factors.push({
      name: 'transaction_frequency',
      weight: 0.2,
      value: Math.random() * 10, // Placeholder for frequency analysis
      explanation: 'Analysis of transaction frequency patterns',
    });

    // Location-based risk
    if (activity.location) {
      factors.push({
        name: 'unusual_location',
        weight: 0.15,
        value: 1,
        explanation: 'Transaction from unusual geographic location',
      });
    }

    // Time-based risk
    const hour = new Date(activity.timestamp).getHours();
    if (hour < 6 || hour > 22) {
      factors.push({
        name: 'unusual_time',
        weight: 0.1,
        value: 1,
        explanation: 'Transaction during unusual hours',
      });
    }

    return factors;
  }

  private calculateRiskScore(factors: RiskFactor[]): number {
    return factors.reduce((score, factor) => {
      return score + (factor.weight * factor.value);
    }, 0);
  }

  private calculateConfidence(factors: RiskFactor[]): number {
    // Higher confidence with more data points
    const baseConfidence = 0.5;
    const factorBonus = Math.min(factors.length * 0.1, 0.4);
    return Math.min(baseConfidence + factorBonus, 0.95);
  }

  private determineAlertSeverity(score: number): AlertSeverity {
    if (score >= 0.8) return AlertSeverity.CRITICAL;
    if (score >= 0.6) return AlertSeverity.HIGH;
    if (score >= 0.4) return AlertSeverity.MEDIUM;
    return AlertSeverity.LOW;
  }

  private generateMitigationActions(score: number): string[] {
    const actions: string[] = [];

    if (score >= 0.8) {
      actions.push('freeze_account');
      actions.push('require_manual_review');
      actions.push('notify_security_team');
    } else if (score >= 0.6) {
      actions.push('require_additional_verification');
      actions.push('limit_transaction_size');
    } else if (score >= 0.4) {
      actions.push('enhanced_monitoring');
      actions.push('user_notification');
    }

    return actions;
  }

  async getFraudAlerts(userId: string, limit = 50): Promise<FraudAlert[]> {
    const activities = await this.fraudActivityRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return activities.map(activity => ({
      id: activity.id,
      userId: activity.userId,
      riskScore: activity.riskScore,
      activityType: activity.activityType,
      description: this.generateAlertDescription(activity),
      severity: activity.alertSeverity,
      timestamp: activity.createdAt,
      mitigationActions: activity.mitigationActions,
    }));
  }

  private generateAlertDescription(activity: FraudActivity): string {
    const primaryFactor = activity.riskFactors
      .sort((a, b) => b.weight - a.weight)[0];
    
    return `Suspicious activity detected: ${primaryFactor.explanation}. Risk score: ${activity.riskScore}`;
  }
}
