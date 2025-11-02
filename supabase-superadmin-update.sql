-- Add superadmin column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT false;

-- Set MPS240004 as superadmin
UPDATE employees SET is_superadmin = true WHERE employee_id = 'MPS240004';

-- Create index on is_superadmin for faster queries
CREATE INDEX IF NOT EXISTS idx_employees_is_superadmin ON employees(is_superadmin);
