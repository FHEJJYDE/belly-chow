import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  vendorId: string;
  riderId?: string | null;
  onReviewed?: () => void;
}

const ReviewDialog = ({ open, onOpenChange, orderId, vendorId, riderId, onReviewed }: ReviewDialogProps) => {
  const { user } = useAuth();
  const [vendorRating, setVendorRating] = useState(0);
  const [riderRating, setRiderRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const StarRating = ({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) => (
    <div>
      <p className="mb-1 text-sm font-medium text-foreground">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} type="button" onClick={() => onChange(star)} className="transition-transform hover:scale-110">
            <Star className={`h-7 w-7 ${star <= value ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`} />
          </button>
        ))}
      </div>
    </div>
  );

  const handleSubmit = async () => {
    if (!user || vendorRating === 0) return;
    setSubmitting(true);

    // Submit vendor review
    const { error: vendorErr } = await supabase.from('reviews').insert({
      order_id: orderId,
      user_id: user.id,
      vendor_id: vendorId,
      rating: vendorRating,
      comment,
    });

    // Submit rider review if applicable
    if (riderId && riderRating > 0) {
      await supabase.from('reviews').insert({
        order_id: orderId,
        user_id: user.id,
        rider_id: riderId,
        rating: riderRating,
        comment: '',
      });
    }

    setSubmitting(false);
    if (!vendorErr) {
      toast({ title: 'Thanks for your review! ⭐' });
      onOpenChange(false);
      setVendorRating(0);
      setRiderRating(0);
      setComment('');
      onReviewed?.();
    } else {
      toast({ title: 'Error submitting review', description: vendorErr.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate Your Order ⭐</DialogTitle>
          <DialogDescription>How was your experience?</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <StarRating value={vendorRating} onChange={setVendorRating} label="Food & Vendor" />
          {riderId && (
            <StarRating value={riderRating} onChange={setRiderRating} label="Delivery Rider" />
          )}
          <Textarea
            placeholder="Leave a comment (optional)"
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
          />
          <Button onClick={handleSubmit} disabled={submitting || vendorRating === 0} className="w-full">
            {submitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewDialog;
