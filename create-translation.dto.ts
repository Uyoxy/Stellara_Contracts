export class CreateTranslationDto {
  resourceType: string;
  resourceId: string;
  languageCode: string;
  field: string;
  value: string;
}