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
 * Creates a JWT token for Google API authentication using Web Crypto API
 * Compatible with Cloudflare Workers/Pages runtime
 */
async function createGoogleJWT(
  email: string,
  privateKey: string,
  scopes: string[]
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const expiry = now + 3600 // 1 hour

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  }

  const payload = {
    iss: email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: expiry,
    iat: now,
  }

  const base64UrlEncode = (obj: any) => {
    const str = JSON.stringify(obj)
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  const encodedHeader = base64UrlEncode(header)
  const encodedPayload = base64UrlEncode(payload)
  const unsignedToken = `${encodedHeader}.${encodedPayload}`

  // Import the private key
  const pemContents = privateKey
    .replace(/\\n/g, '\n')
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  )

  // Sign the token
  const encoder = new TextEncoder()
  const data = encoder.encode(unsignedToken)
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, data)

  // Convert signature to base64url
  const signatureArray = Array.from(new Uint8Array(signature))
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  return `${unsignedToken}.${signatureBase64}`
}

/**
 * Gets an access token from Google using JWT
 */
async function getGoogleAccessToken(
  email: string,
  privateKey: string,
  scopes: string[]
): Promise<string> {
  const jwt = await createGoogleJWT(email, privateKey, scopes)

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Google OAuth error:', error)
    throw new Error('Failed to get Google access token')
  }

  const data = await response.json()
  return data.access_token
}

/**
 * Reads employee data from Google Sheet using REST API
 * Column A: Name
 * Column B: Employee ID
 * Column C: Position
 * Column D: Email
 * Column E: Phone
 * Column F: Outlet
 */
export async function readEmployeesFromSheet(env: GoogleSheetsEnv): Promise<SheetEmployee[]> {
  try {
    // Get access token using JWT
    const accessToken = await getGoogleAccessToken(
      env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      env.GOOGLE_PRIVATE_KEY,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    )

    // Read data from sheet using REST API
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/A2:F`
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Google Sheets API error:', error)
      throw new Error('Failed to read Google Sheet')
    }

    const data = await response.json()
    const rows = data.values || []

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
