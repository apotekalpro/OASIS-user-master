# 🚀 Complete Setup Guide - Alpro Employee Sync System

This guide will walk you through the complete setup process from scratch.

---

## 📋 Prerequisites

- Google Account (for Google Cloud Console)
- Supabase Account (already set up)
- Cloudflare Account (for deployment)
- Basic understanding of terminal/command line

---

## Step 1: Set Up Google Sheets API Access

### 1.1 Create Google Cloud Project

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top
3. Click **"New Project"**
4. Enter project name: `Alpro Employee Sync`
5. Click **"Create"**
6. Wait for project creation (notification will appear)

### 1.2 Enable Google Sheets API

1. In the Google Cloud Console, ensure your project is selected
2. Click the hamburger menu (☰) → **"APIs & Services"** → **"Library"**
3. In the search bar, type: `Google Sheets API`
4. Click on **"Google Sheets API"**
5. Click **"Enable"** button
6. Wait for the API to be enabled

### 1.3 Create Service Account

1. Click the hamburger menu (☰) → **"APIs & Services"** → **"Credentials"**
2. Click **"+ Create Credentials"** at the top
3. Select **"Service Account"**
4. Fill in the form:
   - **Service account name**: `alpro-sync-service`
   - **Service account ID**: (auto-generated)
   - **Description**: `Service account for syncing employee data from Google Sheets`
5. Click **"Create and Continue"**
6. Skip the optional steps:
   - "Grant this service account access to project" → Click **"Continue"**
   - "Grant users access to this service account" → Click **"Done"**

### 1.4 Generate Service Account Key (JSON)

1. In the **Credentials** page, scroll down to **"Service Accounts"** section
2. Click on the service account you just created (`alpro-sync-service`)
3. Click the **"Keys"** tab at the top
4. Click **"Add Key"** → **"Create new key"**
5. Select **"JSON"** format
6. Click **"Create"**
7. A JSON file will be downloaded to your computer
8. **IMPORTANT**: Keep this file safe and never share it publicly!

### 1.5 Share Google Sheet with Service Account

