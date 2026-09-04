import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Store, Bike } from 'lucide-react';
import logo from '@/assets/belly_chow_logo.png';
import { useToast } from '@/hooks/use-toast';
import type { Enums } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

type AppRole = Enums<"app_role">;

const roles: { value: AppRole; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'student', label: 'User / Customer', icon: <User className="h-5 w-5" />, desc: 'Order food & drinks' },
  { value: 'vendor', label: 'Vendor', icon: <Store className="h-5 w-5" />, desc: 'Sell your food' },
  { value: 'rider', label: 'Rider', icon: <Bike className="h-5 w-5" />, desc: 'Deliver & earn' },
];

const Signup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultRole = (searchParams.get('role') as AppRole) || 'student';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>(defaultRole);
  const [vendorName, setVendorName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const [vendorCount, setVendorCount] = useState<number | null>(null);

  useEffect(() => {
    supabase.from('vendors').select('id', { count: 'exact', head: true }).then(({ count }) => {
      if (count !== null) setVendorCount(count);
    });
  }, []);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole === 'vendor' && !vendorName.trim()) {
      toast({ title: 'Please enter your business name', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      await signUp(email, password, fullName, selectedRole, vendorName || undefined);
      toast({ title: 'Account created', description: 'Welcome to Belly-Chow' });
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Signup failed',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between border-r bg-muted/30 p-12">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logo} alt="Belly-Chow" className="h-8 w-8 rounded-lg object-contain" />
          <span className="font-heading text-lg font-bold tracking-tight">Belly-Chow</span>
        </Link>
        <div>
          <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight">
            Join the campus
            <br />
            <span className="text-primary">food network.</span>
          </h1>
          <p className="mt-4 max-w-sm text-muted-foreground leading-relaxed">
            Whether you're ordering, selling, or delivering — there's a place for you.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Belly-Chow</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-10 flex items-center gap-2 lg:hidden">
            <img src={logo} alt="Belly-Chow" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-heading text-lg font-bold tracking-tight">Belly-Chow</span>
          </Link>

          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Get started</p>
          <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight">Create your account</h2>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium">I am a...</Label>
              <div className="grid grid-cols-3 gap-2">
                {roles.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setSelectedRole(r.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all ${
                      selectedRole === r.value
                        ? 'border-foreground bg-foreground/5'
                        : 'border-border hover:border-foreground/30'
                    }`}
                  >
                    {r.icon}
                    <span className="text-xs font-medium">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
              <Input id="fullName" placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>

            {selectedRole === 'vendor' && (
              <div className="space-y-3">
                {vendorCount !== null && vendorCount < 25 ? (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-700 dark:text-green-400">
                    <p className="font-bold flex items-center gap-1.5">
                      <span>🎉</span> Early Bird Offer: Registration FREE!
                    </p>
                    <p className="mt-0.5 opacity-90">{25 - vendorCount} of 25 free vendor spots remaining.</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                    <p className="font-bold flex items-center gap-1.5">
                      <span>💳</span> Vendor Registration Fee: ₦2,000
                    </p>
                    <p className="mt-0.5 opacity-90">First 25 free spots filled. Standard registration fee applies.</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="vendorName" className="text-sm font-medium">Business Name</Label>
                  <Input id="vendorName" placeholder="e.g. Mama's Kitchen" value={vendorName} onChange={e => setVendorName(e.target.value)} required />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input id="email" type="email" placeholder="you@university.edu" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input id="password" type="password" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <div className="mt-8 border-t pt-6">
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-foreground hover:text-primary transition-colors">Log in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
