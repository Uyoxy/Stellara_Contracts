import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip, headers, body } = request;
    const userAgent = headers['user-agent'];

    return next.handle().pipe(
      tap({
        next: () => {
          // Log mutating actions
          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
            this.auditService.logAction({
              userId: user?.id || 'anonymous',
              action: `${method} ${url}`,
              resource: url.split('/')[1] || 'root',
              ipAddress: ip,
              userAgent,
              status: 'SUCCESS',
              severity: 'low',
              details: { method, url, body: this.sanitizeBody(body) },
            });
          }
        },
        error: (error) => {
           this.auditService.logAction({
              userId: user?.id || 'anonymous',
              action: `${method} ${url}`,
              resource: url.split('/')[1] || 'root',
              ipAddress: ip,
              userAgent,
              status: 'FAILURE',
              severity: 'medium',
              details: { error: error.message },
            });
        },
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'creditCard'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) sanitized[field] = '***REDACTED***';
    });
    return sanitized;
  }
}