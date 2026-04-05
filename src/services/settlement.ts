// Settlement Service for Automatic Fund Distribution
import { supabase } from '@/integrations/supabase/client';
import { walletService } from './wallet';

export interface SettlementData {
  paymentTransactionId: string;
  orderId: string;
  vendorId: string;
  riderId: string;
  foodAmount: number;
  deliveryFee: number;
}

export interface SettlementRecord {
  id: string;
  payment_transaction_id: string;
  recipient_id: string;
  recipient_type: 'vendor' | 'rider' | 'platform';
  amount: number;
  settlement_status: 'completed' | 'failed' | 'pending';
  settlement_reference: string | null;
  created_at: string;
}

// Commission configuration
const SETTLEMENT_CONFIG = {
  DELIVERY_FEE: 1000, // Fixed ₦1,000 delivery fee
  RIDER_SHARE: 500,   // ₦500 to rider
  PLATFORM_SHARE: 500, // ₦500 to platform
  VENDOR_SHARE: 1.0,  // 100% of food amount
};

class SettlementService {
  /**
   * Process settlement for a completed order
   */
  async processOrderSettlement(orderId: string): Promise<SettlementRecord[]> {
    try {
      console.log('Processing settlement for order:', orderId);

      // Get payment transaction details
      const { data: paymentTransaction, error: paymentError } = await supabase
        .from('payment_transactions')
        .select(`
          *,
          orders (
            id,
            vendor_id,
            rider_id,
            status,
            vendors (
              user_id
            )
          )
        `)
        .eq('order_id', orderId)
        .single();

      if (paymentError) {
        console.error('Error fetching payment transaction:', paymentError);
        throw paymentError;
      }

      if (!paymentTransaction) {
        throw new Error('Payment transaction not found for order');
      }

      if (paymentTransaction.payment_status !== 'completed') {
        throw new Error('Payment not completed, cannot process settlement');
      }

      if (paymentTransaction.escrow_status === 'released') {
        console.