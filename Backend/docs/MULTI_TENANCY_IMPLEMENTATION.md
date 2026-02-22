# Multi-Tenancy Implementation for Stellara Backend

## Overview

This document describes the multi-tenancy implementation for the Stellara backend, enabling the platform to support enterprise customers with isolated data and configurations while sharing infrastructure.

## Architecture

### Core Components

1. **Tenant Entity** - Represents an organization/customer with isolated data
2. **Tenant Configuration** - Tenant-specific settings and preferences
3. **Tenant Usage Tracking** - Analytics and billing metrics
4. **Tenant Onboarding** - Workflow for new tenant setup
5. **Tenant Guard** - Access control and tenant isolation
6. **Tenant Context Middleware** - Request context management

## Database Schema

### Tenants Table
```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR UNIQUE NOT NULL,
    name VARCHAR NOT NULL,
    description TEXT,
    status ENUM('active', 'inactive', 'suspended', 'pending') DEFAULT 'pending',
    billingPlan ENUM('free', 'starter', 'pro', 'enterprise') DEFAULT 'free',
    stripeCustomerId VARCHAR,
    metadata JSONB DEFAULT '{}',
    createdAt TIMESTAMP DEFAULT NOW(),
    updatedAt TIMESTAMP DEFAULT NOW(),
    suspendedAt TIMESTAMP,
    activatedAt TIMESTAMP
);
```

### Tenant Configurations
```sql
CREATE TABLE tenant_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenantId UUID REFERENCES tenants(id) ON DELETE CASCADE,
    configType ENUM('general', 'auth', 'billing', 'features', 'integrations') DEFAULT 'general',
    key VARCHAR NOT NULL,
    value JSONB NOT NULL,
    isActive BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT NOW(),
    updatedAt TIMESTAMP DEFAULT NOW()
);
```

### Tenant Usage Tracking
```sql
CREATE TABLE tenant_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenantId UUID REFERENCES tenants(id) ON DELETE CASCADE,
    metric ENUM('api_calls', 'storage_bytes', 'users_count', 'transactions', 'workflow_executions'),
    value BIGINT NOT NULL,
    date DATE NOT NULL,
    metadata JSONB DEFAULT '{}',
    createdAt TIMESTAMP DEFAULT NOW(),
    updatedAt TIMESTAMP DEFAULT NOW()
);
```

### Tenant Invitations
```sql
CREATE TABLE tenant_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenantId UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR NOT NULL,
    role VARCHAR NOT NULL,
    status ENUM('pending', 'accepted', 'expired', 'revoked') DEFAULT 'pending',
    token VARCHAR NOT NULL,
    expiresAt TIMESTAMP NOT NULL,
    metadata JSONB DEFAULT '{}',
    createdAt TIMESTAMP DEFAULT NOW(),
    updatedAt TIMESTAMP DEFAULT NOW(),
    acceptedAt TIMESTAMP
);
```

### User-Tenant Relationship
Added `tenantId` column to existing `users` table with foreign key constraint.

## Implementation Details

### 1. Tenant Entity (`tenant.entity.ts`)

The Tenant entity represents an organization/customer with the following properties:
- **id**: Unique identifier (UUID)
- **slug**: Unique URL-friendly identifier
- **name**: Organization name
- **description**: Optional description
- **status**: Current status (active, inactive, suspended, pending)
- **billingPlan**: Subscription tier (free, starter, pro, enterprise)
- **stripeCustomerId**: Payment processor identifier
- **metadata**: Flexible configuration data
- **createdAt/updatedAt**: Timestamps
- **suspendedAt/activatedAt**: Status change timestamps

### 2. Tenant Service (`tenant.service.ts`)

Core functionality:
- **CRUD Operations**: Create, read, update, delete tenants
- **Status Management**: Activate, suspend tenants
- **Access Validation**: Verify user-tenant relationships
- **Slug Generation**: Create unique tenant identifiers
- **Statistics**: Tenant counts and metrics

### 3. Tenant Configuration Service (`tenant-config.service.ts`)

Manages tenant-specific settings:
- **Config Types**: General, Auth, Billing, Features, Integrations
- **Key-Value Storage**: Flexible configuration system
- **Type Safety**: Configured by category
- **Migration Support**: Bulk configuration updates

### 4. Tenant Usage Service (`tenant-usage.service.ts`)

Tracks and analyzes tenant consumption:
- **Usage Metrics**: API calls, storage, users, transactions, workflows
- **Time-based Analytics**: Daily usage, trends, statistics
- **Reporting**: Usage summaries and comparisons
- **Billing Integration**: Usage-based pricing support

### 5. Tenant Onboarding Service (`tenant-onboarding.service.ts`)

Guides new tenants through setup:
- **Step-by-step Process**: Structured onboarding workflow
- **Admin Invitation**: Automated admin user creation
- **Progress Tracking**: Completion monitoring
- **Activation Workflow**: Automatic tenant activation

### 6. Tenant Guard (`tenant.guard.ts`)

Security layer for tenant isolation:
- **Access Control**: Validates user-tenant relationships
- **Context Injection**: Attaches tenant data to requests
- **Multi-source Detection**: Header, subdomain, parameter extraction

### 7. Tenant Context Middleware (`tenant-context.middleware.ts`)

Request processing enhancement:
- **Automatic Detection**: Extracts tenant from various sources
- **Context Attachment**: Makes tenant available throughout request lifecycle
- **Graceful Degradation**: Continues processing if tenant not found

