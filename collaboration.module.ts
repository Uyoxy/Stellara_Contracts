import { Module } from '@nestjs/common';
import { CollaborationService } from './collaboration.service';
import { CollaborationGateway } from './collaboration.gateway';
import { CollaborationController } from './collaboration.controller';

@Module({
  providers: [CollaborationService, CollaborationGateway],
  controllers: [CollaborationController],
  exports: [CollaborationService],
})
export class CollaborationModule {}