import { Module, Global, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { I18nService } from './i18n.service';
import { I18nController } from './i18n.controller';
import { Translation } from './entities/translation.entity';
import { I18nMiddleware } from './i18n.middleware';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Translation])],
  controllers: [I18nController],
  providers: [I18nService],
  exports: [I18nService],
})
export class I18nModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(I18nMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}