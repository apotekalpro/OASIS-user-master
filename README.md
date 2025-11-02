# Alpro Employee Sync System

A Cloudflare Workers-based application that synchronizes employee data from Google Sheets to Supabase authentication, with automatic daily syncing and a web portal for employees to login and manage their passwords.

## 🎯 Features

### ✅ Currently Completed
- ✅ Google Sheets integration to read employee data
- ✅ Supabase authentication and metadata storage
- ✅ Automatic user creation with default password (`Alpro@123`)
- ✅ Employee login portal using Employee ID
- ✅ Password change functionality
- ✅ Dashboard showing employee information
- ✅ Admin sync page for manual synchronization
- ✅ Scheduled sync via Cloudflare Cron (1 AM Jakarta time / 6 PM UTC)
- ✅ Automatic locking of inactive employees (removed from sheet)
- ✅ Automatic creation of new employees added to sheet

### 📊 Data Architecture

**Google Sheet Structure:**
- Column A: Name
- Column B: Employee ID (used for login)
- Column C: Position
- Column D: Email
- Column E: Phone
- Column F: Outlet

**Supabase Tables:**
- `auth.users` - Authentication (managed by Supabase Auth)
- `public.employees` - Employee metadata with fields:
  - `employee_id` (unique, login username)
  - `name`, `position`, `email`, `phone`, `outlet`
  - `is_active` (boolean)
  - `auth_user_id` (foreign key to auth.users)

**Storage Services:**
- Supabase Auth - User authentication and password hashing
- Supabase Database - Employee metadata storage
- Google Sheets API - Employee data source

## 🔧 Setup Instructions

### 1. Set Up Google Sheets API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project: "Alpro Employee Sync"
3. Enable Google Sheets API:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google Sheets API"
   - Click "Enable"
4. Create Service Account:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service Account"
   - Name: `alpro-sync-service`
   - Click "Create and Continue" → "Done"
5. Generate JSON Key:
   - Click on the service account
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key" → "JSON"
   - Save the downloaded file
6. Share Google Sheet:
   - Copy the `client_email` from the JSON file
   - Open your Google Sheet
   - Click "Share"
   - Paste the service account email
   - Give "Viewer" access

### 2. Set Up Supabase Database

1. Open Supabase SQL Editor
2. Run the schema from `supabase-schema.sql`:
   ```sql
   -- Copy and paste the contents of supabase-schema.sql
   ```
3. This creates the `employees` table with proper indexes and policies

### 3. Configure Environment Variables

Update `.dev.vars` with your credentials:

```env
SUPABASE_URL=https://tqkizsrmfplmmzhjhemy.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
GOOGLE_SHEET_ID=1ht6DCOHokmtwAmNLxG4C2s4eYOHpdaNnmNReBu2sQMU
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
DEFAULT_PASSWORD=Alpro@123
```

**Note:** For production, set these as Cloudflare secrets:
```bash
echo "value" | npx wrangler pages secret put SUPABASE_SERVICE_KEY --project-name webapp
echo "value" | npx wrangler pages secret put GOOGLE_PRIVATE_KEY --project-name webapp
# ... repeat for all secrets
```

### 4. Build and Deploy

**Local Development:**
```bash
npm run build
npm run clean-port
pm2 start ecosystem.config.cjs
npm test  # Test with curl
```

**Deploy to Production:**
```bash
npm run deploy:prod
```

## 📱 Application URLs

### Local Development
- **Login Page**: http://localhost:3000/
- **Dashboard**: http://localhost:3000/dashboard
- **Admin Sync**: http://localhost:3000/admin/sync
- **API Base**: http://localhost:3000/api

### Production (After Deployment)
- **Production URL**: https://webapp.pages.dev
- **API Endpoints**: https://webapp.pages.dev/api

## 🔐 API Endpoints

### Authentication

**POST /api/auth/login**
```json
{
  "employee_id": "220222K",
  "password": "Alpro@123"
}
```

**POST /api/auth/change-password**
```json
{
  "employee_id": "220222K",
  "current_password": "Alpro@123",
  "new_password": "NewPassword123"
}
```

**GET /api/auth/me**
- Headers: `Authorization: Bearer <token>`

### Sync Operations

**POST /api/sync** - Trigger manual sync

**GET /api/sync/status** - Get current sync status and employee list

## 🔄 Sync Logic

The sync process runs automatically at **1 AM Jakarta time (6 PM UTC)** daily:

1. **Read Google Sheet** - Fetches all employees from the sheet
2. **Compare with Supabase** - Checks which employees exist
3. **Add New Employees**:
   - Creates auth user with default password
   - Stores metadata in `employees` table
   - Sets `is_active = true`
4. **Update Existing Employees**:
   - Updates name, position, email, phone, outlet
   - Ensures `is_active = true`
5. **Lock Removed Employees**:
   - If employee not in sheet, sets `is_active = false`
   - Auth user remains but cannot login (check in app)

## 👥 User Flow

### First Time Login
1. Employee receives their Employee ID (from HR)
2. Visits login page
3. Enters Employee ID and default password: `Alpro@123`
4. Redirected to dashboard
5. Changes password immediately

### Returning Users
1. Login with Employee ID and new password
2. Access dashboard to view profile
3. Can change password anytime

### Inactive Users
- If removed from Google Sheet, account is locked
- Login will be denied with message: "Your account has been deactivated. Please contact HR."

## 🛠️ Development Commands

```bash
# Install dependencies
npm install

# Build project
npm run build

# Start development server (requires build first)
npm run dev:sandbox

# Clean port 3000
npm run clean-port

# Start with PM2
pm2 start ecosystem.config.cjs

# View PM2 logs
pm2 logs alpro-employee-sync --nostream

# Deploy to Cloudflare Pages
npm run deploy:prod

# Test local server
npm test
```

## 📝 Deployment Status

- **Platform**: Cloudflare Pages
- **Status**: ⏳ Pending deployment
- **Tech Stack**: Hono + TypeScript + Supabase + Google Sheets API
- **Cron Schedule**: Daily at 1 AM Jakarta time (6 PM UTC)
- **Last Updated**: 2025-11-01

## 🚨 Troubleshooting

### Google Sheets API Issues
- Ensure service account email has access to the sheet
- Verify `GOOGLE_PRIVATE_KEY` is properly escaped in .dev.vars
- Check Google Cloud Console for API quota limits

### Supabase Connection Issues
- Verify `SUPABASE_URL` and keys are correct
- Ensure `employees` table exists with proper schema
- Check Supabase dashboard for auth errors

### Sync Not Working
- Check Cloudflare Workers logs for errors
- Verify cron trigger is enabled (only works in production)
- Use `/admin/sync` page to manually trigger sync and see errors

### Login Issues
- Ensure employee exists in `employees` table
- Check if `is_active = true`
- Verify password is correct (default: `Alpro@123`)

## 🔒 Security Notes

- Default password should be changed immediately after first login
- Service role key should be kept secret (never commit to git)
- Google service account private key should be secured
- All passwords are hashed by Supabase Auth (bcrypt)
- Row-level security policies protect employee data

## 📧 Support

For issues or questions, contact the development team or HR department.
