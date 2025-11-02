# 🏗️ System Architecture - Alpro Employee Sync

This document explains the technical architecture and data flow of the system.

---

## 📐 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  📊 Google Sheets (Source of Truth)                             │
│  ├─ Column A: Name                                              │
│  ├─ Column B: Employee ID (Login Username)                      │
│  ├─ Column C: Position                                          │
│  ├─ Column D: Email                                             │
│  ├─ Column E: Phone                                             │
│  └─ Column F: Outlet                                            │
│                                                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ Google Sheets API (Read Only)
                            │ Authenticated via Service Account
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    CLOUDFLARE WORKERS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  🔄 Sync Service (src/lib/syncService.ts)                       │
│  ├─ Scheduled Cron: Daily at 1 AM Jakarta (6 PM UTC)           │
│  ├─ Manual Trigger: /api/sync endpoint                         │
│  └─ Logic:                                                      │
│     ├─ Read all employees from Google Sheet                    │
│     ├─ Compare with Supabase database                          │
│     ├─ Create new users (password: Alpro@123)                  │
│     ├─ Update existing user metadata                           │
│     └─ Lock removed users (is_active = false)                  │
│                                                                   │
│  🌐 Web Application (src/index.tsx)                             │
│  ├─ Login Page (/)                                              │
│  ├─ Employee Dashboard (/dashboard)                            │
│  ├─ Admin Sync Page (/admin/sync)                              │
│  └─ API Routes:                                                 │
│     ├─ POST /api/auth/login                                     │
│     ├─ POST /api/auth/change-password                          │
│     ├─ GET  /api/auth/me                                       │
│     ├─ POST /api/sync                                           │
│     └─ GET  /api/sync/status                                    │
│                                                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ Supabase Client SDK
                            │ REST API + Auth
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                         SUPABASE                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  🔐 Authentication (Supabase Auth)                              │
│  ├─ User Credentials (hashed passwords)                        │
│  ├─ Session Management                                          │
│  └─ JWT Token Generation                                        │
│                                                                   │
│  📊 Database (PostgreSQL)                                        │
│  └─ Table: employees                                            │
│     ├─ id (UUID, Primary Key)                                   │
│     ├─ employee_id (TEXT, Unique, Login Username)              │
│     ├─ name (TEXT)                                              │
│     ├─ position (TEXT)                                          │
│     ├─ email (TEXT)                                             │
│     ├─ phone (TEXT)                                             │
│     ├─ outlet (TEXT)                                            │
│     ├─ is_active (BOOLEAN)                                      │
│     ├─ auth_user_id (UUID, Foreign Key → auth.users)           │
│     ├─ created_at (TIMESTAMPTZ)                                 │
│     └─ updated_at (TIMESTAMPTZ)                                 │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagrams

### 1️⃣ Sync Process Flow

```
┌──────────────┐
│  CRON TIMER  │  ← Triggers daily at 1 AM Jakarta (6 PM UTC)
│  (Cloudflare)│
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│ 1. READ GOOGLE SHEET                                    │
│    - Fetch all rows (A2:F)                             │
│    - Parse employee data                                │
│    - Skip empty rows                                    │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 2. GET EXISTING EMPLOYEES FROM SUPABASE                 │
│    - Query employees table                              │
│    - Get all employee_id values                         │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 3. COMPARE & PROCESS                                    │
│                                                          │
│  For each employee in Google Sheet:                     │
│                                                          │
│  ┌─────────────────────────────────────────┐           │
│  │ Is employee_id in Supabase?             │           │
│  └────┬──────────────────┬─────────────────┘           │
│       │ NO               │ YES                          │
│       ▼                  ▼                              │
│  ┌─────────┐        ┌──────────┐                       │
│  │ CREATE  │        │ UPDATE   │                       │
│  │ NEW     │        │ EXISTING │                       │
│  │ USER    │        │ USER     │                       │
│  └─────────┘        └──────────┘                       │
│       │                  │                              │
│       ├─ Create auth.user (password: Alpro@123)       │
│       ├─ Insert employees row                          │
│       │  (is_active = true)                            │
│       │                  │                              │
│       │                  ├─ Update employees row       │
│       │                  │  (name, position, etc.)     │
│       │                  └─ Set is_active = true       │
└───────┴──────────────────┴─────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 4. LOCK REMOVED EMPLOYEES                               │
│                                                          │
│  For each employee in Supabase:                         │
│    If NOT in Google Sheet:                              │
│      → Set is_active = false                            │
│      → Keep auth user (don't delete)                    │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ 5. RETURN SYNC RESULT                                   │
│    - Added: X new employees                             │
│    - Updated: Y existing employees                      │
│    - Locked: Z removed employees                        │
│    - Errors: List of any errors                         │
└─────────────────────────────────────────────────────────┘
```

---

### 2️⃣ Login Flow

