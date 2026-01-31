# Frontend Feature Visibility Matrix

This document lists **ALL** features that should be visible in the frontend based on **subscription tier** and **user role**.

---

## Access Control Rules

1. **Role Takes Precedence**: Admin/super_admin roles bypass subscription tier restrictions
2. **Tier Limits**: Regular users are subject to subscription tier limits
3. **Feature Flags**: Some features are enabled/disabled based on tier limits

---

## 📊 Subscription Tier Limits

| Feature | Free | Starter | Premium | Pro | Enterprise |
|---------|------|---------|---------|-----|------------|
| **Queries/Month** | 50 | 100 | 500 | Unlimited | Unlimited |
| **Document Uploads** | 0 | 3 | 10 | Unlimited | Unlimited |
| **Topics** | 0 | 1 | 3 | Unlimited | Unlimited |
| **Web Searches/Month** | 5 | 10 | 50 | 200 | Unlimited |
| **Document Upload Feature** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Embedding Feature** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Analytics Feature** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **API Access** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **White Label** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Team Collaboration** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Max Team Members** | - | - | - | - | 50 |

---

## 🎯 Frontend Features by Tier & Role

### 🔓 PUBLIC FEATURES (No Authentication Required)

**Visible to:** Everyone (including non-authenticated users)

- ✅ Landing Page (`/`)
- ✅ Login Page (`/login`)
- ✅ Signup Page (`/signup`)
- ✅ Enterprise Contact Form (`/api/enterprise/inquiry`)

---

### 🔐 AUTHENTICATED FEATURES (Any User)

**Visible to:** All authenticated users regardless of tier or role

#### Core Features
- ✅ **Main Dashboard** (`/dashboard`)
  - Chat Interface
  - Query Assistant
  - Basic AI responses
  - Conversation history
  - Message regeneration
  - Feedback submission

- ✅ **Collections** (`/dashboard` - Collections tab)
  - Create collections
  - Organize conversations
  - Search collections
  - Add/remove conversations from collections

- ✅ **Conversations**
  - View conversation history
  - Create new conversations
  - Delete conversations
  - Export conversations

- ✅ **Usage Tracking**
  - Current usage display
  - Usage warnings
  - Usage history
  - Cost tracking

- ✅ **Profile Settings** (`/dashboard/settings/profile`)
  - Update profile
  - Change avatar
  - Update name

- ✅ **Subscription Management** (`/dashboard/settings/subscription`)
  - View current subscription
  - View tier limits
  - Upgrade/downgrade options
  - Cancel subscription
  - Payment history

- ✅ **Search Settings** (`/dashboard/settings/search`)
  - Configure search preferences

- ✅ **Citations Settings** (`/dashboard/settings/citations`)
  - Configure citation preferences

- ✅ **Advanced RAG Settings** (`/dashboard/settings/advanced`)
  - Configure RAG parameters

#### Tier-Limited Features (Backend Enforced)
These features are visible but limited by tier:

- ✅ **AI Queries** - Limited by `queriesPerMonth`
- ✅ **Document Upload** - Limited by `documentUploads` (Free: 0, Starter: 3, Premium: 10, Pro/Enterprise: Unlimited)
- ✅ **Topics** - Limited by `maxTopics` (Free: 0, Starter: 1, Premium: 3, Pro/Enterprise: Unlimited)
- ✅ **Web Searches** - Limited by `tavilySearchesPerMonth`

---

### 💎 PREMIUM FEATURES (Premium/Pro Tier Required)

**Visible to:** Users with `premium` or `pro` tier + Admins (bypass)

#### Analytics & Reporting
- ✅ **Analytics Dashboard** (`/dashboard/analytics`)
  - User analytics overview
  - Query statistics
  - Top queries
  - API usage metrics
  - Usage by date (Pro only)

- ✅ **Cost Analytics**
  - Cost trends (`/api/analytics/cost/trends`)
  - Cost alerts (`/api/analytics/alerts`)
  - Alert checks (`/api/analytics/alerts/check`)
  - Alert acknowledgment (`/api/analytics/alerts/:id/acknowledge`)

