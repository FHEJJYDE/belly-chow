# Payment System Setup Guide

## Overview
This guide will help you set up and test the KoraPay payment integration in your Belly-Chow application.

## Prerequisites
1. **Supabase Database**: Your Supabase project should be running
2. **KoraPay Account**: You need test API keys from KoraPay
3. **Environment Variables**: Properly configured `.env` file

## Step 1: Database Setup

### 1.1 Run Database Migration
1. Open your Supabase dashboard
2. Go to the SQL Editor
3. Copy and paste the contents of `database-setup.sql` 
4. Run the script to create all required tables

### 1.2 Verify Tables Created
After running the script, you should have these new tables:
- `payment_transactions`
- `escrow_transactions` 
- `refund_transactions`
- `vendor_payouts`

## Step 2: Environment Configuration

### 2.1 Verify Your .env File
Make sure your `.env` file contains:
```env
# Supabase Configuration
VITE_SUPABASE_PROJECT_ID="your_project_id"
VITE_SUPABASE_URL="https://your_project_id.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your_anon_key"

# KoraPay Configuration
VITE_KORAPAY_PUBLIC_KEY="pk_test_your_test_key"
VITE_PAYMENT_ENVIRONMENT="test"
VITE_PAYMENT_CURRENCY="NGN"
VITE_ESCROW_RELEASE_DELAY_HOURS="24"
```

### 2.2 KoraPay Test Keys
- **Test Public Key**: `pk_test_4pox8XAPcQX45REiDo4awU4G3e7RVuXjo3XRRpYx` (already configured)
- **Test Secret Key**: `sk_test_hWN55SC6kNjFNZYpxn21b5Hpp6LP97KUi2sNbiZw` (for backend use)

## Step 3: Test the Payment System

### 3.1 Access Test Page
1. Start your development server: `npm run dev`
2. Navigate to: `http://localhost:8080/test-payment`
3. Log in with your test account

### 3.2 Test Payment Flow
1. **Test KoraPay Direct**: 
   - Click "Test KoraPay Direct" button
   - This tests the basic KoraPay integration
   - Should open KoraPay checkout in new tab

2. **Test Full Payment Flow**:
   - Click "Test Full Payment Flow" button  
   - This tests the complete payment + database integration
   - Creates payment transaction records

### 3.3 Test Payment Methods
KoraPay test environment supports:
- **Card payments**: Use test card numbers
- **Bank transfer**: Simulated bank transfer
- **USSD**: Test USSD codes

### 3.4 Test Card Numbers (KoraPay Test Environment)
```
Successful Payment:
Card: 4084084084084081
CVV: 408
Expiry: Any future date

Failed Payment:
Card: 4084084084084099
CVV: 408  
Expiry: Any future date
```

## Step 4: Real Cart Testing

### 4.1 Add Items to Cart
1. Go to the main dashboard: `http://localhost:8080/dashboard`
2. Browse vendors and add items to cart
3. Go to cart: `http://localhost:8080/cart`
4. Fill in delivery location
5. Click "Place Order"

### 4.2 Complete Payment
1. Payment modal should open
2. Select payment method
3. Click "Pay Securely"
4. Complete payment on KoraPay checkout
5. You'll be redirected back to the app

## Step 5: Troubleshooting

### 5.1 Common Issues

**"KoraPay public key is not configured"**
- Check your `.env` file has `VITE_KORAPAY_PUBLIC_KEY`
- Restart your dev server after changing `.env`

**"Failed to fetch escrow transactions"**
- Run the database setup script
- Check Supabase connection
- Verify table permissions

**Payment modal doesn't open**
- Check browser console for errors
- Verify you're logged in
- Check cart has items

### 5.2 Debug Steps
1. Open browser developer tools
2. Check Console tab for errors
3. Check Network tab for failed requests
4. Verify database tables exist in Supabase

## Step 6: Production Setup

### 6.1 Get Production Keys
1. Complete KoraPay business verification
2. Get production API keys
3. Update environment variables:
   ```env
   VITE_KORAPAY_PUBLIC_KEY="pk_live_your_live_key"
   VITE_PAYMENT_ENVIRONMENT="live"
   ```

### 6.2 Webhook Setup
For production, you'll need to set up webhooks:
1. Create webhook endpoint in your backend
2. Configure webhook URL in KoraPay dashboard
3. Handle payment status updates

## Testing Checklist

- [ ] Database tables created successfully
- [ ] Environment variables configured
- [ ] Test payment page loads (`/test-payment`)
- [ ] KoraPay direct test works
- [ ] Full payment flow test works
- [ ] Cart payment flow works
- [ ] Payment verification works
- [ ] No console errors

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify your Supabase database setup
3. Confirm KoraPay test keys are working
4. Test with different browsers/devices

## Next Steps

Once testing is complete:
1. Set up webhook handling for production
2. Implement payment status monitoring
3. Add payment history for users
4. Set up automated escrow release
5. Configure vendor payout system