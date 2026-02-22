# Internationalization (i18n) Implementation

## Overview
The i18n module provides a framework for multi-language support in the Stellara backend. It handles language detection, static string translation, and dynamic content translation management.

## Features

### 1. Language Detection
- **Middleware**: `I18nMiddleware`
- **Priority**: 
  1. Query Parameter (`?lang=es`)
  2. Accept-Language Header
  3. Default (`en`)
- **Access**: Available in controllers via `req.language`

### 2. Dynamic Content Translation
- **Entity**: `Translation`
- **Storage**: Database table `translations`
- **Scope**: Translates specific fields of resources (e.g., Course Title, Product Description).
- **Uniqueness**: Ensures one translation per resource field per language.

### 3. Static Translation
- **Service**: `I18nService.translate(key, lang)`
- **Usage**: For system messages, error codes, and static UI labels.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/i18n/supported-languages` | List supported language codes |
| POST | `/i18n/translations` | Create or update a translation |
| GET | `/i18n/translations/:type/:id/:field` | Get specific translation |

## Usage Examples

### Setting a Translation
```json
POST /i18n/translations
{
  "resourceType": "course",
  "resourceId": "uuid-123",
  "languageCode": "es",
  "field": "title",
  "value": "Introducción a Blockchain"
}
```

### Retrieving Content
The service can be injected to fetch translations:
```typescript
const title = await i18nService.getTranslation('course', 'uuid-123', 'title', 'es');
```

## Database Schema
```typescript
class Translation {
  id: string;
  resourceType: string;
  resourceId: string;
  languageCode: string;
  field: string;
  value: string;
}
```