import { useState } from 'react';
import { MessageCircle, Mail, Send, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppNavbar from '@/components/layout/AppNavbar';
import { z } from 'zod';

const WHATSAPP_NUMBER = '2348000000000';

const supportSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Invalid email'),
  category: z.string().min(1, 'Select a category'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(1000),
});

const Support = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', category: '', message: '' });

  const handleWhatsApp = () => {
    const text = encodeURIComponent('Hi, I need help with BellyChow.');
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = supportSchema.safeParse(form);
    if (!result.success) {
      toast({ title: 'Validation Error', description: result.error.errors[0].message, variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('support_tickets').insert({
        user_id: user?.id || null,
        name: result.data.name,
        email: result.data.email,
        category: result.data.category,
        message: result.data.message,
      });
      if (error) throw error;
      toast({ title: 'Ticket submitted', description: 'We\'ll get back to you soon.' });
      setForm({ name: '', email: '', category: '', message: '' });
    } catch {
      toast({ title: 'Error', description: 'Failed to submit. Try WhatsApp instead.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <AppNavbar />
      <div className="container max-w-2xl py-8">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Help</p>
        <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight">Contact support</h1>
        <p className="mt-2 text-muted-foreground">Reach out via WhatsApp for instant support or submit a ticket below.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Card className="cursor-pointer transition-all hover:ring-1 hover:ring-border" onClick={handleWhatsApp}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-heading font-semibold text-sm">WhatsApp</p>
                <p className="text-xs text-muted-foreground">Instant support, Mon–Sat</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card className="cursor-pointer transition-all hover:ring-1 hover:ring-border" onClick={() => window.open('mailto:support@bellychow.com')}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted">
                <Mail className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-heading font-semibold text-sm">Email</p>
                <p className="text-xs text-muted-foreground">support@bellychow.com</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 border-t pt-10">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Or</p>
          <h2 className="mt-1 mb-6 font-heading text-lg font-semibold tracking-tight">Submit a ticket</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="your@email.com" maxLength={255} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Select issue type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="order">Order Issue</SelectItem>
                  <SelectItem value="payment">Payment Problem</SelectItem>
                  <SelectItem value="delivery">Delivery Issue</SelectItem>
                  <SelectItem value="account">Account Help</SelectItem>
                  <SelectItem value="vendor">Vendor Inquiry</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Message</Label>
              <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Describe your issue..." rows={5} maxLength={1000} />
            </div>
            <Button type="submit" disabled={loading} className="w-full gap-2">
              <Send className="h-4 w-4" /> {loading ? 'Submitting...' : 'Submit ticket'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Support;
