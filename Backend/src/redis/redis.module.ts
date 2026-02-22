import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisClusterConfigService } from './redis-cluster.config';

@Global() // makes Redis available everywhere
@Module({
  providers: [RedisClusterConfigService, RedisService],
  exports: [RedisClusterConfigService, RedisService],
})
export class RedisModule {}
