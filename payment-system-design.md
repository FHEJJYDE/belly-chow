# Belly-Chow Payment System Design

## Database Schema

### 1. Payment Transactions Table
```sql
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    customer_id UUID REFERENCES profiles(id),
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT NOT NULL, -- 'card', 'bank_transfer', 'wallet'
    payment_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
    payment_reference TEXT, -- External payment gateway reference
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);
```

### 2. Settlement Records Table
```sql
CREATE TABLE settlement_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_transaction_id UUID REFERENCES payment_transactions(id),
    recipient_id UUID REFERENCES profiles(id),
    recipient_type TEXT NOT NULL, -- 'vendor', 'rider', 'platform'
    amount DECIMAL(10,2) NOT NULL,
    settlement_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    settlement_method TEXT, -- 'bank_transfer', 'wallet', 'mobile_money'
    settlement_reference TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    settled_at TIMESTAMP
);
```

### 3. Wallet System (Optional)
```sql
CREATE TABLE user_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) UNIQUE,
    balance DECIMAL(10,2) DEFAULT 0.00,
    pending_balance DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID REFERENCES user_wallets(id),
    transaction_type TEXT NOT NULL, -- 'credit', 'debit', 'pending_credit'
    amount DECIMAL(10,2) NOT NULL,
    reference_id UUID, -- Links to order, settlement, etc.
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Payment Integration Options

### Option 1: Nigerian Payment Gateways
- **Paystack** (Recommended for Nigeria)
- **Flutterwave**
- **Interswitch**

### Option 2: International Options
- **Stripe** (Global, excellent API)
- **PayPal**

## Settlement Configuration

### Commission Structure
```javascript
const COMMISSION_RATES = {
  vendor: 0.75,      // 75% to vendor
  rider: 0.15,       // 15% to rider  
  platform: 0.10     // 10% platform fee
};

const DELIVERY_FEE_SPLIT = {
  rider: 0.80,       // 80% of delivery fee to rider
  platform: 0.20     // 20% to platform
};
```

### Settlement Timing Options
1. **Instant Settlement** - Immediate after delivery (higher fees)
2. **Daily Settlement** - End of day batch processing
3. **Weekly Settlement** - Lower fees, better cash flow management
4. **On-Demand** - Vendors/riders can request payouts

## Implementation Strategy

### Phase 1: Basic Escrow System
- Collect payments from customers
- Hold in platform account
- Manual settlement initially

### Phase 2: Automated Settlement
- Automatic splits on delivery completion
- Integration with payment gateway APIs
- Basic wallet system

### Phase 3: Advanced Features
- Instant payouts
- Multiple payment methods
- Advanced analytics and reporting
- Dispute resolution system

## Security Considerations

### 1. PCI Compliance
- Never store card details
- Use payment gateway tokenization
- Implement proper encryption

### 2. Fraud Prevention
- Transaction monitoring
- Velocity checks
- Risk scoring

### 3. Reconciliation
- Daily transaction reconciliation
- Automated balance checks
- Audit trails

## Nigerian Market Specific Features

### 1. Bank Transfer Integration
- Account number verification
- NUBAN validation
- Bank name resolution

### 2. Mobile Money
- MTN Mobile Money
- Airtel Money
- 9mobile Money

### 3. USSD Payments
- *737# (GTBank)
- *770# (Fidelity)
- Other bank USSD codes

## Sample Implementation Code

### Payment Processing Function
```javascript
async function processOrderPayment(orderId, paymentDetails) {
  const order = await getOrder(orderId);
  
  // 1. Process payment with gateway
  const paymentResult = await paymentGateway.charge({
    amount: order.total,
    email: order.customer_email,
    reference: `BC_${orderId}`,
    callback_url: `${BASE_URL}/payment/callback`
  });
  
  // 2. Create payment transaction record
  const transaction = await createPaymentTransaction({
    order_id: orderId,
    customer_id: order.customer_id,
    total_amount: order.total,
    payment_reference: paymentResult.reference,
    payment_status: 'pending'
  });
  
  return { transaction, payment_url: paymentResult.authorization_url };
}
```

### Settlement Processing Function
```javascript
async function processOrderSettlement(orderId) {
  const order = await getOrderWithDetails(orderId);
  const transaction = await getPaymentTransaction(orderId);
  
  if (transaction.payment_status !== 'completed') {
    throw new Error('Payment not completed');
  }
  
  const settlements = [
    {
      recipient_id: order.vendor_id,
      recipient_type: 'vendor',
      amount: order.subtotal * COMMISSION_RATES.vendor
    },
    {
      recipient_id: order.rider_id,
      recipient_type: 'rider', 
      amount: (order.delivery_fee * DELIVERY_FEE_SPLIT.rider) + 
              (order.subtotal * COMMISSION_RATES.rider)
    },
    {
      recipient_id: 'platform',
      recipient_type: 'platform',
      amount: order.total * COMMISSION_RATES.platform
    }
  ];
  
  // Create settlement records
  for (const settlement of settlements) {
    await createSettlementRecord({
      payment_transaction_id: transaction.id,
      ...settlement
    });
  }
  
  // Process actual settlements (bank transfers, etc.)
  await processSettlements(settlements);
}
```

## Recommended Next Steps

1. **Choose Payment Gateway** - Start with Paystack for Nigerian market
2. **Implement Basic Escrow** - Hold payments until delivery
3. **Create Settlement System** - Automated splits on completion
4. **Add Wallet Feature** - For vendors/riders to track earnings
5. **Build Admin Dashboard** - For payment monitoring and reconciliation

Would you like me to help implement any specific part of this payment system?