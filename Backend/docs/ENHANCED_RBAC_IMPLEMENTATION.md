# Enhanced RBAC System Implementation

## Overview

This document describes the enhanced Role-Based Access Control (RBAC) system implemented for the Stellara Contracts backend. The system provides fine-grained permission controls, role inheritance, dynamic role assignment, and comprehensive audit trails.

## Features Implemented

### 1. Fine-Grained Permission Controls
- **Permission Entity**: Individual permissions that can be granted to users
- **User Permissions**: Direct permission assignments to specific users
- **Permission Groups**: Organize related permissions into logical groups
- **Permission Expiration**: Time-based permission grants with expiration dates

### 2. Role Inheritance System
- **Role Hierarchy**: Define parent-child relationships between roles
- **Inheritance Resolution**: Users inherit permissions from all parent roles
- **Default Hierarchies**: Pre-configured role relationships:
  - MODERATOR → USER
  - ADMIN → MODERATOR
  - TENANT_ADMIN → USER
  - SUPERADMIN → ADMIN and TENANT_ADMIN

### 3. Dynamic Role Assignment
- **Runtime Role Changes**: Assign/modify user roles without application restart
- **Role Manager Service**: Centralized service for role management operations
- **Audit Trail**: Track all role assignments and modifications

### 4. Permission Audit Trails
- **Comprehensive Logging**: Record all permission-related actions
- **Action Types**: GRANTED, REVOKED, MODIFIED
- **Detailed Metadata**: Store context information for each action
- **Audit API**: Query permission history for compliance and debugging

## Architecture Components

### Entities

