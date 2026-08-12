# Manual Database Setup Guide

Since the Supabase CLI installation is having issues, let's set up the database manually through the web dashboard.

## Step 1: Access Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sign in to your account
3. Select your project: `yadwcwtzmgsnavaezhhr`

## Step 2: Open SQL Editor

1. In your project dashboard, click on "SQL Editor" in the left sidebar
2. Click "New Query" to create a new SQL script

## Step 3: Run the Migration

1. Copy the entire contents of the file `supabase/migrations/001_payment_system_setup.sql`
2. Paste it into the SQL Editor
3. Click "Run" to execute the script

## Step 4: Verify Tables Created

After running the script, go to "Table Editor" in the left sidebar and verify these tables exist:

- ✅ `payment_transactions`
- ✅ `escrow_transactions` 
- ✅ `refund_transactions`
- ✅ `vendor_payouts`

## Step 5: Check Existing Tables Updated

Verify these existing tables have new columns:

### `vendors` table:
- Should have a new `bank_details` column (JSONB type)

### `orders` table:
- Should have new columns:
  - `payment_reference` (VARCHAR)
  - `payment_method` (VARCHAR) 
  - `payment_status` (VARCHAR)

## Step 6: Test the Setup

1. Go back to your app: `http://localhost:8080/test-payment`
2. Try the payment test buttons
3. The "Failed to fetch escrow transactions" error should be gone

## Alternative: Quick Setup via Browser

If you prefer, you can also:

1. Copy the SQL from `database-setup.sql` (the original file I created)
2. Run it directly in the Supabase SQL Editor
3. Both files contain the same setup, just organized differently

## Troubleshooting

**If you get permission errors:**
- Make sure you're logged in as the project owner
- Check that your project is active and not paused

**If tables already exist:**
- The script uses `IF NOT EXISTS` so it's safe to run multiple times
- It will only add missing tables/columns

**If foreign key errors occur:**
- Make sure your `orders` and `vendors` tables exist first
- Check that the referenced columns have the correct data types

## Next Steps

Once the database is set up:

1. Test the payment system at `/test-payment`
2. Try a full cart checkout flow
3. Verify payments work end-to-end

## Manual Supabase CLI Installation (Optional)

If you want to install the Supabase CLI later, you can:

1. **Using Chocolatey (Windows):**
   ```powershell
   choco install supabase
   ```

2. **Using Scoop (Windows):**
   ```powershell
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase
   ```

3. **Direct Download:**
   - Go to [Supabase CLI releases](https://github.com/supabase/cli/releases)
   - Download the Windows binary
   - Add it to your PATH

But for now, the manual dashboard approach will work perfectly fine!