import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainEvent } from './entities/blockchain-event.entity';
import { StellarListener } from './listeners/stellar.listener';
import { EventProcessorService } from './processors/event-processor.service';
import { StateSyncService } from './synchronizers/state-sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([BlockchainEvent])],
  providers: [StellarListener, EventProcessorService, StateSyncService],
  exports: [StellarListener, EventProcessorService, StateSyncService],
})
export class BlockchainModule {}
