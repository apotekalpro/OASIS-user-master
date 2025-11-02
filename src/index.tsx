import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getSupabaseClient, getSupabaseAdmin, type SupabaseEnv } from './lib/supabase'
import { syncEmployeesWithSupabase } from './lib/syncService'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_KEY: string
  GOOGLE_SHEET_ID: string
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string
  GOOGLE_PRIVATE_KEY: string
  DEFAULT_PASSWORD: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS
app.use('/api/*', cors())

// Note: Static files are served automatically by Cloudflare Pages from the dist directory
// No need for serveStatic middleware - Pages handles this natively

// ======================
// AUTH API ROUTES
// ======================

// Login with Employee ID
app.post('/api/auth/login', async (c) => {
  try {
    const { employee_id, password } = await c.req.json()

    if (!employee_id || !password) {
      return c.json({ error: 'Employee ID and password are required' }, 400)
    }

    const supabase = getSupabaseClient(c.env as SupabaseEnv)
    const admin = getSupabaseAdmin(c.env as SupabaseEnv)

    // First, get employee data to find email
    const { data: employee, error: employeeError } = await admin
      .from('employees')
      .select('*')
      .eq('employee_id', employee_id)
      .single()

    if (employeeError || !employee) {
      return c.json({ error: 'Invalid employee ID or password' }, 401)
    }

    // Check if employee is active
    if (!employee.is_active) {
      return c.json({ error: 'Your account has been deactivated. Please contact HR.' }, 403)
    }

    // Sign in with email
    const email = employee.email || `${employee_id}@alpro.local`
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    if (error) {
      return c.json({ error: 'Invalid employee ID or password' }, 401)
    }

    return c.json({
      success: true,
      user: {
        employee_id: employee.employee_id,
        name: employee.name,
        position: employee.position,
        outlet: employee.outlet,
        email: employee.email
      },
      session: data.session
    })
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ error: 'Login failed' }, 500)
  }
})

// Change password
app.post('/api/auth/change-password', async (c) => {
  try {
    const { employee_id, current_password, new_password } = await c.req.json()

    if (!employee_id || !current_password || !new_password) {
      return c.json({ error: 'All fields are required' }, 400)
    }

    if (new_password.length < 6) {
      return c.json({ error: 'New password must be at least 6 characters' }, 400)
    }

    const supabase = getSupabaseClient(c.env as SupabaseEnv)
    const admin = getSupabaseAdmin(c.env as SupabaseEnv)

    // Get employee data
    const { data: employee, error: employeeError } = await admin
      .from('employees')
      .select('*')
      .eq('employee_id', employee_id)
      .single()

    if (employeeError || !employee) {
      return c.json({ error: 'Employee not found' }, 404)
    }

    // Verify current password by attempting login
    const email = employee.email || `${employee_id}@alpro.local`
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: current_password,
    })

    if (authError) {
      return c.json({ error: 'Current password is incorrect' }, 401)
    }

    // Update password using admin client
    const { error: updateError } = await admin.auth.admin.updateUserById(
      authData.user.id,
      { password: new_password }
    )

    if (updateError) {
      return c.json({ error: 'Failed to update password' }, 500)
    }

    return c.json({ success: true, message: 'Password changed successfully' })
  } catch (error) {
    console.error('Change password error:', error)
    return c.json({ error: 'Failed to change password' }, 500)
  }
})

// Get current user info
app.get('/api/auth/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) {
      return c.json({ error: 'No authorization header' }, 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabaseClient(c.env as SupabaseEnv)

    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return c.json({ error: 'Invalid token' }, 401)
    }

    const admin = getSupabaseAdmin(c.env as SupabaseEnv)
    const { data: employee } = await admin
      .from('employees')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    return c.json({
      user: {
        employee_id: employee?.employee_id,
        name: employee?.name,
        position: employee?.position,
        outlet: employee?.outlet,
        email: employee?.email
      }
    })
  } catch (error) {
    console.error('Get user error:', error)
    return c.json({ error: 'Failed to get user info' }, 500)
  }
})

// ======================
// SYNC API ROUTES
// ======================

