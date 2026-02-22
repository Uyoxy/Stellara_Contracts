import { Controller, Get, Post, Body, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuditService } from './audit.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { AuditQueryDto } from './dto/audit-query.dto';
// Note: Guards should be imported from auth module in actual implementation
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Post('internal/log')
  async createLog(@Body() createAuditLogDto: CreateAuditLogDto) {
    return this.auditService.logAction(createAuditLogDto);
  }

  @Get()
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('admin', 'auditor')
  async getLogs(@Query() query: AuditQueryDto) {
    return this.auditService.findAll(query);
  }

  @Get('report')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('admin', 'auditor')
  async downloadReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    const csv = await this.auditService.generateReport(new Date(startDate), new Date(endDate));
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit-report-${Date.now()}.csv"`,
    });
    return res.send(csv);
  }
}