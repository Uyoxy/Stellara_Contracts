import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditService } from './audit.service';
import { AppModule } from '../app.module';

jest.setTimeout(30000); // extend timeout for async setup

describe('Audit Integration', () => {
  let app: INestApplication;
  let auditService: AuditService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ envFilePath: '.env.test', isGlobal: true }),
        AppModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    auditService = moduleRef.get<AuditService>(AuditService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should log an action and retrieve it via admin endpoint', async () => {
    // Arrange
    const action = { type: 'LOGIN', userId: 'test-user' };

    // Act
    await auditService.logAction(action);
    const result = await auditService.getActionsByUser('test-user');

    // Assert
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].type).toBe('LOGIN');
  });
});
