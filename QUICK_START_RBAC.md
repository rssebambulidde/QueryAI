# Quick Start: Role-Based Access Control

## 1. Run Database Migration

```sql
-- In Supabase SQL Editor, run:
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'owner'));
```

Or use the migration file:
```bash
# Copy SQL from backend/src/database/migrations/030_add_user_roles.sql
# Paste into Supabase SQL Editor and run
```

## 2. Set First User as Owner

```sql
-- Set the first user (or your email) as owner
UPDATE user_profiles 
SET role = 'owner' 
WHERE email = 'your-email@example.com';
```

Or use the script:
```bash
ts-node backend/src/scripts/set-user-role.ts your-email@example.com owner --by-email
```

## 3. Use in Frontend Components

### Protect a Page:
```typescript
// app/dashboard/admin/page.tsx
import { AdminGuard } from '@/components/admin/admin-guard';

export default function AdminPage() {
  return (
    <AdminGuard>
      <h1>Admin Dashboard</h1>
    </AdminGuard>
  );
}
```

### Conditional Rendering:
```typescript
import { useUserRole } from '@/lib/hooks/use-user-role';

function MyComponent() {
  const { isAdmin, isOwner } = useUserRole();
  
  return (
    <div>
      {isAdmin && <AdminPanel />}
      {isOwner && <OwnerSettings />}
    </div>
  );
}
```

## 4. Use in Backend Routes

```typescript
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin, requireOwner } from '../middleware/authorization.middleware';

// Admin route
router.get('/admin/users', authenticate, requireAdmin, handler);

// Owner route
router.delete('/admin/users/:id', authenticate, requireOwner, handler);
```

## That's It!

See `ROLE_BASED_ACCESS_CONTROL.md` for complete documentation.
