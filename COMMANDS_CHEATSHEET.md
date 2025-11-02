# 🎮 Command Cheatsheet - Quick Reference

Quick reference for all common commands you'll need.

---

## 📦 Initial Setup Commands

```bash
# Navigate to project
cd /home/user/webapp

# Install dependencies (if needed)
npm install

# Build the application
npm run build
```

---

## 🚀 Starting & Stopping

### Start Server
```bash
# Method 1: Clean port and start fresh
npm run clean-port
pm2 start ecosystem.config.cjs

# Method 2: Just start (if port is free)
pm2 start ecosystem.config.cjs
```

### Stop Server
```bash
# Stop the application
pm2 stop alpro-employee-sync

# Delete from PM2 (completely remove)
pm2 delete alpro-employee-sync
```

### Restart Server
```bash
# Restart (after code changes)
pm2 restart alpro-employee-sync
```

---

## 📊 Monitoring

### Check Server Status
```bash
# List all PM2 processes
pm2 list

# View detailed info
pm2 show alpro-employee-sync

# Monitor in real-time
pm2 monit
```

### View Logs
```bash
# View logs (non-streaming - SAFE)
pm2 logs alpro-employee-sync --nostream

# View last 50 lines
pm2 logs alpro-employee-sync --lines 50 --nostream

# Clear all logs
pm2 flush
```

---

## 🧹 Port Management

### Clean Port 3000
```bash
# Method 1: Using npm script
npm run clean-port

# Method 2: Direct command
fuser -k 3000/tcp 2>/dev/null || true

# Method 3: Check what's using the port
lsof -i :3000

# Method 4: PM2 delete all
pm2 delete all
```

---

## 🧪 Testing

### Test Server is Running
```bash
# Quick test
npm test

# Manual test
curl http://localhost:3000

# Test API endpoint
curl http://localhost:3000/api/sync/status

# Test login endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"employee_id":"220222K","password":"Alpro@123"}'
```

---

## 🔄 After Making Changes

### If You Changed Code
```bash
# 1. Stop the server
pm2 stop alpro-employee-sync

# 2. Rebuild
npm run build

# 3. Restart
pm2 restart alpro-employee-sync

# Or do it all at once
pm2 stop alpro-employee-sync && npm run build && pm2 restart alpro-employee-sync
```

### If You Changed .dev.vars
```bash
# Just restart (no rebuild needed)
pm2 restart alpro-employee-sync
```

---

## 🔍 Debugging

### Check Build Output
```bash
# Check if dist folder exists
ls -la dist/

# View compiled worker file
ls -lh dist/_worker.js
```

### Check Configuration
```bash
# View .dev.vars (without showing secrets)
cat .dev.vars | grep -v "KEY\|SECRET"

# View wrangler config
cat wrangler.jsonc

# View PM2 config
cat ecosystem.config.cjs
```

### Test Google Sheets Connection (Advanced)
```bash
# Use wrangler to test locally with dev vars
npx wrangler pages dev dist --ip 0.0.0.0 --port 3000
```

---

## 📦 Database Commands

### Check Supabase Connection (via curl)
```bash
# Test Supabase API
curl https://tqkizsrmfplmmzhjhemy.supabase.co/rest/v1/employees \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

## 🌐 URLs to Remember

### Local Development
```bash
# Login page
http://localhost:3000/

# Dashboard (after login)
http://localhost:3000/dashboard

# Admin sync page
http://localhost:3000/admin/sync

# API health check
http://localhost:3000/api/sync/status
```

---

## 🚀 Deployment Commands

### Deploy to Cloudflare Pages
```bash
# Build and deploy
npm run deploy:prod

# Or manual steps
npm run build
npx wrangler pages deploy dist --project-name webapp
```

### Set Production Secrets
```bash
# Set Supabase service key
echo "YOUR_SERVICE_KEY" | npx wrangler pages secret put SUPABASE_SERVICE_KEY --project-name webapp

# Set Google credentials
echo "YOUR_EMAIL" | npx wrangler pages secret put GOOGLE_SERVICE_ACCOUNT_EMAIL --project-name webapp