- ✅ **Usage Analytics**
  - Usage analytics (`/api/analytics/monitoring/usage`)
  - Performance metrics (`/api/analytics/monitoring/performance`)

#### Advanced Features
- ✅ **Document Management** (`/dashboard/settings/documents`)
  - Upload documents (Premium: 10, Pro: Unlimited)
  - View document chunks
  - Regenerate embeddings
  - Document metadata

- ✅ **Topics Management** (`/dashboard/settings/topics`)
  - Create topics (Premium: 3, Pro: Unlimited)
  - Topic-scoped AI
  - Topic configuration

- ✅ **Embedding Features**
  - Document embeddings
  - Semantic search
  - RAG with documents

**Note:** Admins with `free` tier can access all premium features (bypass enabled)

---

### 🏢 ENTERPRISE FEATURES (Enterprise Tier Required)

**Visible to:** Users with `enterprise` tier

- ✅ **Team Collaboration** (`/dashboard/settings/team`)
  - Create teams
  - Manage team members (up to 50)
  - Team settings
  - Team access control

- ✅ **Enterprise API**
  - List teams (`/api/enterprise/teams`)
  - Create teams (`/api/enterprise/teams`)

---

### 👑 ADMIN FEATURES (Admin/Super Admin Role Required)

**Visible to:** Users with `admin` or `super_admin` role (regardless of tier)

#### Admin Dashboard Pages
- ✅ **Health Monitoring** (`/dashboard/health`)
  - System health dashboard
  - Performance metrics
  - Error rates
  - Throughput metrics
  - Component performance
  - Alert system

- ✅ **System Analytics** (`/dashboard/analytics`)
  - Platform-wide analytics
  - System metrics
  - Platform cost summary

- ✅ **Validation Reports** (`/dashboard/validation`)
  - Test suite runner
  - Test case editor
  - Results dashboard
  - Quality scores
  - Comparison charts
  - Historical reports

- ✅ **A/B Testing** (`/dashboard/ab-testing`)
  - Create A/B tests
  - View test metrics
  - Statistical analysis
  - Test export

#### Super Admin Only
- ✅ **User Management** (`/dashboard/admin/users`)
  - List all users
  - View user details
  - Update user roles
  - Search users

#### Admin Sidebar Menu Items
- ✅ **Admin Section** (visible when `isAdmin === true`)
  - A/B Testing
  - Validation Reports
  - User Management (super_admin only)

**Note:** Admins can access these features even with `free` tier subscription.

---

## 📋 Feature Visibility by Tier

### FREE TIER (Regular User)

**Core Features:**
- ✅ Chat Interface
- ✅ AI Queries (50/month limit)
- ✅ Web Searches (5/month limit)
- ✅ Conversations
- ✅ Collections
- ✅ Usage Tracking
- ✅ Profile Settings
- ✅ Subscription Settings

**Limited/Disabled:**
- ❌ Document Upload (0 documents)
- ❌ Topics (0 topics)
- ❌ Analytics Dashboard
- ❌ Cost Analytics
- ❌ Usage Analytics
- ❌ API Access
- ❌ White Label
- ❌ Team Collaboration

**Upgrade Prompts:**
- Show upgrade buttons in subscription settings
- Show upgrade prompts when limits reached

---

### STARTER TIER (Regular User)

**Core Features:**
- ✅ All Free tier features
- ✅ Document Upload (3 documents)
- ✅ Topics (1 topic)
- ✅ Web Searches (10/month limit)

**Still Limited:**
- ❌ Analytics Dashboard
- ❌ Cost Analytics
- ❌ Usage Analytics
- ❌ API Access
- ❌ White Label
- ❌ Team Collaboration

**Upgrade Prompts:**
- Show upgrade to Premium/Pro options

---

### PREMIUM TIER (Regular User)

