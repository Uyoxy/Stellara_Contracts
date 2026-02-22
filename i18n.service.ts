import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Translation } from './entities/translation.entity';
import { CreateTranslationDto } from './dto/create-translation.dto';

@Injectable()
export class I18nService {
  private readonly defaultLang = 'en';
  private readonly supportedLangs = ['en', 'es', 'fr', 'de', 'zh', 'ja'];

  // In-memory cache for static system messages
  private staticTranslations: Record<string, Record<string, string>> = {
    en: {
      'WELCOME': 'Welcome to Stellara',
      'ERROR_NOT_FOUND': 'Resource not found',
      'SUCCESS': 'Operation successful',
    },
    es: {
      'WELCOME': 'Bienvenido a Stellara',
      'ERROR_NOT_FOUND': 'Recurso no encontrado',
      'SUCCESS': 'Operación exitosa',
    }
  };

  constructor(
    @InjectRepository(Translation)
    private translationRepository: Repository<Translation>,
  ) {}

  translate(key: string, lang: string = this.defaultLang): string {
    const targetLang = this.supportedLangs.includes(lang) ? lang : this.defaultLang;
    return this.staticTranslations[targetLang]?.[key] || key;
  }

  async setTranslation(dto: CreateTranslationDto): Promise<Translation> {
    let translation = await this.translationRepository.findOne({
      where: {
        resourceType: dto.resourceType,
        resourceId: dto.resourceId,
        languageCode: dto.languageCode,
        field: dto.field,
      },
    });

    if (translation) {
      translation.value = dto.value;
    } else {
      translation = this.translationRepository.create(dto);
    }

    return this.translationRepository.save(translation);
  }

  async getTranslation(resourceType: string, resourceId: string, field: string, lang: string): Promise<string | null> {
    const translation = await this.translationRepository.findOne({
      where: { resourceType, resourceId, languageCode: lang, field },
    });
    return translation ? translation.value : null;
  }

  getSupportedLanguages(): string[] {
    return this.supportedLangs;
  }
}