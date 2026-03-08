import { useState } from 'react';
import { MessageCircle, Mail, Phone, Send, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

const WHATSAPP_NUMBER = '2348000000000'; // Replace with actual support number

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
      toast({ title: 'Ticket Submitted', description: 'We\'ll get back to you soon!' });
      setForm({ name: '', email: '', category: '', message: '' });
    } catch {
      toast({ title: 'Error', description: 'Failed to submit. Try WhatsApp instead.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-foreground mb-2">Contact Support</h1>
        <p className="text-muted-foreground mb-8">Need help? Reach out via WhatsApp for instant support or submit a ticket below.</p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="border-2 border-accent/30 cursor-pointer hover:shadow-lg transition-shadow" onClick={handleWhatsApp}>
            <CardHeader className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto text-accent" />
              <CardTitle className="text-xl">WhatsApp Support</CardTitle>
              <CardDescription>Get instant help from our team</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
                <ExternalLink className="h-4 w-4" /> Chat on WhatsApp
              </Button>
              <p className="text-xs text-muted-foreground mt-2">Available Mon–Sat, 8am–8pm</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Mail className="h-12 w-12 mx-auto text-primary" />
              <CardTitle className="text-xl">Email Support</CardTitle>
              <CardDescription>support@bellychow.com</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button variant="outline" className="gap-2" onClick={() => window.open('mailto:support@bellychow.com')}>
                <Mail className="h-4 w-4" /> Send Email
              </Button>
              <p className="text-xs text-muted-foreground mt-2">Response within 24 hours</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Submit a Support Ticket</CardTitle>
            <CardDescription>Fill out the form and we'll respond as soon as possible.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="your@email.com" maxLength={255} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
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
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Describe your issue..." rows={5} maxLength={1000} />
              </div>
              <Button type="submit" disabled={loading} className="w-full gap-2">
                <Send className="h-4 w-4" /> {loading ? 'Submitting...' : 'Submit Ticket'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Support;
