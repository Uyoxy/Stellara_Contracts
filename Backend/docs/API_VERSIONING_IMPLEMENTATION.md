# API Versioning Implementation Guide

## Overview

This guide explains how to implement and use the API versioning system in the Stellara platform.

## Quick Start

### 1. Enable Versioning Module

Add the ApiVersioningModule to your AppModule:

```typescript
// app.module.ts
import { ApiVersioningModule } from './api-versioning/api-versioning.module';

@Module({
  imports: [
    // ... other modules
    ApiVersioningModule,
  ],
  providers: [
    // ... other providers
    VersionMiddleware, // Add globally
  ],
})
export class AppModule {}
```

### 2. Version Your Controllers

Use the `@ApiVersion` decorator to specify which versions your controller supports:

```typescript
import { ApiVersion } from '../api-versioning/version.decorators';

@ApiVersion('v1')
@Controller('users')
export class UsersController {
  // Controller implementation
}
```

### 3. Version Individual Endpoints

You can also version specific endpoints:

```typescript
@ApiVersion(['v1', 'v2']) // Supports both versions
@Get(':id')
getUser(@Param('id') id: string) {
  // Implementation
}
```

## Version Detection Methods

The system supports multiple ways to specify API versions:

### 1. URL Path (Recommended)
```
GET /v1/users/profile
GET /v2/users/profile
```

### 2. Accept Header
```
Accept: application/vnd.stellara.v2+json
```

### 3. Custom Header
```
API-Version: 2
```

### 4. Query Parameter
```
GET /users/profile?version=2
```

## Migration Example

### Step 1: Create V1 Controller
```typescript
@ApiVersion('v1')
@Controller('auth')
export class AuthV1Controller {
  @Post('login')
  async login(@Body() dto: LoginDto) {
    // V1 implementation
    return { token: 'jwt-token' };
  }
}
```

### Step 2: Create V2 Controller with Enhanced Features
```typescript
@ApiVersion('v2')
@Controller('auth')
export class AuthV2Controller {
  @Post('login')
  async login(@Body() dto: LoginDto, @Request() req) {
    // V2 implementation with enhanced security
    return {
      accessToken: 'jwt-token',
      refreshToken: 'refresh-token',
      sessionInfo: {
        sessionId: 'session-id',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    };
  }
}
```

### Step 3: Mark V1 as Deprecated
```typescript
@ApiVersionDeprecated('v1', {
  sunsetDate: new Date('2027-03-01'),
  migrationGuide: 'https://docs.stellara.network/migration/v1-to-v2'
})
@Controller('auth')
export class AuthV1Controller {
  // V1 endpoints will show deprecation warnings
}
```

## Response Headers

All versioned responses include helpful headers:

```
API-Version: v2
API-Deprecated: true (when applicable)
API-Sunset: Wed, 01 Mar 2027 00:00:00 GMT (when deprecated)
API-Migration-Guide: https://docs.stellara.network/migration/v1-to-v2
```

## Error Responses

### Unsupported Version
```http
400 Bad Request
Content-Type: application/json

{
  "error": "InvalidAPIVersion",
  "message": "API version 'v3' is not supported",
  "supported_versions": ["v1", "v2"],
  "latest_version": "v2",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Deprecated Version Warning
```http
200 OK
API-Version: v1
API-Deprecated: true
API-Sunset: 2027-03-01T00:00:00Z

{
  "data": "...",
  "warnings": ["API version v1 is deprecated and will be removed in 45 days"]
}
```

## Configuration

### Environment Variables

```env
# Default API version when none specified
API_DEFAULT_VERSION=v1

# Version prefix in URLs
API_VERSION_PREFIX=v

# Deprecation configurations
API_DEPRECATIONS=[{"version":"v1","deprecationDate":"2026-01-01","sunsetDate":"2027-03-01","migrationGuide":"https://docs.stellara.network/migration/v1-to-v2"}]
```

## Best Practices

### 1. Versioning Strategy
- Use semantic versioning (v1, v2, v1.1, etc.)
- Major versions for breaking changes
- Minor versions for backward-compatible additions
- Patch versions for bug fixes

### 2. Controller Organization
- Keep versioned controllers in separate files
- Use clear naming conventions (UserControllerV1, UserControllerV2)
- Maintain backward compatibility within major versions

### 3. Documentation
- Update OpenAPI specs for each version
- Provide clear migration guides
- Document breaking changes
- Maintain changelogs

### 4. Testing
- Test all supported versions
- Verify version routing works correctly
- Test deprecation warnings
- Validate migration paths

## Migration Tools

### Data Transformation
```typescript
const migrationService = new ApiMigrationService(versioningService);

const result = migrationService.migrate(
  oldData,
  'v1',
  'v2',
  { strict: true }
);

if (result.success) {
  // Use transformed data
  const newData = result.transformedData;
} else {
  // Handle migration errors
  console.error('Migration failed:', result.errors);
}
```

### Register Migration Rules
```typescript
migrationService.registerMigrationRule({
  fromVersion: 'v1',
  toVersion: 'v2',
  transformer: (data) => {
    // Transform v1 data to v2 format
    return {
      ...data,
      newField: data.oldField || 'default',
      nested: {
        userId: data.userId,
        preferences: data.preferences || {}
      }
    };
  },
  description: 'Transform user data structure for v2'
});
```

## Monitoring

### Track Version Usage
- Monitor requests by version
- Track deprecated version usage
- Alert on high usage of deprecated versions
- Monitor migration progress

### Metrics to Collect
- Request volume per version
- Error rates by version
- Deprecation warning responses
- Migration adoption rates

## Security Considerations

### Version-Specific Security
- Different authentication methods per version
- Separate rate limiting policies
- Version-specific input validation
- Independent security patches

### Backward Compatibility
- Apply security patches to all supported versions
- Critical vulnerabilities patched immediately
- Security headers version-aware

## Troubleshooting

### Common Issues

1. **Version Not Detected**
   - Check URL path format
   - Verify headers are correctly set
   - Ensure middleware is registered

2. **Wrong Version Returned**
   - Check version precedence (path > header > query)
   - Verify controller version decorators
   - Review routing configuration

3. **Deprecation Warnings Not Showing**
   - Verify deprecation configuration
   - Check sunset dates
   - Ensure version is actually deprecated

### Debugging Tips

1. Enable debug logging for versioning services
2. Check request headers and path in logs
3. Verify version configuration in environment
4. Test with different version detection methods

## Next Steps

1. Implement versioning for your specific controllers
2. Configure deprecation timelines
3. Set up monitoring and alerting
4. Create migration documentation
5. Update client SDKs
6. Test thoroughly in staging environment

For detailed API reference, see [API_VERSIONING.md](./API_VERSIONING.md)