```
┌──────────────┐
│  EMPLOYEE    │
│  (Browser)   │
└──────┬───────┘
       │
       │ 1. Visit https://webapp.pages.dev/
       │
       ▼
┌─────────────────┐
│  LOGIN PAGE     │
│  - Enter        │
│    Employee ID  │
│  - Enter        │
│    Password     │
└──────┬──────────┘
       │
       │ 2. POST /api/auth/login
       │    { employee_id, password }
       │
       ▼
┌────────────────────────────────────────────────┐
│  CLOUDFLARE WORKER (Login Handler)             │
│                                                 │
│  1. Query employees table by employee_id       │
│  2. Check if is_active = true                  │
│  3. Get email from employees table             │
│  4. Call Supabase Auth:                        │
│     signInWithPassword(email, password)        │
└──────┬─────────────────────────────────────────┘
       │
       ▼
┌─────────────────┐      ┌────────────────────┐
│  SUPABASE AUTH  │◄────►│  SUPABASE DATABASE │
│  - Verify pwd   │      │  - Get employee    │
│  - Generate JWT │      │    metadata        │
└──────┬──────────┘      └────────────────────┘
       │
       │ 3. Return session + user data
       │
       ▼
┌─────────────────┐
│  EMPLOYEE       │
│  DASHBOARD      │
│  - Shows name   │
│  - Shows outlet │
│  - Change pwd   │
└─────────────────┘
```

---

### 3️⃣ Password Change Flow

```
┌──────────────┐
│  EMPLOYEE    │
│  (Logged in) │
└──────┬───────┘
       │
       │ 1. Fill password change form
       │
       ▼
┌─────────────────────────┐
│  DASHBOARD              │
│  - Current Password     │
│  - New Password         │
│  - Confirm Password     │
└──────┬──────────────────┘
       │
       │ 2. POST /api/auth/change-password
       │    { employee_id, current_password, new_password }
       │
       ▼
┌────────────────────────────────────────────────┐
│  CLOUDFLARE WORKER (Password Handler)          │
│                                                 │
│  1. Get employee data from employees table     │
│  2. Verify current password (attempt login)    │
│  3. If correct:                                │
│     → Use admin.updateUserById()               │
│     → Update password in Supabase Auth         │
└──────┬─────────────────────────────────────────┘
       │
       ▼
┌─────────────────┐
│  SUPABASE AUTH  │
│  - Hash new pwd │
│  - Update user  │
└──────┬──────────┘
       │
       │ 3. Return success
       │
       ▼
┌─────────────────┐
│  EMPLOYEE       │
│  - Password     │
│    changed!     │
└─────────────────┘
```

---

## 🔒 Security Architecture

### Authentication Flow

```
┌────────────────────────────────────────────┐
│  CLIENT BROWSER                             │
│  ├─ Employee enters credentials            │
│  └─ Stores JWT in localStorage             │
└──────────────┬─────────────────────────────┘
               │ HTTPS Only
               ▼
┌────────────────────────────────────────────┐
│  CLOUDFLARE WORKERS (Edge)                 │
│  ├─ Validates credentials                  │
│  ├─ No passwords stored here               │
│  └─ Proxies to Supabase                    │
└──────────────┬─────────────────────────────┘
               │ TLS Encrypted
               ▼
┌────────────────────────────────────────────┐
│  SUPABASE AUTH                              │
│  ├─ Passwords hashed with bcrypt           │
│  ├─ Generates JWT tokens                   │
│  └─ Row-level security policies            │
└────────────────────────────────────────────┘
```

### Data Protection Layers

1. **Transport Security**
   - All connections over HTTPS/TLS
   - No plaintext passwords in transit

2. **Password Security**
   - Bcrypt hashing in Supabase Auth
   - No passwords stored in Cloudflare Workers
   - No passwords in logs or database

3. **Access Control**
   - Row-level security (RLS) on employees table
   - Users can only see their own data
   - Service role for sync operations only

4. **API Security**
   - JWT-based authentication
   - Token expiration
   - CORS protection

5. **Environment Security**
   - Secrets in Cloudflare environment
   - Private key never in code
   - .dev.vars in .gitignore

---

## 📦 Technology Stack

### Frontend
- **HTML/CSS/JavaScript** - Pure vanilla (no framework)
- **TailwindCSS** - Via CDN for styling
- **Font Awesome** - Icons via CDN
- **Axios** - HTTP client via CDN

### Backend
- **Hono** - Lightweight web framework
- **TypeScript** - Type-safe development
- **Cloudflare Workers** - Edge runtime
- **Cloudflare Cron Triggers** - Scheduled tasks

### Database & Auth
- **Supabase Auth** - User authentication
- **PostgreSQL** - Database (via Supabase)
- **Row-Level Security** - Data protection

### External APIs
- **Google Sheets API** - Read employee data
- **Google Service Account** - API authentication

### Development
- **Vite** - Build tool
- **PM2** - Process management
- **Wrangler** - Cloudflare CLI
- **Git** - Version control

---

## 🔧 Configuration Files

### Project Structure
```
webapp/
├── src/
│   ├── index.tsx           # Main application & routes
│   └── lib/
│       ├── supabase.ts     # Supabase clients & types
│       ├── googleSheets.ts # Google Sheets reader
│       └── syncService.ts  # Sync logic
├── .dev.vars               # Local secrets (gitignored)
├── wrangler.jsonc          # Cloudflare config
├── package.json            # Dependencies
├── vite.config.ts          # Build config
├── tsconfig.json           # TypeScript config
└── ecosystem.config.cjs    # PM2 config
```

