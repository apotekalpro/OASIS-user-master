import { getSupabaseAdmin, type SupabaseEnv, type Employee } from './supabase'
import { readEmployeesFromSheet, type GoogleSheetsEnv } from './googleSheets'

interface SyncEnv extends SupabaseEnv, GoogleSheetsEnv {
  DEFAULT_PASSWORD: string
}

interface SyncResult {
  success: boolean
  added: number
  locked: number
  updated: number
  errors: string[]
  timestamp: string
}

/**
 * Main sync function that:
 * 1. Reads employees from Google Sheet
 * 2. Compares with Supabase users
 * 3. Creates new users with default password
 * 4. Locks users not in the sheet
 * 5. Updates employee metadata
 */
export async function syncEmployeesWithSupabase(env: SyncEnv): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    added: 0,
    locked: 0,
    updated: 0,
    errors: [],
    timestamp: new Date().toISOString()
  }

  try {
    const admin = getSupabaseAdmin(env)

    // Step 1: Read employees from Google Sheet
    console.log('Reading employees from Google Sheet...')
    const sheetEmployees = await readEmployeesFromSheet(env)
    console.log(`Found ${sheetEmployees.length} employees in sheet`)

    // Create a map of employee IDs from sheet for quick lookup
    const sheetEmployeeIds = new Set(sheetEmployees.map(e => e.employeeId))

    // Step 2: Get existing employees from metadata table
    const { data: existingEmployees, error: fetchError } = await admin
      .from('employees')
      .select('*')

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = table doesn't exist
      throw new Error(`Failed to fetch existing employees: ${fetchError.message}`)
    }

    const existingEmployeeIds = new Set(
      (existingEmployees || []).map((e: Employee) => e.employee_id)
    )

    // Step 3: Process each employee from sheet
    for (const sheetEmployee of sheetEmployees) {
      const { employeeId, name, position, email, phone, outlet } = sheetEmployee

      try {
        // Check if employee exists in our database
        const isNewEmployee = !existingEmployeeIds.has(employeeId)

        if (isNewEmployee) {
          // Create new user in Supabase Auth
          console.log(`Creating new user: ${employeeId}`)
          
          const { data: authData, error: authError } = await admin.auth.admin.createUser({
            email: email || `${employeeId}@alpro.local`, // Use email or generate one
            password: env.DEFAULT_PASSWORD,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
              employee_id: employeeId,
              name: name,
              position: position,
              outlet: outlet
            }
          })

          if (authError) {
            result.errors.push(`Failed to create auth for ${employeeId}: ${authError.message}`)
            continue
          }

          // Insert employee metadata
          const { error: insertError } = await admin
            .from('employees')
            .insert({
              employee_id: employeeId,
              name: name,
              position: position,
              email: email,
              phone: phone,
              outlet: outlet,
              is_active: true,
              auth_user_id: authData.user?.id
            })

          if (insertError) {
            result.errors.push(`Failed to insert metadata for ${employeeId}: ${insertError.message}`)
            // Try to delete the auth user to keep things in sync
            await admin.auth.admin.deleteUser(authData.user!.id)
            continue
          }

          result.added++
          console.log(`✓ Added new employee: ${employeeId}`)
        } else {
          // Update existing employee metadata
          const { error: updateError } = await admin
            .from('employees')
            .update({
              name: name,
              position: position,
              email: email,
              phone: phone,
              outlet: outlet,
              is_active: true,
              updated_at: new Date().toISOString()
            })
            .eq('employee_id', employeeId)

          if (updateError) {
            result.errors.push(`Failed to update ${employeeId}: ${updateError.message}`)
            continue
          }

          result.updated++
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        result.errors.push(`Error processing ${employeeId}: ${errorMsg}`)
      }
    }

    // Step 4: Lock users not in the sheet (removed employees)
    if (existingEmployees) {
      for (const existing of existingEmployees as Employee[]) {
        if (!sheetEmployeeIds.has(existing.employee_id) && existing.is_active) {
          try {
            console.log(`Locking removed employee: ${existing.employee_id}`)

            // Mark as inactive in metadata
            const { error: updateError } = await admin
              .from('employees')
              .update({
                is_active: false,
                updated_at: new Date().toISOString()
              })
              .eq('employee_id', existing.employee_id)

            if (updateError) {
              result.errors.push(`Failed to lock ${existing.employee_id}: ${updateError.message}`)
              continue
            }

            // Note: We don't delete the auth user, just mark as inactive
            // This preserves login history and allows reactivation
            
            result.locked++
            console.log(`✓ Locked employee: ${existing.employee_id}`)
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            result.errors.push(`Error locking ${existing.employee_id}: ${errorMsg}`)
          }
        }
      }
    }

    result.success = result.errors.length === 0
    console.log('Sync completed:', result)
    return result

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    result.errors.push(`Sync failed: ${errorMsg}`)
    console.error('Sync error:', error)
    return result
  }
}
