import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { AuditLog } from './audit.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { AuditQueryDto } from './dto/audit-query.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
  ) {}

  async logAction(createAuditLogDto: CreateAuditLogDto): Promise<AuditLog> {
    const log = this.auditRepository.create(createAuditLogDto);
    
    // Real-time alerting logic
    if (log.severity === 'high' || log.severity === 'critical') {
      this.triggerAlert(log);
    }

    return this.auditRepository.save(log);
  }

  async findAll(query: AuditQueryDto): Promise<{ logs: AuditLog[]; total: number }> {
    const { userId, action, startDate, endDate, page = 1, limit = 10 } = query;
    const where: FindOptionsWhere<AuditLog> = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate));
    }

    const [logs, total] = await this.auditRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return { logs, total };
  }

  async generateReport(startDate: Date, endDate: Date): Promise<string> {
    const logs = await this.auditRepository.find({
      where: { createdAt: Between(startDate, endDate) },
      order: { createdAt: 'ASC' },
    });
    
    // Convert to CSV format
    const header = 'ID,Timestamp,User,Action,Status,Severity,IP,Details\n';
    const rows = logs.map(log => 
      `${log.id},${log.createdAt.toISOString()},${log.userId || 'system'},${log.action},${log.status},${log.severity},${log.ipAddress},"${JSON.stringify(log.details || {}).replace(/"/g, '""')}"`
    ).join('\n');

    return header + rows;
  }

  private triggerAlert(log: AuditLog) {
    this.logger.warn(`SECURITY ALERT: High severity action detected - ${log.action} by ${log.userId || 'unknown'} from ${log.ipAddress}`);
    // In production, this would integrate with PagerDuty, Slack, or Email service
  }
}