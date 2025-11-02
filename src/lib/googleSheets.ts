import { google } from 'googleapis'

export interface GoogleSheetsEnv {
  GOOGLE_SHEET_ID: string
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string
  GOOGLE_PRIVATE_KEY: string
}

export interface SheetEmployee {
  name: string
  employeeId: string
  position: string
  email: string
  phone: string
  outlet: string
}

/**
 * Reads employee data from Google Sheet
 * Column A: Name
 * Column B: Employee ID
 * Column C: Position
 * Column D: Email
 * Column E: Phone
 * Column F: Outlet
 */
export async function readEmployeesFromSheet(env: GoogleSheetsEnv): Promise<SheetEmployee[]> {
  try {
    // Create JWT auth client
    const auth = new google.auth.JWT({
      email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // Read data from sheet (assuming first sheet, starting from row 2 to skip header)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: env.GOOGLE_SHEET_ID,
      range: 'A2:F', // Read from row 2 to end, columns A to F
    })

    const rows = response.data.values || []
    
    const employees: SheetEmployee[] = []
    
    for (const row of rows) {
      // Skip empty rows or rows without employee ID
      if (!row[1] || row[1].trim() === '') continue
      
      employees.push({
        name: row[0] || '',
        employeeId: row[1] || '',
        position: row[2] || '',
        email: row[3] || '',
        phone: row[4] || '',
        outlet: row[5] || '',
      })
    }

    return employees
  } catch (error) {
    console.error('Error reading Google Sheet:', error)
    throw new Error('Failed to read employee data from Google Sheet')
  }
}
