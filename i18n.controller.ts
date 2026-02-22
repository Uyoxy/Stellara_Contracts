import { Controller, Get, Post, Body, Query, Param, Req } from '@nestjs/common';
import { I18nService } from './i18n.service';
import { CreateTranslationDto } from './dto/create-translation.dto';

@Controller('i18n')
export class I18nController {
  constructor(private readonly i18nService: I18nService) {}

  @Get('supported-languages')
  getSupportedLanguages() {
    return this.i18nService.getSupportedLanguages();
  }

  @Post('translations')
  // @Roles('admin', 'translator')
  async setTranslation(@Body() createTranslationDto: CreateTranslationDto) {
    return this.i18nService.setTranslation(createTranslationDto);
  }

  @Get('translations/:resourceType/:resourceId/:field')
  async getTranslation(
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
    @Param('field') field: string,
    @Query('lang') lang: string,
    @Req() req: any
  ) {
    const targetLang = lang || req.language || 'en';
    const value = await this.i18nService.getTranslation(resourceType, resourceId, field, targetLang);
    return { 
      value: value || null,
      lang: targetLang 
    };
  }
}