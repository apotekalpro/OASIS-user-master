# 🔧 Step 3 Detailed Guide - Configure & Test

This guide walks you through configuring your credentials and testing the system.

---

## Prerequisites

Before starting Step 3, you must have:
- ✅ Downloaded Google Service Account JSON file from Step 1
- ✅ Run `supabase-schema.sql` in Supabase from Step 2

If you haven't done these, go back to `SETUP_GUIDE.md`

---

## Part A: Update .dev.vars File

### 1️⃣ Locate Your Google Service Account JSON File

After completing Step 1, you should have downloaded a file like:
- `alpro-project-123456-abc123def456.json`
- Or similar name with random characters

Open this file with a text editor (Notepad, VSCode, etc.)

---

### 2️⃣ Extract Required Values

The JSON file looks like this:

```json
{
  "type": "service_account",
  "project_id": "alpro-project-123456",
  "private_key_id": "abc123def456...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhki...(very long)...\n-----END PRIVATE KEY-----\n",
  "client_email": "alpro-sync-service@alpro-project-123456.iam.gserviceaccount.com",
  "client_id": "123456789012345678",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

**You need to copy TWO values:**

#### Value 1: `client_email`
Look for the line with `"client_email"` and copy the email address.

Example:
```
alpro-sync-service@alpro-project-123456.iam.gserviceaccount.com
```

#### Value 2: `private_key`
Look for the line with `"private_key"` and copy the ENTIRE value including quotes.

Example:
```
"-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhki...(very long)...\n-----END PRIVATE KEY-----\n"
```

**IMPORTANT**: 
- Copy the ENTIRE key including the quotes `"`
- Keep all the `\n` characters (they represent line breaks)
- It's ONE long line, not multiple lines

---

### 3️⃣ Edit the .dev.vars File

**Option A: Using Terminal (Recommended)**

```bash
# Navigate to the project
cd /home/user/webapp

# Open with nano editor
nano .dev.vars
```

**Option B: Using a Code Editor**
Open the file `/home/user/webapp/.dev.vars` in your code editor.

---

### 4️⃣ Replace the Placeholder Values

Find these two lines in `.dev.vars`:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=your-private-key-here
```

**Replace with your actual values:**

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=alpro-sync-service@alpro-project-123456.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhki...(your actual key)...\n-----END PRIVATE KEY-----\n"
```

**Complete Example:**

```env
# Supabase Configuration (Already correct - don't change)
SUPABASE_URL=https://tqkizsrmfplmmzhjhemy.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxa2l6c3JtZnBsbW16aGpoZW15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5OTkzMjUsImV4cCI6MjA3NzU3NTMyNX0.p1evFXmODdqV2VTRNnCOlf2Uq_8F4kIOkWLwRjNcj2Q
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxa2l6c3JtZnBsbW16aGpoZW15Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTk5OTMyNSwiZXhwIjoyMDc3NTc1MzI1fQ.9qts5X_yG7y6xQAqWMwCsLNjVjqsQ0AOpCCBaqZM7FM

# Google Sheets Configuration (UPDATE THESE!)
GOOGLE_SHEET_ID=1ht6DCOHokmtwAmNLxG4C2s4eYOHpdaNnmNReBu2sQMU
GOOGLE_SERVICE_ACCOUNT_EMAIL=alpro-sync-service@alpro-project-123456.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...(your actual very long key)...xyz==\n-----END PRIVATE KEY-----\n"

# Default password for new users (Already correct - don't change)
DEFAULT_PASSWORD=Alpro@123
```

**Save the file:**
- If using `nano`: Press `Ctrl+X`, then `Y`, then `Enter`
- If using editor: Just save the file

---

## Part B: Build the Application

Now that credentials are configured, let's build the app!

### 5️⃣ Build the Application

```bash
# Make sure you're in the project directory
cd /home/user/webapp

# Build the application
npm run build
```

