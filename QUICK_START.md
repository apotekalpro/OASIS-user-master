# ⚡ Quick Start Guide

This is a condensed version of the setup process. For detailed instructions, see `SETUP_GUIDE.md`.

---

## 🎯 What You Need

1. ✅ **Supabase credentials** - Already provided
2. ⏳ **Google Service Account JSON** - You need to create this
3. ⏳ **Cloudflare account** - For deployment

---

## 📝 Quick Setup (5 Steps)

### 1️⃣ Get Google Service Account Credentials

1. Go to: https://console.cloud.google.com/
2. Create project → Enable Google Sheets API → Create Service Account
3. Download JSON key file
4. Share your Google Sheet with the service account email

**Detailed guide**: See `SETUP_GUIDE.md` Step 1

---

### 2️⃣ Set Up Supabase Database

1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/tqkizsrmfplmmzhjhemy
2. Copy contents of `supabase-schema.sql`
3. Paste and run in SQL Editor

**That's it!** The `employees` table is now created.

---

### 3️⃣ Configure Credentials

Open `.dev.vars` and update these lines with your Google credentials:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

📄 **Need help formatting?** See `google-credentials-template.txt`

---

### 4️⃣ Build and Test

```bash
# Build the application
npm run build

# Start the server
pm2 start ecosystem.config.cjs

# Test in browser
# Visit: http://localhost:3000/admin/sync
# Click: "Run Sync Now"
```

If sync succeeds, you'll see:
- ✅ Added: X employees
- ✅ Updated: Y employees
- ✅ Locked: Z employees

---

### 5️⃣ Deploy to Production

```bash
# Deploy to Cloudflare Pages
npm run deploy:prod

# Set production secrets (one-time setup)
echo "YOUR_SERVICE_KEY" | npx wrangler pages secret put SUPABASE_SERVICE_KEY
echo "YOUR_EMAIL" | npx wrangler pages secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
echo "YOUR_KEY" | npx wrangler pages secret put GOOGLE_PRIVATE_KEY
```

**Done!** Your app is live at: `https://webapp.pages.dev`

---

## 🎮 How to Use

### For Employees

1. **Login**: Visit https://webapp.pages.dev/
2. **Enter**: Employee ID (e.g., `220222K`)
3. **Password**: Use default `Alpro@123` for first login
4. **Change Password**: Click "Change Password" in dashboard

### For Admins

1. **Monitor**: Visit https://webapp.pages.dev/admin/sync
2. **Manual Sync**: Click "Run Sync Now" anytime
3. **Auto Sync**: Runs daily at 1 AM Jakarta time

---

## 🔄 How It Works

```
Google Sheet (Source of Truth)
     ↓
Daily Sync (1 AM Jakarta)
     ↓
Supabase (Auth + Database)
     ↓
Employees Login via Web Portal
```

**What Gets Synced:**
- ✅ New employees → Auto-created with password `Alpro@123`
- ✅ Existing employees → Info updated
- ✅ Removed employees → Access locked

---

## 🆘 Common Issues

### ❌ "Failed to read Google Sheet"
**Fix**: Make sure you shared the sheet with service account email

### ❌ "Failed to fetch existing employees"
**Fix**: Run `supabase-schema.sql` in Supabase SQL Editor

### ❌ "Invalid employee ID or password"
**Fix**: Run sync first from `/admin/sync` page

### ❌ Sync not running automatically
**Fix**: Cron only works in production, not local dev

---

## 📚 More Resources

- **Full Setup Guide**: `SETUP_GUIDE.md`
- **Credentials Template**: `google-credentials-template.txt`
- **Project README**: `README.md`
- **Database Schema**: `supabase-schema.sql`

---

## 🚀 Next Steps

After setup, you should:

1. ✅ Test login with a few employee IDs
2. ✅ Verify password change works
3. ✅ Add/remove an employee in sheet and re-sync to test
4. ✅ Inform employees about the portal
5. ✅ Monitor the admin dashboard regularly

---

**Need detailed help?** Read `SETUP_GUIDE.md` for step-by-step instructions with screenshots.

**Last Updated**: 2025-11-01
