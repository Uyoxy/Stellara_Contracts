import { Injectable, Logger } from '@nestjs/common';
import { BlockchainEvent } from '../entities/blockchain-event.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ensureOrdering, deduplicate } from '../utils/event-ordering';

@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);

  constructor(
    @InjectRepository(BlockchainEvent)
    private eventRepo: Repository<BlockchainEvent>,
  ) {}

  async processEvent(event: BlockchainEvent) {
    // Deduplication
    const exists = await this.eventRepo.findOneBy({ eventId: event.eventId });
    if (exists) {
      this.logger.warn(`Duplicate event ${event.eventId} skipped`);
      return;
    }

    // Ordering check
    await ensureOrdering(event);

    // Save event
    await this.eventRepo.save(event);

    // Mark processed
    event.processed = true;
    await this.eventRepo.save(event);
  }
}