**What you should see:**
```
> webapp@0.0.0 build
> vite build

vite v6.3.5 building for production...
✓ 175 modules transformed.
dist/_worker.js   XXX.XX kB
dist/_routes.json X.XX kB
✓ built in XXXXms
```

**If you see errors**, check:
- All dependencies installed: `npm install`
- .dev.vars file saved correctly
- No syntax errors in .dev.vars

---

## Part C: Start the Server

### 6️⃣ Clean Port 3000 (if needed)

```bash
# This kills any process using port 3000
npm run clean-port
```

You might see:
- `3000/tcp: No such process` ← This is OK, means port is free
- Or nothing ← Also OK

---

### 7️⃣ Start with PM2

```bash
# Start the application
pm2 start ecosystem.config.cjs
```

**What you should see:**
```
[PM2] Starting /home/user/webapp/ecosystem.config.cjs in fork_mode (1 instance)
[PM2] Done.
┌─────┬──────────────────────┬─────────┬─────────┬──────────┐
│ id  │ name                 │ status  │ restart │ uptime   │
├─────┼──────────────────────┼─────────┼─────────┼──────────┤
│ 0   │ alpro-employee-sync  │ online  │ 0       │ 0s       │
└─────┴──────────────────────┴─────────┴─────────┴──────────┘
```

**Check if it's running:**
```bash
pm2 list
```

---

### 8️⃣ Test the Server

```bash
# Quick test to see if server is responding
npm test
```

**Or manually:**
```bash
curl http://localhost:3000
```

**Expected result:** You should see HTML content (the login page)

---

## Part D: Test the Sync

### 9️⃣ Open Admin Sync Page

Open your web browser and visit:
```
http://localhost:3000/admin/sync
```

**What you should see:**
- A dashboard with statistics (Total, Active, Inactive employees)
- A "Run Sync Now" button
- An employee list table (currently empty)

---

### 🔟 Run Your First Sync

1. Click the **"Run Sync Now"** button
2. Wait a few seconds (should be quick)
3. Watch the results appear

**Expected results:**
```
Sync Results
├─ Added: 100 (all employees from your sheet)
├─ Updated: 0 (no existing employees)
├─ Locked: 0 (no removed employees)
└─ Errors: 0 (hopefully!)
```

**If you see errors**, check below for troubleshooting.

---

### 1️⃣1️⃣ Verify Employees Were Created

After sync completes:

1. **In the Admin Page**, scroll down to see the employee list
2. You should see all 100 employees from your Google Sheet
3. All should show status: **Active** (green badge)

**Also verify in Supabase:**
1. Go to: https://supabase.com/dashboard/project/tqkizsrmfplmmzhjhemy/editor
2. Click on `employees` table
3. You should see 100 rows

---

## Part E: Test Employee Login

### 1️⃣2️⃣ Try Logging In

1. Open: http://localhost:3000/
2. You'll see the login page
3. Try logging in with any employee from your sheet:

**Example:**
- **Employee ID**: `220222K`
- **Password**: `Alpro@123` (default password)

4. Click **"Sign In"**

**Expected result:** You should be redirected to the dashboard showing:
- Employee name: LAELA FITIRAH
- Position: HEALTH ADVISOR
- Outlet: APOTEK ALPRO MARGONDA RAYA
- Email: lee.tahlani@gmail.com

---

### 1️⃣3️⃣ Test Password Change

1. In the dashboard, scroll to **"Change Password"** section
2. Fill in the form:
   - **Current Password**: `Alpro@123`
   - **New Password**: `MyNewPassword123`
   - **Confirm New Password**: `MyNewPassword123`
3. Click **"Change Password"**

**Expected result:** Green success message: "Password changed successfully!"

4. **Test the new password**:
   - Click "Logout"
   - Try logging in again with Employee ID `220222K`
   - Use your **new password**: `MyNewPassword123`
   - Should work!

---

## Part F: Check PM2 Logs (Optional)

### 1️⃣4️⃣ View Application Logs