## API Endpoints

### Tenant Management
```
POST   /tenants              # Create new tenant (admin only)
GET    /tenants              # List all tenants (admin only)
GET    /tenants/stats        # Get tenant statistics (admin only)
GET    /tenants/:id          # Get specific tenant
PUT    /tenants/:id          # Update tenant
DELETE /tenants/:id          # Delete tenant (soft delete)
POST   /tenants/:id/activate # Activate tenant
POST   /tenants/:id/suspend  # Suspend tenant
```

### Tenant Usage
```
GET    /tenants/:id/usage    # Get usage statistics
GET    /tenants/:id/usage/daily # Get daily usage
GET    /tenants/:id/usage/trends # Get usage trends
```

### Tenant Onboarding
```
POST   /tenants/:id/onboard  # Start onboarding process
GET    /tenants/:id/onboarding-status # Get onboarding progress
POST   /tenants/:id/onboard/complete-step # Complete onboarding step
```

### Tenant Configuration
```
GET    /tenants/:id/config   # Get all configuration
GET    /tenants/:id/config/:type # Get configuration by type
POST   /tenants/:id/config   # Set configuration
PUT    /tenants/:id/config/:key # Update specific config
DELETE /tenants/:id/config/:key # Delete configuration
```

## Security Implementation

### Role-Based Access Control
- **Admin**: Full tenant management
- **Tenant Admin**: Manage own tenant users and view usage
- **User**: Limited tenant access based on membership

### Tenant Isolation
- **Database Level**: Foreign key constraints ensure data separation
- **Application Level**: Guards and middleware enforce access control
- **API Level**: Route parameters and headers control tenant context

### Data Protection
- **Soft Deletes**: Tenants marked inactive instead of removed
- **Audit Logging**: All tenant operations tracked
- **Access Validation**: Every request validates tenant permissions

## Migration Strategy

### From Single-Tenant to Multi-Tenant

1. **Schema Migration**: Run `AddTenantSchema` migration
2. **Default Tenant Creation**: Create initial tenant for existing data
3. **User Assignment**: Associate existing users with default tenant
4. **Configuration Migration**: Move global settings to tenant configs
5. **Usage Initialization**: Set up initial usage tracking

### Backward Compatibility
- Existing APIs continue working with default tenant context
- New tenant-aware endpoints provide enhanced functionality
- Gradual migration path minimizes disruption

## Configuration

### Environment Variables
```env
# Tenant Configuration
DEFAULT_TENANT_SLUG=main
TENANT_SUBDOMAIN_ENABLED=true
TENANT_HEADER_NAME=x-tenant-id

# Onboarding Settings
ONBOARDING_AUTO_ACTIVATE=true
INVITATION_EXPIRY_DAYS=7
MAX_TENANTS_PER_USER=5
```

### Feature Flags
```typescript
{
  "multiTenancy": {
    "enabled": true,
    "subdomainRouting": true,
    "headerRouting": true,
    "parameterRouting": false
  }
}
```

## Monitoring and Analytics

### Key Metrics
- Active tenant count
- Tenant creation rate
- Usage per tenant
- Onboarding completion rates
- Tenant suspension/activation events

### Health Checks
- Tenant database connectivity
- Configuration service availability
- Usage tracking functionality
- Onboarding process status

## Testing Strategy

### Unit Tests
- Tenant service CRUD operations
- Configuration management
- Usage tracking calculations
- Onboarding workflow logic

### Integration Tests
- End-to-end tenant creation
- Multi-tenant data isolation
- API endpoint access control
- Migration scenarios

### Performance Tests
- Concurrent tenant operations
- Large tenant dataset handling
- Usage analytics performance
- Configuration lookup speed

## Deployment Considerations

### Database
- Ensure proper indexing on tenant-related columns
- Monitor foreign key constraint performance
- Plan for tenant data growth

### Caching
- Tenant configuration caching
- Usage statistics caching
- Tenant metadata caching

### Scaling
- Horizontal scaling with tenant-aware load balancing
- Tenant data sharding considerations
- Cross-tenant query optimization

## Future Enhancements

### Planned Features
1. **Tenant Billing Integration**: Stripe/Paddle payment processing
2. **Advanced Analytics**: Predictive usage and cost forecasting
3. **Tenant Templates**: Pre-configured tenant setups
4. **Cross-Tenant Features**: Shared resources and collaboration
5. **Tenant Marketplaces**: Third-party integrations and extensions

### Performance Optimizations
1. **Database Partitioning**: Tenant-based data partitioning
2. **Caching Layers**: Redis-based tenant data caching
3. **Query Optimization**: Tenant-aware query optimization
4. **Background Processing**: Asynchronous tenant operations

## Troubleshooting

### Common Issues
1. **Tenant Not Found**: Check slug uniqueness and activation status
2. **Access Denied**: Verify user-tenant relationship and role permissions
3. **Configuration Errors**: Validate JSON structure and required fields
4. **Usage Tracking**: Ensure proper metric recording and date ranges

### Debugging Tools
1. **Tenant Status API**: Check tenant health and configuration
2. **Usage Analytics**: Monitor consumption patterns
3. **Audit Logs**: Track all tenant-related operations
4. **Migration Status**: Verify schema and data migration completion

## Conclusion

This multi-tenancy implementation provides a robust foundation for enterprise customer support while maintaining the existing single-tenant functionality. The modular design allows for gradual adoption and future enhancements while ensuring data isolation and security.