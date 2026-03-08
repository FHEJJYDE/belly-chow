import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Store, Bike } from 'lucide-react';
import logo from '@/assets/belly_chow_logo.png';
import { useToast } from '@/hooks/use-toast';
import type { Enums } from '@/integrations/supabase/types';

type AppRole = Enums<"app_role">;

const roles: { value: AppRole; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'student', label: 'Student', icon: <GraduationCap className="h-5 w-5" />, desc: 'Order food on campus' },
  { value: 'vendor', label: 'Vendor', icon: <Store className="h-5 w-5" />, desc: 'Sell your food' },
  { value: 'rider', label: 'Rider', icon: <Bike className="h-5 w-5" />, desc: 'Deliver & earn' },
];

const Signup = () => {
  const [searchParams] = useSearchParams();
  const defaultRole = (searchParams.get('role') as AppRole) || 'student';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>(defaultRole);
  const [vendorName, setVendorName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
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
      toast({ title: 'Account created!', description: 'Welcome to Belly-Chow 🎉' });
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/" className="mx-auto mb-4 flex items-center gap-2">
            <img src={logo} alt="Belly-Chow" className="h-9 w-9 rounded-lg object-contain" />
            <span className="font-heading text-xl font-bold">Belly-Chow</span>
          </Link>
          <CardTitle className="font-heading text-2xl">Create your account</CardTitle>
          <CardDescription>Join the campus food revolution</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>I am a...</Label>
              <div className="grid grid-cols-3 gap-2">
                {roles.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setSelectedRole(r.value)}
                    className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-center transition-colors ${
                      selectedRole === r.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {r.icon}
                    <span className="text-xs font-medium">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>

            {selectedRole === 'vendor' && (
              <div className="space-y-2">
                <Label htmlFor="vendorName">Business Name</Label>
                <Input id="vendorName" placeholder="e.g. Mama's Kitchen" value={vendorName} onChange={e => setVendorName(e.target.value)} required />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@university.edu" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">Log in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
