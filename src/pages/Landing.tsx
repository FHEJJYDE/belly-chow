import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, MapPin, Clock, ShieldCheck, Store, Bike } from 'lucide-react';
import logo from '@/assets/belly_chow_logo.png';
import { supabase } from '@/integrations/supabase/client';

interface Stats {
  deliveries: number | null;
  vendors: number | null;
}

const Landing = () => {
  const [stats, setStats] = useState<Stats>({ deliveries: null, vendors: null });

  useEffect(() => {
    const fetchStats = async () => {
      const [{ count: deliveries }, { count: vendors }] = await Promise.all([
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'delivered'),
        supabase
          .from('vendors')
          .select('*', { count: 'exact', head: true })
          .eq('is_approved', true),
      ]);
      setStats({
        deliveries: deliveries ?? 0,
        vendors: vendors ?? 0,
      });
    };
    fetchStats();
  }, []);

  // Format large numbers nicely: 1234 → "1,234+"
  const fmt = (n: number | null) => {
    if (n === null) return '—';
    return n.toLocaleString() + '+';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-lg">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} alt="Belly-Chow" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-heading text-lg font-bold tracking-tight">Belly-Chow</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-muted-foreground">Log in</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">Create account</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero — clean, editorial */}
      <section className="container py-28 md:py-40">
        <div className="mx-auto max-w-2xl">
          <p className="mb-6 text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Fast & Fresh Food Delivery
          </p>
          <h1 className="font-heading text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl md:text-6xl">
            Order food from
            <br />
            top local vendors,
            <br />
            <span className="text-primary">delivered to you.</span>
          </h1>
          <p className="mt-8 max-w-md text-base leading-relaxed text-muted-foreground">
            Browse menus, place orders, and track your delivery in real&#8209;time — all from one app built for food lovers & users.
          </p>
          <div className="mt-10 flex gap-3">
            <Link to="/signup">
              <Button size="lg" className="gap-2 px-7 font-semibold">
                Get started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="px-7">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Divider stats */}
      <div className="border-y">
        <div className="container grid grid-cols-3 divide-x">
          {[
            { value: fmt(stats.deliveries), label: 'Deliveries done' },
            { value: fmt(stats.vendors), label: 'Active vendors' },
            { value: '< 20 min', label: 'Avg. delivery time' },
          ].map(({ value, label }) => (
            <div key={label} className="py-8 text-center">
              {value === '—' ? (
                <div className="mx-auto mb-1 h-7 w-16 animate-pulse rounded-md bg-muted" />
              ) : (
                <p className="font-heading text-xl font-bold sm:text-2xl">{value}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works — minimal numbered list */}
      <section className="container py-24 md:py-32">
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground">
            How it works
          </p>
          <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Three steps to your next meal.
          </h2>
          <div className="mt-14 space-y-0 divide-y">
            {[
              { num: '01', title: 'Browse', desc: 'Explore menus from verified campus food vendors.' },
              { num: '02', title: 'Order', desc: 'Add items to your cart and check out in seconds.' },
              { num: '03', title: 'Enjoy', desc: 'A rider delivers straight to your location on campus.' },
            ].map(({ num, title, desc }) => (
              <div key={num} className="flex items-start gap-6 py-8">
                <span className="font-heading text-3xl font-bold text-muted-foreground/30">{num}</span>
                <div>
                  <h3 className="font-heading text-lg font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="border-t bg-muted/30 py-24 md:py-32">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground">
              Why Belly-Chow
            </p>
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Designed around campus life.
            </h2>
          </div>
          <div className="mx-auto mt-16 grid max-w-4xl gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: MapPin, title: 'Campus-wide', desc: 'Hostels, lecture halls, libraries — we deliver everywhere on campus.' },
              { icon: Clock, title: 'Real-time tracking', desc: 'Know exactly where your food is at every moment.' },
              { icon: ShieldCheck, title: 'Verified vendors', desc: 'Every vendor is approved before they can sell on the platform.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-card p-8">
                <Icon className="mb-4 h-5 w-5 text-primary" />
                <h3 className="font-heading text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vendor / Rider CTA */}
      <section className="container py-24 md:py-32">
        <div className="grid gap-6 md:grid-cols-2">
          {[
            {
              icon: Store,
              label: 'For vendors',
              title: 'Sell your food on campus',
              desc: 'Create your menu, manage orders, and grow your customer base — all from one dashboard.',
              cta: 'Register as vendor',
              link: '/signup?role=vendor',
            },
            {
              icon: Bike,
              label: 'For riders',
              title: 'Deliver and earn',
              desc: 'Pick up orders on your schedule, earn per delivery, and cash out anytime.',
              cta: 'Become a rider',
              link: '/signup?role=rider',
            },
          ].map(({ icon: Icon, label, title, desc, cta, link }) => (
            <div key={label} className="flex flex-col justify-between rounded-2xl border bg-card p-8 md:p-10">
              <div>
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border bg-muted">
                  <Icon className="h-5 w-5 text-foreground" />
                </div>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
                <h3 className="mt-2 font-heading text-xl font-bold sm:text-2xl">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
              <Link to={link}>
                <Button variant="outline" className="mt-8 gap-2">
                  {cta} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t">
        <div className="container py-24 text-center md:py-32">
          <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Your next meal is a tap away.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            Create a free account and start ordering from campus vendors today.
          </p>
          <Link to="/signup">
            <Button size="lg" className="mt-8 gap-2 px-8 font-semibold">
              Create your account <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Belly-Chow" className="h-6 w-6 rounded-md object-contain" />
            <span className="font-heading text-sm font-semibold">Belly-Chow</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link to="/support" className="transition-colors hover:text-foreground">Support</Link>
            <Link to="/install" className="transition-colors hover:text-foreground">Install</Link>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Belly-Chow
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
