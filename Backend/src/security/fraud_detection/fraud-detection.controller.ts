import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { FraudDetectionService, UserActivity, RiskScore } from './fraud-detection.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('fraud-detection')
@Controller('fraud-detection')
export class FraudDetectionController {
  constructor(private readonly fraudDetectionService: FraudDetectionService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze user activity for fraud detection' })
  @ApiResponse({ status: 200, description: 'Risk analysis completed' })
  async analyzeActivity(@Body() activity: UserActivity): Promise<RiskScore> {
    return this.fraudDetectionService.analyzeUserActivity(activity);
  }

  @Get('alerts/:userId')
  @ApiOperation({ summary: 'Get fraud alerts for a user' })
  @ApiResponse({ status: 200, description: 'List of fraud alerts' })
  async getFraudAlerts(
    @Param('userId') userId: string,
  ): Promise<any[]> {
    return this.fraudDetectionService.getFraudAlerts(userId);
  }

  @Get('risk-score/:userId')
  @ApiOperation({ summary: 'Get current risk score for a user' })
  @ApiResponse({ status: 200, description: 'Current risk score' })
  async getCurrentRiskScore(@Param('userId') userId: string): Promise<{ score: number; confidence: number }> {
    // This would typically query the latest risk score from database
    // For now, return a placeholder
    return {
      score: 0.25,
      confidence: 0.85,
    };
  }

  @Post('mitigate/:alertId')
  @ApiOperation({ summary: 'Apply mitigation actions for a fraud alert' })
  @ApiResponse({ status: 200, description: 'Mitigation actions applied' })
  async applyMitigation(
    @Param('alertId') alertId: string,
    @Body() actions: { actions: string[] },
  ): Promise<{ success: boolean; appliedActions: string[] }> {
    // In a real implementation, this would update the fraud alert
    // and trigger the specified mitigation actions
    return {
      success: true,
      appliedActions: actions.actions,
    };
  }
}