echo "YOUR_PRIVATE_KEY" | npx wrangler pages secret put GOOGLE_PRIVATE_KEY --project-name webapp

# List all secrets
npx wrangler pages secret list --project-name webapp
```

---

## 🔧 Git Commands

### Basic Git Operations
```bash
# Check status
git status

# View commit history
git log --oneline

# View changes
git diff

# Stage all changes
git add .

# Commit changes
git commit -m "Your message here"

# View current branch
git branch
```

---

## 📝 File Editing Commands

### Edit .dev.vars
```bash
# Using nano (simple editor)
nano .dev.vars

# Using vim (advanced editor)
vim .dev.vars

# View without editing
cat .dev.vars
```

---

## 🆘 Emergency Commands

### Complete Reset
```bash
# Stop everything
pm2 delete all

# Clean port
fuser -k 3000/tcp 2>/dev/null || true

# Rebuild from scratch
cd /home/user/webapp
npm run build

# Start fresh
pm2 start ecosystem.config.cjs
```

### If Build Fails
```bash
# Clean node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clean dist and rebuild
rm -rf dist
npm run build
```

### If PM2 is Acting Weird
```bash
# Kill PM2 daemon
pm2 kill

# Start fresh
pm2 start ecosystem.config.cjs
```

---

## 📊 Useful PM2 Commands

```bash
# Save PM2 process list
pm2 save

# Resurrect saved processes
pm2 resurrect

# Startup script (auto-start on reboot)
pm2 startup

# Update PM2
npm install -g pm2@latest

# PM2 version
pm2 --version
```

---

## 🎯 Common Workflows

### Daily Development Workflow
```bash
cd /home/user/webapp
pm2 list                    # Check if running
pm2 logs --nostream        # Check logs
# Open http://localhost:3000/admin/sync to test
```

### After Code Changes
```bash
cd /home/user/webapp
pm2 stop alpro-employee-sync
npm run build
pm2 restart alpro-employee-sync
pm2 logs alpro-employee-sync --nostream
```

### Test New Employee Sync
```bash
# 1. Add employee to Google Sheet
# 2. Open http://localhost:3000/admin/sync
# 3. Click "Run Sync Now"
# 4. Check results
```

### Troubleshooting Workflow
```bash
# 1. Check PM2 status
pm2 list

# 2. Check logs
pm2 logs alpro-employee-sync --nostream

# 3. Restart if needed
pm2 restart alpro-employee-sync

# 4. If still broken, rebuild
pm2 stop alpro-employee-sync
npm run build
pm2 start ecosystem.config.cjs
```

---

## 💡 Pro Tips

### Alias Commands (Add to ~/.bashrc)
```bash
# Add these to make life easier
alias webapp='cd /home/user/webapp'
alias webapp-start='cd /home/user/webapp && npm run clean-port && pm2 start ecosystem.config.cjs'
alias webapp-restart='pm2 restart alpro-employee-sync'
alias webapp-logs='pm2 logs alpro-employee-sync --nostream'
alias webapp-rebuild='cd /home/user/webapp && pm2 stop alpro-employee-sync && npm run build && pm2 restart alpro-employee-sync'
```

Then use:
```bash
webapp              # Go to project
webapp-start        # Start everything
webapp-restart      # Quick restart
webapp-logs         # View logs
webapp-rebuild      # Rebuild and restart
```

---

## 📞 Quick Help

**Forgot a command?**
```bash
# Show all available npm scripts
npm run

# Show PM2 help
pm2 --help

# Show wrangler help
npx wrangler --help
```

**Need to find a file?**
```bash
# Find all markdown files
find . -name "*.md" -not -path "*/node_modules/*"

# Find the guide you need
ls -1 *.md
```

---

## 🔗 Quick Links

- **Step 3 Guide**: `STEP3_DETAILED.md`
- **Full Setup**: `SETUP_GUIDE.md`
- **Quick Start**: `QUICK_START.md`
- **Troubleshooting**: See any guide's troubleshooting section

---

**Print this out or keep it handy!** 📋

These are all the commands you'll ever need for this project.