### Environment Variables
```env
# Supabase (Authentication & Database)
SUPABASE_URL              # Project URL
SUPABASE_ANON_KEY         # Public anon key
SUPABASE_SERVICE_KEY      # Admin service key

# Google Sheets (Data Source)
GOOGLE_SHEET_ID           # Spreadsheet ID from URL
GOOGLE_SERVICE_ACCOUNT_EMAIL  # Service account email
GOOGLE_PRIVATE_KEY        # Private key (with \n)

# Application
DEFAULT_PASSWORD          # Default password for new users
```

---

## 🚀 Deployment Architecture

### Local Development
```
Developer Machine
├── Code Editor (VSCode, etc.)
├── Node.js + npm
├── PM2 Process Manager
└── Wrangler CLI
    └── Runs: wrangler pages dev dist --ip 0.0.0.0 --port 3000
```

### Production (Cloudflare Pages)
```
Cloudflare Edge Network
├── Multiple Data Centers Worldwide
├── Automatic HTTPS
├── DDoS Protection
└── Workers Runtime
    ├── Handles HTTP requests
    ├── Runs scheduled cron jobs
    └── Connects to Supabase
```

### External Services
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Google Sheets  │    │   Supabase      │    │   Cloudflare    │
│  (Data Source)  │◄───┤  (Auth + DB)    │◄───┤   (Workers)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
     Read Only          Read/Write              Edge Computing
```

---

## 📊 Data Models

### Employee (TypeScript Interface)
```typescript
interface Employee {
  id: string              // UUID (auto-generated)
  employee_id: string     // From Google Sheet Column B
  name: string            // From Google Sheet Column A
  position: string        // From Google Sheet Column C
  email: string           // From Google Sheet Column D
  phone?: string          // From Google Sheet Column E
  outlet: string          // From Google Sheet Column F
  is_active: boolean      // Managed by sync process
  auth_user_id: string    // FK to auth.users
  created_at: string      // Auto-timestamp
  updated_at: string      // Auto-timestamp
}
```

### Sync Result (TypeScript Interface)
```typescript
interface SyncResult {
  success: boolean        // Overall success
  added: number          // New employees created
  locked: number         // Employees marked inactive
  updated: number        // Employees info updated
  errors: string[]       // Error messages if any
  timestamp: string      // ISO timestamp
}
```

---

## 🔄 State Management

### Client-Side (Browser)
```javascript
// Stored in localStorage
{
  "session": {
    "access_token": "jwt...",
    "refresh_token": "jwt...",
    "expires_at": 1234567890
  },
  "user": {
    "employee_id": "220222K",
    "name": "LAELA FITIRAH",
    "position": "HEALTH ADVISOR",
    "outlet": "APOTEK ALPRO MARGONDA RAYA",
    "email": "lee.tahlani@gmail.com"
  }
}
```

### Server-Side (Cloudflare)
- **Stateless** - No session storage on server
- JWT tokens validated on each request
- Database queries to get fresh data

---

## 📈 Performance Considerations

### Optimization Strategies

1. **Edge Computing**
   - Cloudflare Workers run at edge locations
   - Low latency for global users
   - No cold starts (always warm)

2. **Database Indexing**
   - Index on `employee_id` for fast lookups
   - Index on `is_active` for filtering
   - Index on `auth_user_id` for joins

3. **Caching**
   - Static assets cached at edge
   - JWT tokens cached in browser
   - No database caching (always fresh data)

4. **Sync Efficiency**
   - Batch operations where possible
   - Error handling doesn't stop process
   - Logs for debugging

---

## 🛡️ Error Handling

### Sync Errors
- Continues processing other employees if one fails
- Collects all errors in `errors[]` array
- Returns detailed error messages
- Logs to Cloudflare Workers logs

### Login Errors
- Generic error message for security
- Specific messages for inactive accounts
- Rate limiting (built into Supabase)

### API Errors
- HTTP status codes (400, 401, 403, 500)
- JSON error responses
- User-friendly messages

---

## 🔍 Monitoring & Logging

### Available Logs

1. **Cloudflare Workers Logs**
   - All sync operations
   - Cron trigger executions
   - API request/response
   - Error stack traces

2. **Supabase Logs**
   - Auth attempts
   - Database queries
   - Row-level security violations

3. **Browser Console**
   - Client-side errors
   - API call logs (in development)

---

## 🎯 Scalability

### Current Capacity
- **Employees**: Unlimited (PostgreSQL)
- **Concurrent Users**: High (Cloudflare edge)
- **Sync Performance**: ~100 employees in seconds
- **Request Limit**: 100k requests/day (Cloudflare free tier)

### Growth Path
- Horizontal scaling via Cloudflare
- Database read replicas if needed
- CDN for static assets
- No infrastructure management required

---

**Architecture Version**: 1.0  
**Last Updated**: 2025-11-01