#### Permission
```typescript
@Entity('permissions')
export class Permission {
  id: string;
  name: string;          // Unique permission identifier
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### UserPermission
```typescript
@Entity('user_permissions')
export class UserPermission {
  id: string;
  user: User;
  permission: Permission;
  grantedBy?: string;    // User who granted the permission
  isActive: boolean;
  expiresAt?: Date;      // Optional expiration timestamp
  createdAt: Date;
  updatedAt: Date;
}
```

#### RoleHierarchy
```typescript
@Entity('role_hierarchies')
export class RoleHierarchy {
  id: string;
  childRole: Role;       // Role that inherits
  parentRole: Role;      // Role being inherited from
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### PermissionAudit
```typescript
@Entity('permission_audits')
export class PermissionAudit {
  id: string;
  userId: string;
  permissionId?: string;
  roleId?: string;
  action: PermissionAction;  // GRANTED | REVOKED | MODIFIED
  details?: Record<string, any>;
  performedBy: string;       // User who performed the action
  createdAt: Date;
}
```

### Services

#### RoleManagerService
Central service for all RBAC operations:

```typescript
class RoleManagerService {
  // Role management
  async assignRole(userId: string, newRole: Role, assignedBy: string): Promise<User>
  
  // Permission management
  async getUserPermissions(userId: string): Promise<string[]>
  async grantUserPermission(userId: string, permissionName: string, grantedBy: string): Promise<UserPermission>
  async revokeUserPermission(userId: string, permissionName: string, revokedBy: string): Promise<void>
  
  // Role hierarchy
  async createRoleHierarchy(childRole: Role, parentRole: Role): Promise<RoleHierarchy>
  async getRoleHierarchy(role: Role): Promise<Role[]>
  async getUserRoleHierarchy(userId: string): Promise<Role[]>
  
  // Audit
  async getPermissionAuditTrail(userId: string): Promise<PermissionAudit[]>
  async hasPermission(userId: string, permissionName: string): Promise<boolean>
}
```

### Guards

#### EnhancedRolesGuard
Enhanced authorization guard supporting both roles and permissions:

```typescript
// Role-based protection
@UseGuards(EnhancedRolesGuard)
@Roles('admin', 'superadmin')
@Controller('admin')

// Permission-based protection
@UseGuards(EnhancedRolesGuard)
@Permissions('manage_users', 'view_reports')
@Controller('secure')
```

### Controllers

#### PermissionController
API endpoints for permission management:

```typescript
@Controller('permissions')
export class PermissionController {
  // Get user permissions
  GET /permissions/user/:userId
  
  // Grant/revoke permissions
  POST /permissions/user/:userId/grant
  DELETE /permissions/user/:userId/revoke
  
  // Role management
  PUT /permissions/user/:userId/role
  
  // Role hierarchy
  POST /permissions/hierarchy
  
  // Audit trails
  GET /permissions/user/:userId/audit
  
  // Permission checking
  GET /permissions/user/:userId/has/:permission
  
  // Role hierarchy query
  GET /permissions/user/:userId/roles
}
```

## Usage Examples

### 1. Granting Permissions
```typescript
// Grant a specific permission to a user
await roleManagerService.grantUserPermission(
  'user-123',
  'manage_users',
  'admin-456'
);

// Grant permission with expiration
const userPermission = new UserPermission();
userPermission.user = user;
userPermission.permission = permission;
userPermission.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
```

### 2. Role Inheritance
```typescript
// Create role hierarchy
await roleManagerService.createRoleHierarchy(
  Role.MODERATOR,
  Role.ADMIN
);

// User with MODERATOR role now inherits ADMIN permissions
const permissions = await roleManagerService.getUserPermissions('user-123');
// Returns both MODERATOR and ADMIN permissions
```

### 3. Controller Protection
```typescript
@Controller('api/admin')
@UseGuards(EnhancedRolesGuard)
export class AdminController {
  
  @Get('users')
  @Permissions('view_users')
  getUsers() {
    // Only users with 'view_users' permission can access
  }
  
  @Post('users')
  @Roles('admin', 'superadmin')
  createUser() {
    // Only admin or superadmin roles can access
  }
  
  @Delete('users/:id')
  @Permissions('delete_users')
  @Roles('admin')
  deleteUser(@Param('id') id: string) {
    // Requires both 'delete_users' permission AND admin role
  }
}
```

### 4. Audit Trail Query
```typescript
// Get all permission changes for a user
const auditTrail = await roleManagerService.getPermissionAuditTrail('user-123');

// Example audit entry:
{
  id: 'audit-1',
  userId: 'user-123',
  permissionId: 'perm-456',
  action: 'GRANTED',
  details: { 
    permissionName: 'manage_users',
    grantedBy: 'admin-789'
  },
  performedBy: 'admin-789',
  createdAt: '2024-01-15T10:30:00Z'
}
```

## Database Migration

The system includes a comprehensive migration that:
1. Creates all new RBAC tables
2. Establishes foreign key relationships
3. Adds the `role` column to the users table
4. Seeds default permissions and role hierarchies
5. Provides rollback capability

## Security Considerations

### 1. Permission Validation
- All permissions are validated against database records
- Role inheritance is resolved at runtime
- Permission checks are performed before route execution

### 2. Audit Logging
- All permission changes are logged with user context
- Immutable audit trail prevents tampering
- Detailed metadata enables forensic analysis

### 3. Data Integrity
- Foreign key constraints ensure referential integrity
- Cascade deletes handle related entity cleanup
- Unique constraints prevent duplicate permissions

## Testing

Comprehensive test suite included:
- Unit tests for RoleManagerService
- Integration tests for permission resolution
- Guard behavior validation
- Audit trail verification

## API Endpoints Summary

| Endpoint | Method | Description | Required Permissions |
|----------|--------|-------------|---------------------|
| `/permissions/user/:userId` | GET | Get user permissions | `view_permissions` |
| `/permissions/user/:userId/grant` | POST | Grant user permission | `manage_permissions` |
| `/permissions/user/:userId/revoke` | DELETE | Revoke user permission | `manage_permissions` |
| `/permissions/user/:userId/role` | PUT | Assign user role | `manage_roles` |
| `/permissions/hierarchy` | POST | Create role hierarchy | `manage_roles` |
| `/permissions/user/:userId/audit` | GET | Get audit trail | `view_audit_logs` |
| `/permissions/user/:userId/has/:permission` | GET | Check permission | `view_permissions` |
| `/permissions/user/:userId/roles` | GET | Get role hierarchy | `view_permissions` |

## Future Enhancements

1. **Permission Groups**: Organize permissions into logical groups
2. **Time-based Permissions**: Schedule permission activation/deactivation
3. **Resource-level Permissions**: Fine-grained access to specific resources
4. **Permission Templates**: Pre-defined permission sets for common scenarios
5. **Role Templates**: Standardized role configurations
6. **Multi-tenancy Integration**: Tenant-specific permission scopes

## Migration Notes

To upgrade from the existing RBAC system:
1. Run the database migration
2. Update existing code to use EnhancedRolesGuard
3. Migrate existing role assignments to the new system
4. Update permission checks to use the new decorator syntax