**Core Features:**
- ✅ All Starter tier features
- ✅ Document Upload (10 documents)
- ✅ Topics (3 topics)
- ✅ Web Searches (50/month limit)
- ✅ **Analytics Dashboard** (`/dashboard/analytics`)
- ✅ **Cost Analytics** (cost trends, alerts)
- ✅ **Usage Analytics** (usage, performance)
- ✅ **Document Management** (full features)
- ✅ **Topics Management** (up to 3 topics)
- ✅ Embedding features

**Still Limited:**
- ❌ API Access
- ❌ White Label
- ❌ Team Collaboration
- ❌ Usage by Date charts (Pro only)

**Upgrade Prompts:**
- Show upgrade to Pro for unlimited features

---

### PRO TIER (Regular User)

**Core Features:**
- ✅ All Premium tier features
- ✅ **Unlimited Queries**
- ✅ **Unlimited Document Uploads**
- ✅ **Unlimited Topics**
- ✅ **Web Searches** (200/month)
- ✅ **Usage by Date Charts** (Pro exclusive)
- ✅ **API Access** (`/dashboard/settings/api`)
- ✅ **White Label** features

**Still Limited:**
- ❌ Team Collaboration

**Upgrade Prompts:**
- Show upgrade to Enterprise for team features

---

### ENTERPRISE TIER (Regular User)

**Core Features:**
- ✅ All Pro tier features
- ✅ **Unlimited Web Searches**
- ✅ **Team Collaboration** (`/dashboard/settings/team`)
- ✅ **Team Management** (up to 50 members)
- ✅ Create/manage teams
- ✅ Team access control

**No Limits:**
- ✅ Unlimited everything
- ✅ All features enabled

---

## 👑 ADMIN FEATURES (By Role)

### ADMIN ROLE (Any Tier)

**Additional Features:**
- ✅ **Admin Sidebar Section**
  - A/B Testing
  - Validation Reports

- ✅ **Admin Dashboard Pages**
  - `/dashboard/health` - Health monitoring
  - `/dashboard/analytics` - System analytics
  - `/dashboard/validation` - Validation reports
  - `/dashboard/ab-testing` - A/B testing

- ✅ **Premium Features Access** (bypass)
  - Can access all premium analytics even with free tier
  - Can access cost trends, alerts, monitoring

**Note:** Admins bypass subscription tier checks for premium features.

---

### SUPER_ADMIN ROLE (Any Tier)

**Additional Features:**
- ✅ All Admin features
- ✅ **User Management** (`/dashboard/admin/users`)
  - List all users
  - View user details
  - Update user roles
  - Search users

- ✅ **Super Admin Sidebar Item**
  - User Management link

**Note:** Super admins have full access to everything.

---

## 📱 Frontend Pages Visibility Matrix