1. Open the downloaded JSON file in a text editor
2. Find and copy the `client_email` value (looks like: `alpro-sync-service@your-project.iam.gserviceaccount.com`)
3. Open your Google Sheet: [Employee Sheet](https://docs.google.com/spreadsheets/d/1ht6DCOHokmtwAmNLxG4C2s4eYOHpdaNnmNReBu2sQMU/edit)
4. Click the **"Share"** button (top right)
5. Paste the service account email
6. Select permission: **"Viewer"**
7. **Uncheck** "Notify people" (service accounts don't need notifications)
8. Click **"Share"** or **"Send"**

✅ **Google Sheets API setup is complete!**

---

## Step 2: Set Up Supabase Database

### 2.1 Create Employees Table

1. Open your Supabase project: https://supabase.com/dashboard/project/tqkizsrmfplmmzhjhemy
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New Query"**
4. Copy the contents of `supabase-schema.sql` file from this project
5. Paste it into the SQL editor
6. Click **"Run"** (or press Ctrl/Cmd + Enter)
7. You should see: `Success. No rows returned`

### 2.2 Verify Table Creation

1. Click **"Table Editor"** in the left sidebar
2. You should see a new table: `employees`
3. Click on it to verify the columns:
   - `id` (uuid)
   - `employee_id` (text)
   - `name` (text)
   - `position` (text)
   - `email` (text)
   - `phone` (text)
   - `outlet` (text)
   - `is_active` (boolean)
   - `auth_user_id` (uuid)
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)

✅ **Supabase database setup is complete!**

---

## Step 3: Configure Environment Variables

### 3.1 Extract Google Service Account Credentials

Open the downloaded JSON file from Step 1.4 and extract:

1. **client_email**: Copy the value (e.g., `alpro-sync-service@your-project.iam.gserviceaccount.com`)
2. **private_key**: Copy the entire key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`

### 3.2 Update .dev.vars File

Open `.dev.vars` in your project and update with your actual values:

```env
# Supabase Configuration (Already provided)
SUPABASE_URL=https://tqkizsrmfplmmzhjhemy.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxa2l6c3JtZnBsbW16aGpoZW15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5OTkzMjUsImV4cCI6MjA3NzU3NTMyNX0.p1evFXmODdqV2VTRNnCOlf2Uq_8F4kIOkWLwRjNcj2Q
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxa2l6c3JtZnBsbW16aGpoZW15Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTk5OTMyNSwiZXhwIjoyMDc3NTc1MzI1fQ.9qts5X_yG7y6xQAqWMwCsLNjVjqsQ0AOpCCBaqZM7FM

# Google Sheets Configuration (UPDATE THESE!)
GOOGLE_SHEET_ID=1ht6DCOHokmtwAmNLxG4C2s4eYOHpdaNnmNReBu2sQMU
GOOGLE_SERVICE_ACCOUNT_EMAIL=PASTE_YOUR_CLIENT_EMAIL_HERE
GOOGLE_PRIVATE_KEY="PASTE_YOUR_PRIVATE_KEY_HERE"

# Default password for new users
DEFAULT_PASSWORD=Alpro@123
```

**IMPORTANT**: 
- Replace `PASTE_YOUR_CLIENT_EMAIL_HERE` with the `client_email` from JSON
- Replace `PASTE_YOUR_PRIVATE_KEY_HERE` with the `private_key` from JSON
- Keep the quotes around the private key
- The private key should include `\n` characters for line breaks

**Example**:
```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=alpro-sync-service@alpro-project-123456.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhki...(very long key)...xyz==\n-----END PRIVATE KEY-----\n"
```

✅ **Environment variables configured!**

---

## Step 4: Build and Test Locally

### 4.1 Build the Project

```bash
cd /home/user/webapp
npm run build
```

This will create a `dist/` directory with the compiled application.

### 4.2 Start the Development Server

```bash
# Clean port 3000 (in case something else is using it)
npm run clean-port

# Start with PM2
pm2 start ecosystem.config.cjs

# Check if it's running
pm2 list
```

### 4.3 Test the Application

Open your browser and visit:
- **Login Page**: http://localhost:3000/
- **Admin Sync Page**: http://localhost:3000/admin/sync

### 4.4 Run Manual Sync

1. Go to http://localhost:3000/admin/sync
2. Click **"Run Sync Now"** button
3. Watch the sync results:
   - **Added**: Number of new employees created
   - **Updated**: Number of existing employees updated
   - **Locked**: Number of employees marked inactive
   - **Errors**: Any errors that occurred

If you see errors, check PM2 logs:
```bash
pm2 logs alpro-employee-sync --nostream
```

### 4.5 Test Login

1. Go to http://localhost:3000/
2. Try logging in with an employee from the sheet:
   - **Employee ID**: `220222K` (or any from your sheet)
   - **Password**: `Alpro@123` (default)
3. You should be redirected to the dashboard
4. Try changing the password

✅ **Local testing complete!**

---

## Step 5: Deploy to Cloudflare Pages

### 5.1 Set Up Production Environment Variables

For production, we need to set environment variables as Cloudflare secrets:

```bash
# Set Supabase credentials
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxa2l6c3JtZnBsbW16aGpoZW15Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTk5OTMyNSwiZXhwIjoyMDc3NTc1MzI1fQ.9qts5X_yG7y6xQAqWMwCsLNjVjqsQ0AOpCCBaqZM7FM" | npx wrangler pages secret put SUPABASE_SERVICE_KEY

# Set Google credentials (replace with your actual values)
echo "your-service-account@your-project.iam.gserviceaccount.com" | npx wrangler pages secret put GOOGLE_SERVICE_ACCOUNT_EMAIL

echo "-----BEGIN PRIVATE KEY-----\nYOUR_ACTUAL_PRIVATE_KEY\n-----END PRIVATE KEY-----\n" | npx wrangler pages secret put GOOGLE_PRIVATE_KEY
```

**Alternative**: Set them via Cloudflare Dashboard:
1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your project: `webapp`
3. Go to **Settings** → **Environment Variables**
4. Add each variable manually

### 5.2 Deploy the Application

```bash
npm run deploy:prod
```

This will:
1. Build the project
2. Upload to Cloudflare Pages
3. Provide you with deployment URLs

You'll see output like:
```
✨ Success! Deployed to https://webapp.pages.dev
```

### 5.3 Set Up Cron Trigger

**Note**: Cron triggers only work on production, not local development.

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your project: `webapp`
3. Go to **Settings** → **Triggers**
4. Verify the cron schedule is set: `0 18 * * *` (6 PM UTC / 1 AM Jakarta)

The sync will now run automatically every day at 1 AM Jakarta time!

✅ **Production deployment complete!**

---

## Step 6: Verify Everything Works

### 6.1 Check Production URLs

Visit your production URLs:
- **Login Page**: https://webapp.pages.dev/
- **Admin Sync**: https://webapp.pages.dev/admin/sync

### 6.2 Test Production Sync

1. Go to https://webapp.pages.dev/admin/sync
2. Click "Run Sync Now"
3. Verify all employees are synced

### 6.3 Test Employee Login

1. Go to https://webapp.pages.dev/
2. Login with any employee ID from your sheet
3. Default password: `Alpro@123`
4. Change password to something new
5. Logout and login again with new password

### 6.4 Test Automatic Sync (Next Day)

The next day at 1 AM Jakarta time:
- Check Cloudflare Workers logs for sync execution
- Verify any new employees in the sheet are created
- Verify any removed employees are marked inactive

✅ **All systems operational!**

---

## 🎉 Setup Complete!

Your Alpro Employee Sync System is now fully operational!

### What Happens Now?

1. **Daily at 1 AM Jakarta time**, the system will:
   - Read all employees from Google Sheet
   - Create new users with default password `Alpro@123`
   - Update existing employee information
   - Lock accounts for employees removed from the sheet

2. **Employees can**:
   - Login at https://webapp.pages.dev/
   - View their profile information
   - Change their password anytime

3. **Admins can**:
   - Visit https://webapp.pages.dev/admin/sync
   - Manually trigger sync anytime
   - View sync status and employee list

---

## 🆘 Troubleshooting

### Issue: "Failed to read employee data from Google Sheet"
**Solution**: 
- Verify service account email has access to the sheet
- Check `GOOGLE_SERVICE_ACCOUNT_EMAIL` is correct
- Ensure `GOOGLE_PRIVATE_KEY` is properly formatted with `\n` for newlines

### Issue: "Failed to fetch existing employees"
**Solution**:
- Run the `supabase-schema.sql` in Supabase SQL Editor
- Verify `employees` table exists in Table Editor
- Check `SUPABASE_SERVICE_KEY` is correct

### Issue: "Invalid employee ID or password"
**Solution**:
- Ensure sync has been run at least once
- Check employee exists in `/admin/sync` page
- Verify employee is marked as "Active"
- Try default password: `Alpro@123`

### Issue: Sync not running automatically
**Solution**:
- Cron triggers only work in production (not local)
- Check Cloudflare Dashboard → Workers & Pages → Settings → Triggers
- View Cloudflare Workers logs for cron execution

---

## 📞 Need Help?

If you encounter any issues not covered here:
1. Check the main `README.md` file
2. Review PM2 logs: `pm2 logs alpro-employee-sync`
3. Check Cloudflare Workers logs in the dashboard
4. Contact the development team

---

**Last Updated**: 2025-11-01