```bash
# View logs (non-streaming)
pm2 logs alpro-employee-sync --nostream
```

**What to look for:**
- `Reading employees from Google Sheet...` ✅
- `Found 100 employees in sheet` ✅
- `Creating new user: 220222K` ✅
- `✓ Added new employee: 220222K` ✅

**If you see errors**, they'll appear here with details.

---

## 🎉 Success Checklist

After completing Step 3, you should have:

- ✅ Updated .dev.vars with Google credentials
- ✅ Built the application successfully
- ✅ Started PM2 server
- ✅ Accessed admin sync page
- ✅ Run sync successfully (100 employees added)
- ✅ Verified employees in database
- ✅ Logged in with an employee ID
- ✅ Changed password successfully

---

## 🆘 Troubleshooting

### Error: "Failed to read employee data from Google Sheet"

**Cause:** Service account doesn't have access to the sheet

**Fix:**
1. Open your Google Sheet
2. Click "Share"
3. Make sure the service account email is listed
4. If not, add it with "Viewer" permission

---

### Error: "Failed to fetch existing employees"

**Cause:** The `employees` table doesn't exist in Supabase

**Fix:**
1. Go to Supabase SQL Editor
2. Run the contents of `supabase-schema.sql`
3. Verify table exists in Table Editor

---

### Error: "Invalid private key format"

**Cause:** The private key in .dev.vars is not formatted correctly

**Fix:**
1. Make sure you copied the entire key including quotes
2. Check that `\n` characters are present (don't remove them)
3. Key should be ONE long line, not multiple lines
4. Example format: `"-----BEGIN PRIVATE KEY-----\nABC...XYZ\n-----END PRIVATE KEY-----\n"`

---

### Error: Port 3000 is already in use

**Fix:**
```bash
# Kill whatever is using port 3000
npm run clean-port

# Or manually
fuser -k 3000/tcp

# Then start again
pm2 start ecosystem.config.cjs
```

---

### Error: PM2 says "errored" or "stopped"

**Check logs:**
```bash
pm2 logs alpro-employee-sync --nostream
```

**Restart:**
```bash
pm2 restart alpro-employee-sync
```

**Or delete and start fresh:**
```bash
pm2 delete alpro-employee-sync
npm run clean-port
pm2 start ecosystem.config.cjs
```

---

### Sync shows errors for specific employees

**Example:** `Failed to create auth for 220222K: User already exists`

**This is OK if:**
- You're running sync multiple times
- Some employees were already created

**The sync will:**
- Update existing employees (not create duplicates)
- Only create new ones

---

### Can't login after sync

**Checklist:**
1. ✅ Sync completed successfully (check admin page)
2. ✅ Employee exists in admin page employee list
3. ✅ Employee status is "Active" (green badge)
4. ✅ Using correct Employee ID (check Google Sheet column B)
5. ✅ Using default password: `Alpro@123`

**Still not working?**
- Check PM2 logs during login attempt
- Try another employee ID from the sheet
- Clear browser cache and try again

---

## 🎯 Next Steps

After Step 3 is working, you can:

### Deploy to Production (Optional)
Follow `SETUP_GUIDE.md` - Step 5 to deploy to Cloudflare Pages

### Share with Employees
- Give them the URL: http://localhost:3000/ (or production URL after deploy)
- Tell them their Employee ID (from Column B in the sheet)
- Default password: `Alpro@123`
- Ask them to change password after first login

### Monitor Syncs
- Check `/admin/sync` page regularly
- Scheduled sync will run daily at 1 AM Jakarta time (after deploy)

---

## 📞 Need More Help?

- **Full guide**: See `SETUP_GUIDE.md`
- **Quick reference**: See `QUICK_START.md`
- **Architecture**: See `ARCHITECTURE.md`
- **PM2 logs**: `pm2 logs alpro-employee-sync --nostream`

---

**You're all set!** 🚀

If Step 3 completed successfully, your system is working and ready to use!