// Debug endpoint to check specific employee
app.get('/api/debug/employee/:id', async (c) => {
  try {
    const employee_id = c.req.param('id')
    const admin = getSupabaseAdmin(c.env as SupabaseEnv)
    
    const { data: employee, error } = await admin
      .from('employees')
      .select('*')
      .eq('employee_id', employee_id)
      .single()
    
    if (error) {
      return c.json({ error: error.message, employee_id }, 404)
    }
    
    return c.json({ employee, found: true })
  } catch (error) {
    console.error('Debug error:', error)
    return c.json({ error: 'Debug failed' }, 500)
  }
})

// ======================
// ADMIN MANAGEMENT ROUTES (Superadmin only)
// ======================

// Check if user is superadmin
async function checkSuperAdmin(c: any, employee_id: string): Promise<boolean> {
  const admin = getSupabaseAdmin(c.env as SupabaseEnv)
  const { data: employee } = await admin
    .from('employees')
    .select('is_superadmin')
    .eq('employee_id', employee_id)
    .single()
  
  return employee?.is_superadmin === true
}

// Activate user
app.post('/api/admin/activate/:id', async (c) => {
  try {
    const { admin_id } = await c.req.json()
    const target_id = c.req.param('id')
    
    // Check if requester is superadmin
    if (!await checkSuperAdmin(c, admin_id)) {
      return c.json({ error: 'Unauthorized - Superadmin access required' }, 403)
    }
    
    const admin = getSupabaseAdmin(c.env as SupabaseEnv)
    const { error } = await admin
      .from('employees')
      .update({ is_active: true })
      .eq('employee_id', target_id)
    
    if (error) throw error
    
    return c.json({ success: true, message: `Employee ${target_id} activated` })
  } catch (error) {
    console.error('Activate error:', error)
    return c.json({ error: 'Failed to activate user' }, 500)
  }
})

// Deactivate user
app.post('/api/admin/deactivate/:id', async (c) => {
  try {
    const { admin_id } = await c.req.json()
    const target_id = c.req.param('id')
    
    // Check if requester is superadmin
    if (!await checkSuperAdmin(c, admin_id)) {
      return c.json({ error: 'Unauthorized - Superadmin access required' }, 403)
    }
    
    const admin = getSupabaseAdmin(c.env as SupabaseEnv)
    const { error } = await admin
      .from('employees')
      .update({ is_active: false })
      .eq('employee_id', target_id)
    
    if (error) throw error
    
    return c.json({ success: true, message: `Employee ${target_id} deactivated` })
  } catch (error) {
    console.error('Deactivate error:', error)
    return c.json({ error: 'Failed to deactivate user' }, 500)
  }
})