| Page | Free | Starter | Premium | Pro | Enterprise | Admin | Super Admin |
|------|------|---------|---------|-----|------------|-------|-------------|
| `/dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/dashboard/settings/profile` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/dashboard/settings/subscription` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/dashboard/settings/search` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/dashboard/settings/citations` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/dashboard/settings/advanced` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/dashboard/settings/documents` | ✅* | ✅* | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/dashboard/settings/topics` | ✅* | ✅* | ✅* | ✅ | ✅ | ✅ | ✅ |
| `/dashboard/settings/api` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅** | ✅** |
| `/dashboard/settings/team` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅** | ✅** |
| `/dashboard/analytics` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅** | ✅** |
| `/dashboard/health` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/dashboard/validation` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/dashboard/ab-testing` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/dashboard/admin/users` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

**Legend:**
- ✅ = Visible and accessible
- ✅* = Visible but limited (backend enforces limits)
- ✅** = Visible via admin bypass (even with lower tier)
- ❌ = Not visible/not accessible

---

## 🎨 Sidebar Menu Items Visibility

### Main Navigation (All Users)
- ✅ Query Assistant (Chat)
- ✅ Collections
- ✅ Conversations

### Admin Section (Admin/Super Admin Only)
- ✅ A/B Testing
- ✅ Validation Reports
- ✅ User Management (Super Admin only)

### Account Dropdown (All Users)
- ✅ Profile
- ✅ Settings
- ✅ Subscription
- ✅ Logout

---

## 🔧 Settings Navigation Items

| Setting Page | Free | Starter | Premium | Pro | Enterprise | Admin Bypass |
|--------------|------|---------|---------|-----|------------|--------------|
| Profile | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Search | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Citations | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Advanced RAG | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Subscription | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Documents | ✅* | ✅* | ✅ | ✅ | ✅ | ✅ |
| Topics | ✅* | ✅* | ✅* | ✅ | ✅ | ✅ |
| API | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Team | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

**Note:** ✅* = Visible but backend enforces limits

---

## 📊 Feature Access Summary

### By Subscription Tier

**FREE:**
- Core chat features
- Limited queries (50/month)
- Limited web searches (5/month)
- No document upload
- No topics
- No analytics
- No API access

**STARTER:**
- All Free features
- Document upload (3 docs)
- Topics (1 topic)
- More queries (100/month)
- More web searches (10/month)

**PREMIUM:**
- All Starter features
- More documents (10 docs)
- More topics (3 topics)
- Analytics dashboard
- Cost analytics
- Usage analytics
- More queries (500/month)
- More web searches (50/month)

**PRO:**
- All Premium features
- Unlimited queries
- Unlimited documents
- Unlimited topics
- Usage by date charts
- API access
- White label
- More web searches (200/month)

**ENTERPRISE:**
- All Pro features
- Unlimited web searches
- Team collaboration
- Team management (50 members)

### By Role

**USER (Regular):**
- Subject to subscription tier limits
- No admin features

**ADMIN:**
- All user features
- Admin dashboard pages
- Premium features bypass
- System monitoring tools

**SUPER_ADMIN:**
- All admin features
- User management
- Role management

---

## 🎯 UI Component Visibility

### Upgrade Prompts
- **Free Tier:** Show upgrade buttons for Starter/Premium/Enterprise
- **Starter Tier:** Show upgrade to Premium/Pro
- **Premium Tier:** Show upgrade to Pro
- **Pro Tier:** Show upgrade to Enterprise

### Limit Warnings
- Show warnings when approaching limits
- Show upgrade prompts when limits reached
- Display usage progress bars

### Feature Badges
- Show "Premium" badge on premium features
- Show "Pro" badge on pro-only features
- Show "Enterprise" badge on enterprise features

---

## 📝 Implementation Notes

### Frontend Checks

**For Tier-Based Features:**
```typescript
const { subscriptionTier } = useAuthStore();
const { isAdmin } = useUserRole();

// Show premium feature if user has premium/pro tier OR is admin
{(subscriptionTier === 'premium' || subscriptionTier === 'pro' || isAdmin) && (
  <PremiumFeature />
)}
```

**For Admin Features:**
```typescript
const { isAdmin, isSuperAdmin } = useUserRole();

// Show admin feature
{isAdmin && <AdminFeature />}

// Show super admin feature
{isSuperAdmin && <SuperAdminFeature />}
```

**For Enterprise Features:**
```typescript
const { subscriptionTier } = useAuthStore();
const { isAdmin } = useUserRole();

// Show enterprise feature if user has enterprise tier OR is admin
{(subscriptionTier === 'enterprise' || isAdmin) && (
  <EnterpriseFeature />
)}
```

---

## ✅ Summary

- **Public:** Landing, login, signup pages
- **Authenticated:** Core features (chat, conversations, collections, settings)
- **Premium:** Analytics, advanced features (Premium/Pro tier)
- **Enterprise:** Team collaboration (Enterprise tier)
- **Admin:** System monitoring, admin tools (Admin/Super Admin role)
- **Super Admin:** User management (Super Admin role)

**Key Principle:** Role takes precedence over subscription tier. Admins can access premium/enterprise features even with free tier.
