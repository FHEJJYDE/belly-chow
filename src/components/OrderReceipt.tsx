import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Printer, Download } from 'lucide-react';

interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

interface OrderReceiptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    created_at: string;
    total: number;
    delivery_fee: number;
    discount?: number;
    promo_code?: string | null;
    payment_method: string;
    payment_status: string;
    delivery_location: string;
    status: string;
  };
  items: ReceiptItem[];
  vendorName?: string;
}

const OrderReceipt = ({ open, onOpenChange, order, items, vendorName }: OrderReceiptProps) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const discount = Number(order.discount) || 0;
  const grandTotal = Number(order.total) + Number(order.delivery_fee) - discount;

  const handlePrint = () => {
    const content = receiptRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt #${order.id.slice(0, 8)}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 400px; margin: 20px auto; padding: 0 16px; color: #1a1a1a; }
            .header { text-align: center; border-bottom: 2px dashed #ddd; padding-bottom: 16px; margin-bottom: 16px; }
            .header h1 { font-size: 20px; margin: 0 0 4px; }
            .header p { font-size: 12px; color: #666; margin: 2px 0; }
            .items { border-bottom: 1px dashed #ddd; padding-bottom: 12px; margin-bottom: 12px; }
            .item { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }
            .totals .row { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
            .totals .total { font-size: 16px; font-weight: bold; border-top: 2px solid #1a1a1a; padding-top: 8px; margin-top: 8px; }
            .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #999; border-top: 2px dashed #ddd; padding-top: 12px; }
            .discount { color: #16a34a; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🍽️ Belly-Chow</h1>
            <p>Order Receipt</p>
            <p><strong>#${order.id.slice(0, 8)}</strong></p>
            <p>${new Date(order.created_at).toLocaleString()}</p>
            ${vendorName ? `<p>From: ${vendorName}</p>` : ''}
          </div>
          <div class="items">
            ${items.map(i => `<div class="item"><span>${i.quantity}× ${i.name}</span><span>₦${(i.price * i.quantity).toLocaleString()}</span></div>`).join('')}
          </div>
          <div class="totals">
            <div class="row"><span>Subtotal</span><span>₦${Number(order.total).toLocaleString()}</span></div>
            <div class="row"><span>Service Fee</span><span>₦${Number(order.delivery_fee).toLocaleString()}</span></div>
            ${discount > 0 ? `<div class="row discount"><span>Promo (${order.promo_code})</span><span>-₦${discount.toLocaleString()}</span></div>` : ''}
            <div class="row total"><span>Total</span><span>₦${grandTotal.toLocaleString()}</span></div>
          </div>
          <div style="margin-top:12px;font-size:12px;">
            <p>Payment: ${order.payment_method.replace('_', ' ')} (${order.payment_status})</p>
            <p>Delivery: ${order.delivery_location}</p>
            <p>Status: ${order.status}</p>
          </div>
          <div class="footer">
            <p>Thank you for ordering with Belly-Chow! 🙏</p>
            <p>belly-chow.lovable.app</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Receipt — #{order.id.slice(0, 8)}
          </DialogTitle>
        </DialogHeader>

        <div ref={receiptRef}>
          <Card className="border-dashed">
            <CardContent className="p-4 space-y-4">
              {/* Header */}
              <div className="text-center border-b border-dashed pb-3">
                <h2 className="font-heading text-lg font-bold">🍽️ Belly-Chow</h2>
                <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
                {vendorName && <p className="text-sm text-muted-foreground">From: {vendorName}</p>}
              </div>

              {/* Items */}
              <div className="space-y-1.5 border-b border-dashed pb-3">
                {items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.quantity}× {item.name}</span>
                    <span>₦{(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>₦{Number(order.total).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Service Fee</span>
                  <span>₦{Number(order.delivery_fee).toLocaleString()}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Promo ({order.promo_code})</span>
                    <span>-₦{discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 font-heading text-base font-bold">
                  <span>Total</span>
                  <span className="text-primary">₦{grandTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Meta */}
              <div className="border-t border-dashed pt-3 space-y-1 text-xs text-muted-foreground">
                <p>Payment: {order.payment_method.replace('_', ' ')} ({order.payment_status})</p>
                <p>Delivery: {order.delivery_location}</p>
              </div>

              {/* Footer */}
              <div className="text-center border-t border-dashed pt-3">
                <p className="text-xs text-muted-foreground">Thank you for ordering! 🙏</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2">
          <Button onClick={handlePrint} className="flex-1 gap-2">
            <Printer className="h-4 w-4" /> Print Receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderReceipt;
