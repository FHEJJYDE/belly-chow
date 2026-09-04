import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/belly_chow_logo.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, signIn, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (user && !loading) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signIn(email, password);
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (error: any) {
      toast({
        title: 'Login failed',
        description: error.message || 'Invalid email or password',
        variant: 'destructive',
      });
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
            Your campus food,
            <br />
            <span className="text-primary">delivered fast.</span>
          </h1>
          <p className="mt-4 max-w-sm text-muted-foreground leading-relaxed">
            Browse menus, place orders, and track your delivery in real‑time.
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

          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Welcome back</p>
          <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight">Log in to your account</h2>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input id="email" type="email" placeholder="you@university.edu" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Log in'}
            </Button>
          </form>

          <div className="mt-8 border-t pt-6">
            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/signup" className="font-medium text-foreground hover:text-primary transition-colors">Sign up</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
