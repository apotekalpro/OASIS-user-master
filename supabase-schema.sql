-- Create employees table to store metadata
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  outlet TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on employee_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);

-- Create index on auth_user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_employees_auth_user_id ON employees(auth_user_id);

-- Create index on is_active for filtering
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);

-- Enable Row Level Security
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can read their own employee record
CREATE POLICY "Users can view their own employee data"
  ON employees
  FOR SELECT
  USING (auth.uid() = auth_user_id);

-- Create policy: Service role can do anything (for sync operations)
CREATE POLICY "Service role has full access"
  ON employees
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