// Reset password to default
app.post('/api/admin/reset-password/:id', async (c) => {
  try {
    const { admin_id } = await c.req.json()
    const target_id = c.req.param('id')
    
    // Check if requester is superadmin
    if (!await checkSuperAdmin(c, admin_id)) {
      return c.json({ error: 'Unauthorized - Superadmin access required' }, 403)
    }
    
    const admin = getSupabaseAdmin(c.env as SupabaseEnv)
    
    // Get employee auth_user_id
    const { data: employee, error: fetchError } = await admin
      .from('employees')
      .select('auth_user_id, email, employee_id')
      .eq('employee_id', target_id)
      .single()
    
    if (fetchError || !employee) {
      return c.json({ error: 'Employee not found' }, 404)
    }
    
    // Reset password using admin API
    const { error: resetError } = await admin.auth.admin.updateUserById(
      employee.auth_user_id,
      { password: c.env.DEFAULT_PASSWORD || 'Alpro@123' }
    )
    
    if (resetError) throw resetError
    
    return c.json({ 
      success: true, 
      message: `Password reset to Alpro@123 for ${target_id}` 
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return c.json({ error: 'Failed to reset password' }, 500)
  }
})

// Get all employees (superadmin only)
app.post('/api/admin/employees', async (c) => {
  try {
    const { admin_id } = await c.req.json()
    
    // Check if requester is superadmin
    if (!await checkSuperAdmin(c, admin_id)) {
      return c.json({ error: 'Unauthorized - Superadmin access required' }, 403)
    }
    
    const admin = getSupabaseAdmin(c.env as SupabaseEnv)
    const { data: employees, error } = await admin
      .from('employees')
      .select('*')
      .order('name', { ascending: true })
    
    if (error) throw error
    
    return c.json({ employees })
  } catch (error) {
    console.error('Get employees error:', error)
    return c.json({ error: 'Failed to get employees' }, 500)
  }
})

// Manual sync trigger (for testing)
app.post('/api/sync', async (c) => {
  try {
    const result = await syncEmployeesWithSupabase(c.env as any)
    return c.json(result)
  } catch (error) {
    console.error('Sync error:', error)
    return c.json({ error: 'Sync failed' }, 500)
  }
})

// Get sync status/history
app.get('/api/sync/status', async (c) => {
  try {
    const admin = getSupabaseAdmin(c.env as SupabaseEnv)
    
    const { data: employees, error } = await admin
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    const activeCount = employees?.filter(e => e.is_active).length || 0
    const inactiveCount = employees?.filter(e => !e.is_active).length || 0

    return c.json({
      total: employees?.length || 0,
      active: activeCount,
      inactive: inactiveCount,
      employees: employees
    })
  } catch (error) {
    console.error('Status error:', error)
    return c.json({ error: 'Failed to get status' }, 500)
  }
})

// Debug endpoint to check environment variables
app.get('/api/debug/env', (c) => {
  return c.json({
    hasSupabaseUrl: !!c.env.SUPABASE_URL,
    hasSupabaseAnonKey: !!c.env.SUPABASE_ANON_KEY,
    hasSupabaseServiceKey: !!c.env.SUPABASE_SERVICE_KEY,
    hasGoogleSheetId: !!c.env.GOOGLE_SHEET_ID,
    hasGoogleServiceEmail: !!c.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    hasGooglePrivateKey: !!c.env.GOOGLE_PRIVATE_KEY,
    hasDefaultPassword: !!c.env.DEFAULT_PASSWORD,
    supabaseUrl: c.env.SUPABASE_URL ? c.env.SUPABASE_URL.substring(0, 30) + '...' : 'missing'
  })
})

// Debug endpoint to check database and specific employee
app.get('/api/debug/employee/:id', async (c) => {
  try {
    const employee_id = c.req.param('id')
    const admin = getSupabaseAdmin(c.env as SupabaseEnv)
    
    // Try to get the employee
    const { data: employee, error } = await admin
      .from('employees')
      .select('*')
      .eq('employee_id', employee_id)
      .single()
    
    if (error) {
      return c.json({ 
        error: error.message, 
        code: error.code,
        details: error.details,
        hint: error.hint,
        employee_id 
      }, 404)
    }
    
    return c.json({ 
      employee: {
        ...employee,
        auth_user_id: employee.auth_user_id ? 'exists' : 'missing'
      }
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// ======================
// FRONTEND PAGES
// ======================

// Login page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Alpro Employee Login</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-blue-100 min-h-screen flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
            <div class="text-center mb-8">
                <div class="bg-blue-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-user-shield text-white text-2xl"></i>
                </div>
                <h1 class="text-2xl font-bold text-gray-800">Alpro Employee Portal</h1>
                <p class="text-gray-600 mt-2">Sign in with your Employee ID</p>
            </div>

            <form id="loginForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        <i class="fas fa-id-card mr-2"></i>Employee ID
                    </label>
                    <input 
                        type="text" 
                        id="employee_id" 
                        placeholder="e.g., 220222K"
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    >
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        <i class="fas fa-lock mr-2"></i>Password
                    </label>
                    <input 
                        type="password" 
                        id="password" 
                        placeholder="Enter your password"
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    >
                </div>

                <div id="errorMsg" class="hidden bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                </div>

                <button 
                    type="submit" 
                    class="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition duration-200 flex items-center justify-center"
                >
                    <i class="fas fa-sign-in-alt mr-2"></i>
                    <span>Sign In</span>
                </button>
            </form>

            <p class="text-center text-sm text-gray-600 mt-6">
                First time login? Use default password: <code class="bg-gray-100 px-2 py-1 rounded">Alpro@123</code>
            </p>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            const loginForm = document.getElementById('loginForm');
            const errorMsg = document.getElementById('errorMsg');

            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                errorMsg.classList.add('hidden');

                const employee_id = document.getElementById('employee_id').value;
                const password = document.getElementById('password').value;

                try {
                    const response = await axios.post('/api/auth/login', {
                        employee_id,
                        password
                    });

                    if (response.data.success) {
                        // Store session
                        localStorage.setItem('session', JSON.stringify(response.data.session));
                        localStorage.setItem('user', JSON.stringify(response.data.user));
                        
                        // Redirect to dashboard
                        window.location.href = '/dashboard';
                    }
                } catch (error) {
                    errorMsg.textContent = error.response?.data?.error || 'Login failed. Please try again.';
                    errorMsg.classList.remove('hidden');
                }
            });
        </script>
    </body>
    </html>
  `)
})

// Dashboard page
app.get('/dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard - Alpro Employee Portal</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <nav class="bg-blue-500 text-white p-4 shadow-lg">
            <div class="container mx-auto flex justify-between items-center">
                <div class="flex items-center space-x-3">
                    <i class="fas fa-user-circle text-2xl"></i>
                    <span class="font-semibold text-lg">Alpro Employee Portal</span>
                </div>
                <button id="logoutBtn" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition">
                    <i class="fas fa-sign-out-alt mr-2"></i>Logout
                </button>
            </div>
        </nav>

        <div class="container mx-auto p-6 max-w-4xl">
            <div class="bg-white rounded-xl shadow-md p-6 mb-6">
                <h2 class="text-2xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-user-circle mr-2 text-blue-500"></i>
                    Welcome, <span id="userName">Loading...</span>
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
                    <div class="flex items-center">
                        <i class="fas fa-id-badge text-blue-500 mr-3"></i>
                        <div>
                            <p class="text-sm text-gray-500">Employee ID</p>
                            <p class="font-semibold" id="employeeId">-</p>
                        </div>
                    </div>
                    <div class="flex items-center">
                        <i class="fas fa-briefcase text-blue-500 mr-3"></i>
                        <div>
                            <p class="text-sm text-gray-500">Position</p>
                            <p class="font-semibold" id="position">-</p>
                        </div>
                    </div>
                    <div class="flex items-center">
                        <i class="fas fa-store text-blue-500 mr-3"></i>
                        <div>
                            <p class="text-sm text-gray-500">Outlet</p>
                            <p class="font-semibold" id="outlet">-</p>
                        </div>
                    </div>
                    <div class="flex items-center">
                        <i class="fas fa-envelope text-blue-500 mr-3"></i>
                        <div>
                            <p class="text-sm text-gray-500">Email</p>
                            <p class="font-semibold" id="email">-</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-xl shadow-md p-6">
                <h3 class="text-xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-key mr-2 text-blue-500"></i>
                    Change Password
                </h3>
                
                <form id="changePasswordForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                        <input 
                            type="password" 
                            id="currentPassword" 
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                        >
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                        <input 
                            type="password" 
                            id="newPassword" 
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                        >
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                        <input 
                            type="password" 
                            id="confirmPassword" 
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                        >
                    </div>

                    <div id="successMsg" class="hidden bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                    </div>

                    <div id="errorMsg" class="hidden bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    </div>

                    <button 
                        type="submit" 
                        class="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition"
                    >
                        <i class="fas fa-check mr-2"></i>Change Password
                    </button>
                </form>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            // Check authentication
            const session = JSON.parse(localStorage.getItem('session') || 'null');
            const user = JSON.parse(localStorage.getItem('user') || 'null');

            if (!session || !user) {
                window.location.href = '/';
            }

            // Display user info
            document.getElementById('userName').textContent = user.name;
            document.getElementById('employeeId').textContent = user.employee_id;
            document.getElementById('position').textContent = user.position;
            document.getElementById('outlet').textContent = user.outlet;
            document.getElementById('email').textContent = user.email;

            // Logout handler
            document.getElementById('logoutBtn').addEventListener('click', () => {
                localStorage.removeItem('session');
                localStorage.removeItem('user');
                window.location.href = '/';
            });

            // Change password handler
            const changePasswordForm = document.getElementById('changePasswordForm');
            const successMsg = document.getElementById('successMsg');
            const errorMsg = document.getElementById('errorMsg');

            changePasswordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                successMsg.classList.add('hidden');
                errorMsg.classList.add('hidden');

                const currentPassword = document.getElementById('currentPassword').value;
                const newPassword = document.getElementById('newPassword').value;
                const confirmPassword = document.getElementById('confirmPassword').value;

                if (newPassword !== confirmPassword) {
                    errorMsg.textContent = 'New passwords do not match';
                    errorMsg.classList.remove('hidden');
                    return;
                }

                try {
                    const response = await axios.post('/api/auth/change-password', {
                        employee_id: user.employee_id,
                        current_password: currentPassword,
                        new_password: newPassword
                    });

                    if (response.data.success) {
                        successMsg.textContent = 'Password changed successfully!';
                        successMsg.classList.remove('hidden');
                        changePasswordForm.reset();
                    }
                } catch (error) {
                    errorMsg.textContent = error.response?.data?.error || 'Failed to change password';
                    errorMsg.classList.remove('hidden');
                }
            });
        </script>
    </body>
    </html>
  `)
})

// Admin sync page (for testing)
app.get('/admin/sync', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sync Admin - Alpro</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50 p-6">
        <div class="container mx-auto max-w-6xl">
            <div class="bg-white rounded-xl shadow-md p-6 mb-6">
                <h1 class="text-3xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-sync-alt mr-2 text-blue-500"></i>
                    Employee Sync Administration
                </h1>
                <p class="text-gray-600">Manage employee synchronization from Google Sheets to Supabase</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div class="bg-blue-50 rounded-lg p-6 border-l-4 border-blue-500">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-blue-600 text-sm font-medium">Total Employees</p>
                            <p class="text-3xl font-bold text-blue-700" id="totalCount">-</p>
                        </div>
                        <i class="fas fa-users text-blue-500 text-3xl"></i>
                    </div>
                </div>

                <div class="bg-green-50 rounded-lg p-6 border-l-4 border-green-500">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-green-600 text-sm font-medium">Active</p>
                            <p class="text-3xl font-bold text-green-700" id="activeCount">-</p>
                        </div>
                        <i class="fas fa-check-circle text-green-500 text-3xl"></i>
                    </div>
                </div>

                <div class="bg-red-50 rounded-lg p-6 border-l-4 border-red-500">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-red-600 text-sm font-medium">Inactive</p>
                            <p class="text-3xl font-bold text-red-700" id="inactiveCount">-</p>
                        </div>
                        <i class="fas fa-times-circle text-red-500 text-3xl"></i>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-xl shadow-md p-6 mb-6">
                <button 
                    id="syncBtn" 
                    class="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg transition flex items-center"
                >
                    <i class="fas fa-sync-alt mr-2"></i>
                    <span>Run Sync Now</span>
                </button>

                <div id="syncResult" class="mt-4 hidden">
                    <div class="border-l-4 border-blue-500 bg-blue-50 p-4">
                        <h3 class="font-bold text-blue-800 mb-2">Sync Results</h3>
                        <div class="space-y-1 text-sm">
                            <p><strong>Added:</strong> <span id="addedCount">0</span></p>
                            <p><strong>Updated:</strong> <span id="updatedCount">0</span></p>
                            <p><strong>Locked:</strong> <span id="lockedCount">0</span></p>
                            <p><strong>Errors:</strong> <span id="errorsCount">0</span></p>
                        </div>
                        <div id="errorDetails" class="mt-2 hidden">
                            <p class="font-semibold text-red-700">Error Details:</p>
                            <pre class="text-xs bg-red-100 p-2 rounded mt-1 overflow-auto"></pre>
                        </div>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-xl shadow-md p-6">
                <h2 class="text-xl font-bold text-gray-800 mb-4">Employee List</h2>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="px-4 py-2 text-left">ID</th>
                                <th class="px-4 py-2 text-left">Name</th>
                                <th class="px-4 py-2 text-left">Position</th>
                                <th class="px-4 py-2 text-left">Outlet</th>
                                <th class="px-4 py-2 text-left">Status</th>
                            </tr>
                        </thead>
                        <tbody id="employeeList">
                            <tr>
                                <td colspan="5" class="text-center py-4 text-gray-500">Loading...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            async function loadStatus() {
                try {
                    const response = await axios.get('/api/sync/status');
                    const data = response.data;

                    document.getElementById('totalCount').textContent = data.total;
                    document.getElementById('activeCount').textContent = data.active;
                    document.getElementById('inactiveCount').textContent = data.inactive;

                    const tbody = document.getElementById('employeeList');
                    tbody.innerHTML = data.employees.map(emp => \`
                        <tr class="border-b hover:bg-gray-50">
                            <td class="px-4 py-2">\${emp.employee_id}</td>
                            <td class="px-4 py-2">\${emp.name}</td>
                            <td class="px-4 py-2">\${emp.position}</td>
                            <td class="px-4 py-2">\${emp.outlet}</td>
                            <td class="px-4 py-2">
                                <span class="px-2 py-1 rounded text-xs \${emp.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                    \${emp.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                        </tr>
                    \`).join('');
                } catch (error) {
                    console.error('Failed to load status:', error);
                }
            }

            document.getElementById('syncBtn').addEventListener('click', async () => {
                const btn = document.getElementById('syncBtn');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Syncing...';

                try {
                    const response = await axios.post('/api/sync');
                    const result = response.data;

                    document.getElementById('syncResult').classList.remove('hidden');
                    document.getElementById('addedCount').textContent = result.added;
                    document.getElementById('updatedCount').textContent = result.updated;
                    document.getElementById('lockedCount').textContent = result.locked;
                    document.getElementById('errorsCount').textContent = result.errors.length;

                    if (result.errors.length > 0) {
                        const errorDetails = document.getElementById('errorDetails');
                        errorDetails.classList.remove('hidden');
                        errorDetails.querySelector('pre').textContent = result.errors.join('\\n');
                    }

                    await loadStatus();
                } catch (error) {
                    alert('Sync failed: ' + (error.response?.data?.error || error.message));
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Run Sync Now';
                }
            });

            // Load initial status
            loadStatus();

            // Auto-refresh every 30 seconds
            setInterval(loadStatus, 30000);
        </script>
    </body>
    </html>
  `)
})

// Superadmin console (MPS240004 only)
app.get('/superadmin', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Superadmin Console - Alpro</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <nav class="bg-red-600 text-white p-4 shadow-lg">
            <div class="container mx-auto flex justify-between items-center">
                <div class="flex items-center space-x-3">
                    <i class="fas fa-user-shield text-2xl"></i>
                    <span class="font-semibold text-lg">Superadmin Console</span>
                </div>
                <button id="logoutBtn" class="bg-red-700 hover:bg-red-800 px-4 py-2 rounded-lg transition">
                    <i class="fas fa-sign-out-alt mr-2"></i>Logout
                </button>
            </div>
        </nav>

        <div id="authScreen" class="min-h-screen flex items-center justify-center p-6">
            <div class="bg-white rounded-xl shadow-md p-8 w-full max-w-md">
                <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">
                    <i class="fas fa-lock text-red-600 mr-2"></i>
                    Superadmin Access
                </h2>
                <form id="adminLoginForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Employee ID</label>
                        <input 
                            type="text" 
                            id="adminEmployeeId" 
                            placeholder="Enter your Employee ID"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                            required
                        >
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
                        <input 
                            type="password" 
                            id="adminPassword" 
                            placeholder="Enter your password"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                            required
                        >
                    </div>
                    <div id="authError" class="hidden bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"></div>
                    <button 
                        type="submit" 
                        class="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition"
                    >
                        <i class="fas fa-sign-in-alt mr-2"></i>Access Console
                    </button>
                </form>
            </div>
        </div>

        <div id="adminPanel" class="hidden container mx-auto p-6 max-w-7xl">
            <div class="bg-white rounded-xl shadow-md p-6 mb-6">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-2xl font-bold text-gray-800">
                        <i class="fas fa-users-cog mr-2 text-red-600"></i>
                        Employee Management
                    </h2>
                    <div class="flex items-center space-x-4">
                        <span class="text-sm text-gray-600">Logged in as: <strong id="adminName">-</strong></span>
                        <input 
                            type="text" 
                            id="searchBox" 
                            placeholder="Search employees..."
                            class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                        >
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div class="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
                        <p class="text-blue-600 text-sm font-medium">Total Employees</p>
                        <p class="text-3xl font-bold text-blue-700" id="totalEmployees">0</p>
                    </div>
                    <div class="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
                        <p class="text-green-600 text-sm font-medium">Active</p>
                        <p class="text-3xl font-bold text-green-700" id="activeEmployees">0</p>
                    </div>
                    <div class="bg-red-50 rounded-lg p-4 border-l-4 border-red-500">
                        <p class="text-red-600 text-sm font-medium">Inactive</p>
                        <p class="text-3xl font-bold text-red-700" id="inactiveEmployees">0</p>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="px-4 py-3 text-left">Employee ID</th>
                                <th class="px-4 py-3 text-left">Name</th>
                                <th class="px-4 py-3 text-left">Position</th>
                                <th class="px-4 py-3 text-left">Outlet</th>
                                <th class="px-4 py-3 text-left">Status</th>
                                <th class="px-4 py-3 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="employeeTableBody">
                            <tr>
                                <td colspan="6" class="text-center py-8 text-gray-500">
                                    <i class="fas fa-spinner fa-spin mr-2"></i>Loading...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            let currentAdminId = null;
            let allEmployees = [];

            // Check if already logged in
            const savedAdmin = localStorage.getItem('superadmin');
            if (savedAdmin) {
                const admin = JSON.parse(savedAdmin);
                currentAdminId = admin.employee_id;
                document.getElementById('authScreen').classList.add('hidden');
                document.getElementById('adminPanel').classList.remove('hidden');
                document.getElementById('adminName').textContent = admin.employee_id;
                loadEmployees();
            }

            // Admin login
            document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const errorDiv = document.getElementById('authError');
                errorDiv.classList.add('hidden');

                const employee_id = document.getElementById('adminEmployeeId').value;
                const password = document.getElementById('adminPassword').value;

                try {
                    // First, login normally
                    const loginResponse = await axios.post('/api/auth/login', {
                        employee_id,
                        password
                    });

                    if (loginResponse.data.success) {
                        // Check if user is superadmin
                        const debugResponse = await axios.get(\`/api/debug/employee/\${employee_id}\`);
                        
                        if (!debugResponse.data.employee.is_superadmin) {
                            errorDiv.textContent = 'Access Denied - Superadmin privileges required';
                            errorDiv.classList.remove('hidden');
                            return;
                        }

                        // Save admin session
                        localStorage.setItem('superadmin', JSON.stringify({
                            employee_id: employee_id,
                            name: loginResponse.data.user.name
                        }));

                        currentAdminId = employee_id;
                        document.getElementById('authScreen').classList.add('hidden');
                        document.getElementById('adminPanel').classList.remove('hidden');
                        document.getElementById('adminName').textContent = employee_id;
                        loadEmployees();
                    }
                } catch (error) {
                    errorDiv.textContent = error.response?.data?.error || 'Login failed';
                    errorDiv.classList.remove('hidden');
                }
            });

            // Load employees
            async function loadEmployees() {
                try {
                    const response = await axios.post('/api/admin/employees', {
                        admin_id: currentAdminId
                    });

                    allEmployees = response.data.employees;
                    renderEmployees(allEmployees);
                    updateStats();
                } catch (error) {
                    console.error('Failed to load employees:', error);
                    alert('Failed to load employees');
                }
            }

            // Render employees table
            function renderEmployees(employees) {
                const tbody = document.getElementById('employeeTableBody');
                
                if (employees.length === 0) {
                    tbody.innerHTML = \`
                        <tr>
                            <td colspan="6" class="text-center py-8 text-gray-500">No employees found</td>
                        </tr>
                    \`;
                    return;
                }

                tbody.innerHTML = employees.map(emp => \`
                    <tr class="border-b hover:bg-gray-50">
                        <td class="px-4 py-3 font-mono text-sm">\${emp.employee_id}</td>
                        <td class="px-4 py-3">\${emp.name}</td>
                        <td class="px-4 py-3 text-xs">\${emp.position}</td>
                        <td class="px-4 py-3 text-xs">\${emp.outlet}</td>
                        <td class="px-4 py-3">
                            <span class="px-2 py-1 rounded text-xs \${emp.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                \${emp.is_active ? 'Active' : 'Inactive'}
                            </span>
                            \${emp.is_superadmin ? '<span class="ml-2 px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">Superadmin</span>' : ''}
                        </td>
                        <td class="px-4 py-3">
                            <div class="flex space-x-2">
                                \${emp.is_active ? \`
                                    <button onclick="deactivateUser('\${emp.employee_id}')" 
                                        class="text-red-600 hover:text-red-800 p-1"
                                        title="Deactivate">
                                        <i class="fas fa-ban"></i>
                                    </button>
                                \` : \`
                                    <button onclick="activateUser('\${emp.employee_id}')" 
                                        class="text-green-600 hover:text-green-800 p-1"
                                        title="Activate">
                                        <i class="fas fa-check-circle"></i>
                                    </button>
                                \`}
                                <button onclick="resetPassword('\${emp.employee_id}')" 
                                    class="text-blue-600 hover:text-blue-800 p-1"
                                    title="Reset Password">
                                    <i class="fas fa-key"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                \`).join('');
            }

            // Update stats
            function updateStats() {
                document.getElementById('totalEmployees').textContent = allEmployees.length;
                document.getElementById('activeEmployees').textContent = allEmployees.filter(e => e.is_active).length;
                document.getElementById('inactiveEmployees').textContent = allEmployees.filter(e => !e.is_active).length;
            }

            // Search functionality
            document.getElementById('searchBox').addEventListener('input', (e) => {
                const search = e.target.value.toLowerCase();
                const filtered = allEmployees.filter(emp => 
                    emp.employee_id.toLowerCase().includes(search) ||
                    emp.name.toLowerCase().includes(search) ||
                    emp.position.toLowerCase().includes(search) ||
                    emp.outlet.toLowerCase().includes(search)
                );
                renderEmployees(filtered);
            });

            // Activate user
            window.activateUser = async function(employee_id) {
                if (!confirm(\`Activate employee \${employee_id}?\`)) return;

                try {
                    await axios.post(\`/api/admin/activate/\${employee_id}\`, {
                        admin_id: currentAdminId
                    });
                    alert('Employee activated successfully');
                    loadEmployees();
                } catch (error) {
                    alert('Failed to activate employee: ' + (error.response?.data?.error || error.message));
                }
            }

            // Deactivate user
            window.deactivateUser = async function(employee_id) {
                if (!confirm(\`Deactivate employee \${employee_id}?\`)) return;

                try {
                    await axios.post(\`/api/admin/deactivate/\${employee_id}\`, {
                        admin_id: currentAdminId
                    });
                    alert('Employee deactivated successfully');
                    loadEmployees();
                } catch (error) {
                    alert('Failed to deactivate employee: ' + (error.response?.data?.error || error.message));
                }
            }

            // Reset password
            window.resetPassword = async function(employee_id) {
                if (!confirm(\`Reset password for \${employee_id} to default (Alpro@123)?\`)) return;

                try {
                    await axios.post(\`/api/admin/reset-password/\${employee_id}\`, {
                        admin_id: currentAdminId
                    });
                    alert('Password reset successfully to: Alpro@123');
                } catch (error) {
                    alert('Failed to reset password: ' + (error.response?.data?.error || error.message));
                }
            }

            // Logout
            document.getElementById('logoutBtn').addEventListener('click', () => {
                localStorage.removeItem('superadmin');
                location.reload();
            });
        </script>
    </body>
    </html>
  `)
})

// Export for Cloudflare Pages
export default app
