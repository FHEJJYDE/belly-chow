# Payment Escrow System with Platform Wallets - Design Document

## Overview

Design and implement a comprehensive payment system for Belly-Chow that uses escrow-based transactions with Paystack integration and platform wallets. The system will hold customer payments until delivery completion, then automatically distribute funds to vendors, riders, and platform.

## System Architecture

### Payment Flow
```
Customer Payment → Paystack → Platform Escrow → Delivery Completion → Auto-Settlement
├── Vendor Wallet (100% of food price)
├── Rider Wallet (₦500 fixed delivery fee)
└── Platform Revenue (₦500 fixed delivery fee - Paystack fees)
```

### Wallet System
- **Customer Wallets**: Store refunds, promotional credits
- **Vendor Wallets**: Receive earnings, request withdrawals
- **Rider Wallets**: Receive delivery earnings, instant access
- **Platform Wallet**: Collect commissions and fees

## Database Schema

### Core Payment Tables

#### payment_transactions
```sql
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) UNIQUE,
    customer_id UUID REFERENCES profiles(id),
    total_amount DECIMAL(10,2) NOT NULL,
    food_amount DECIMAL(10,2) NOT NULL,
    delivery_fee DECIMAL(10,2) DEFAULT 1000.00, -- Fixed ₦1,000 delivery fee
    payment_method TEXT NOT NULL, -- 'paystack_card', 'paystack_transfer', 'wallet'
    payment_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
    paystack_reference TEXT UNIQUE,
    paystack_transaction_id TEXT,
    escrow_status TEXT DEFAULT 'held', -- 'held', 'released', 'refunded'
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    released_at TIMESTAMP
);
```

#### user_wallets
```sql
CREATE TABLE user_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) UNIQUE,
    balance DECIMAL(10,2) DEFAULT 0.00,
    pending_balance DECIMAL(10,2) DEFAULT 0.00, -- Funds in escrow
    total_earned DECIMAL(10,2) DEFAULT 0.00, -- Lifetime earnings
    total_withdrawn DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### wallet_transactions
```sql
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID REFERENCES user_wallets(id),
    transaction_type TEXT NOT NULL, -- 'credit', 'debit', 'escrow_hold', 'escrow_release'
    amount DECIMAL(10,2) NOT NULL,
    reference_type TEXT, -- 'order', 'withdrawal', 'refund', 'bonus'
    reference_id UUID,
    description TEXT NOT NULL,
    balance_before DECIMAL(10,2),
    balance_after DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### settlement_records
```sql
CREATE TABLE settlement_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_transaction_id UUID REFERENCES payment_transactions(id),
    recipient_id UUID REFERENCES profiles(id),
    recipient_type TEXT NOT NULL, -- 'vendor', 'rider', 'platform'
    amount DECIMAL(10,2) NOT NULL,
    settlement_status TEXT DEFAULT 'completed', -- 'completed', 'failed'
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### withdrawal_requests
```sql
CREATE TABLE withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    amount DECIMAL(10,2) NOT NULL,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    paystack_transfer_code TEXT,
    admin_notes TEXT,
    requested_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);
```

## Commission Structure

### Revenue Split Configuration
```javascript
const COMMISSION_RATES = {
  // Vendor gets 100% of food price
  vendor_share: 1.00,        // 100% to vendor (full meal price)
  
  // Fixed delivery fee: ₦1,000
  delivery_fee: 1000,        // Fixed ₦1,000 per delivery
  rider_share: 500,          // ₦500 to rider
  platform_delivery_share: 500, // ₦500 to platform
  
  // Additional fees
  payment_processing_fee: 0.015, // 1.5% Paystack fee on total
};
```

### Example Calculation
```
Order: ₦2,000 food + ₦1,000 delivery = ₦3,000 total

Vendor receives: ₦2,000 (100% of food price)
Rider receives: ₦500 (fixed from delivery fee)
Platform gets: ₦500 (fixed from delivery fee)
Paystack fee: ₦3,000 × 0.015 = ₦45

