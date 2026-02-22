import { Injectable, Logger } from '@nestjs/common';
import { Horizon } from 'stellar-sdk'; // Example SDK

@Injectable()
export class StellarListener {
  private readonly logger = new Logger(StellarListener.name);

  async startListening() {
    const server = new Horizon.Server('https://horizon.stellar.org');
    server
      .transactions()
      .cursor('now')
      .stream({
        onmessage: (tx) => {
          this.logger.log(`Received event: ${tx.id}`);
          // Push to processor queue
        },
        onerror: (err) => {
          this.logger.error('Listener error', err);
          // Retry logic
        },
      });
  }
}