Net to platform: ₦500 - ₦45 = ₦455 per order
```

## Kora Integration

### Payment Processing
- **Card Payments**: Direct Kora checkout
- **Bank Transfers**: Kora dedicated accounts
- **USSD**: Kora USSD codes
- **QR Codes**: Kora QR payment

### Webhook Handling
- Payment success → Release escrow
- Payment failure → Cancel order
- Dispute → Hold settlement

### Transfer Recipients
- Vendor bank accounts
- Rider bank accounts  
- Automated withdrawal processing

## Wallet Features

### Customer Wallet
- **Credits**: Refunds, promotional bonuses
- **Usage**: Pay for orders, faster checkout
- **Top-up**: Add money via Paystack

### Vendor Wallet
- **Earnings**: Automatic deposits after delivery
- **Withdrawals**: Request payout to bank account
- **Analytics**: Daily/weekly/monthly earnings
- **Minimum**: ₦1,000 minimum withdrawal

### Rider Wallet
- **Earnings**: Delivery fees + bonuses
- **Instant Access**: Withdraw anytime
- **Performance Bonuses**: Extra earnings for ratings
- **Minimum**: ₦500 minimum withdrawal

## User Interface Components

### Wallet Dashboard
- Current balance display
- Recent transactions list
- Withdrawal request form
- Earnings analytics

### Payment Flow
- Multiple payment options
- Wallet balance usage
- Payment confirmation
- Receipt generation

### Admin Panel
- Transaction monitoring
- Settlement processing
- Withdrawal approvals
- Revenue analytics

## Security & Compliance

### Data Protection
- Encrypt sensitive financial data
- PCI DSS compliance via Paystack
- Secure API endpoints
- Audit trail logging

### Fraud Prevention
- Transaction velocity limits
- Suspicious activity monitoring
- Account verification requirements
- Withdrawal limits

### Reconciliation
- Daily balance reconciliation
- Paystack transaction matching
- Automated discrepancy alerts
- Monthly financial reports

## Implementation Phases

### Phase 1: Basic Escrow (Week 1-2)
- Database schema implementation
- Paystack payment integration
- Basic wallet system
- Order payment flow

### Phase 2: Settlement Automation (Week 3)
- Automatic fund distribution
- Wallet transaction tracking
- Basic withdrawal system
- Admin monitoring dashboard

### Phase 3: Advanced Features (Week 4-5)
- Withdrawal request system
- Advanced analytics
- Performance bonuses
- Promotional credits

### Phase 4: Optimization (Week 6)
- Payment method optimization
- User experience improvements
- Performance monitoring
- Security enhancements

### API Endpoints

### Payment Endpoints
```
POST /api/payments/initialize - Initialize payment
POST /api/payments/verify - Verify payment status
POST /api/payments/webhook - Kora webhook handler
```

### Wallet Endpoints
```
GET /api/wallet/balance - Get wallet balance
GET /api/wallet/transactions - Get transaction history
POST /api/wallet/withdraw - Request withdrawal
GET /api/wallet/analytics - Get earnings analytics
```

### Admin Endpoints
```
GET /api/admin/payments - Monitor all payments
POST /api/admin/settlements/process - Process settlements
GET /api/admin/withdrawals - Manage withdrawal requests
POST /api/admin/withdrawals/:id/approve - Approve withdrawal
```

## Error Handling

### Payment Failures
- Automatic retry mechanism
- Customer notification system
- Order cancellation workflow
- Refund processing

### Settlement Failures
- Manual intervention alerts
- Retry mechanisms
- Customer support integration
- Audit trail maintenance

## Monitoring & Analytics

### Key Metrics
- Payment success rate
- Settlement processing time
- Wallet usage statistics
- Revenue per transaction

### Dashboards
- Real-time payment monitoring
- Daily settlement reports
- Vendor/rider earnings analytics
- Platform revenue tracking

## Correctness Properties

### Payment Processing Properties
1. **Payment Atomicity**: Payment success must result in order confirmation
2. **Escrow Integrity**: Funds held in escrow equal pending settlements
3. **Settlement Accuracy**: Sum of settlements equals original payment minus fees
4. **Balance Consistency**: Wallet balances match transaction history

### Wallet System Properties
1. **Balance Non-Negative**: Wallet balances cannot go below zero
2. **Transaction Immutability**: Completed transactions cannot be modified
3. **Withdrawal Limits**: Cannot withdraw more than available balance
4. **Audit Trail**: All wallet changes must be logged

### Security Properties
1. **Authentication Required**: All financial operations require authentication
2. **Authorization Checks**: Users can only access their own wallet data
3. **Rate Limiting**: Prevent abuse of payment and withdrawal endpoints
4. **Data Encryption**: Sensitive financial data encrypted at rest and in transit

## Testing Strategy

### Unit Tests
- Payment calculation functions
- Wallet balance operations
- Commission distribution logic
- Validation functions

### Integration Tests
- Paystack API integration
- Database transaction integrity
- Webhook processing
- Settlement workflows

### Property-Based Tests
- Payment amount calculations across various order values
- Wallet balance consistency across transaction sequences
- Commission distribution accuracy
- Settlement completeness verification

This design provides a robust, scalable payment system that handles escrow transactions, platform wallets, and automated settlements while maintaining security and compliance standards.