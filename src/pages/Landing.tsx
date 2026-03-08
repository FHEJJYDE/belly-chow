import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Truck, Clock, Star, UtensilsCrossed, ChevronRight, Smartphone, Shield, Zap } from 'lucide-react';
import logo from '@/assets/belly_chow_logo.png';

const Landing = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Belly-Chow" className="h-9 w-9 rounded-lg object-contain" />
            <span className="font-heading text-xl font-bold">Belly-Chow</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">Sign up</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 pointer-events-none" />
        <div className="absolute top-20 -left-32 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-10 -right-32 h-80 w-80 rounded-full bg-secondary/5 blur-3xl" />
        
        <div className="container relative py-24 md:py-36 lg:py-44">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border bg-card px-5 py-2 text-sm font-medium text-muted-foreground shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
              Now live on campus
            </div>
            <h1 className="font-heading text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl leading-[1.1]">
              Your campus food,
              <br />
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                delivered fast.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground md:text-xl leading-relaxed">
              Order from campus vendors, track your rider in real-time, and get meals delivered to your hostel or lecture hall.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link to="/signup">
                <Button size="lg" className="h-13 w-full gap-2 px-8 text-base font-semibold shadow-lg shadow-primary/25 sm:w-auto">
                  Start Ordering
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/signup?role=vendor">
                <Button variant="outline" size="lg" className="h-13 w-full px-8 text-base sm:w-auto">
                  Become a Vendor
                </Button>
              </Link>
            </div>
            
            {/* Stats */}
            <div className="mt-16 grid grid-cols-3 gap-4 rounded-2xl border bg-card/60 p-6 shadow-sm backdrop-blur-sm">
              {[
                { value: '500+', label: 'Orders delivered' },
                { value: '20+', label: 'Campus vendors' },
                { value: '4.8★', label: 'Average rating' },
              ].map(({ value, label }) => (
                <div key={label}>
                  <p className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-muted/30 py-24">
        <div className="container">
          <div className="mb-4 text-center">
            <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              How it works
            </span>
          </div>
          <h2 className="mb-4 text-center font-heading text-3xl font-bold sm:text-4xl">
            Food in 3 simple steps
          </h2>
          <p className="mx-auto mb-14 max-w-lg text-center text-muted-foreground">
            No long queues. No wasted time. Just tap, order, and eat.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: UtensilsCrossed, title: 'Browse Menus', desc: 'Explore food from vendors right on your campus', step: '01' },
              { icon: Clock, title: 'Place Order', desc: 'Add to cart and checkout in seconds', step: '02' },
              { icon: Truck, title: 'Fast Delivery', desc: 'A rider picks up and delivers to your door', step: '03' },
              { icon: Star, title: 'Rate & Review', desc: 'Help others find the best campus eats', step: '04' },
            ].map(({ icon: Icon, title, desc, step }) => (
              <div key={title} className="group relative rounded-2xl border bg-card p-6 transition-all hover:shadow-xl hover:-translate-y-1">
                <span className="absolute right-4 top-4 font-heading text-4xl font-black text-muted/40">{step}</span>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-heading text-lg font-bold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Belly-Chow */}
      <section className="py-24">
        <div className="container">
          <div className="mb-4 text-center">
            <span className="inline-block rounded-full bg-accent/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
              Why Belly-Chow
            </span>
          </div>
          <h2 className="mb-14 text-center font-heading text-3xl font-bold sm:text-4xl">
            Built for campus life
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { icon: Zap, title: 'Lightning Fast', desc: 'Average delivery time under 20 minutes. We keep your food hot and fresh.' },
              { icon: Shield, title: 'Safe & Secure', desc: 'Verified vendors, tracked deliveries, and secure payment options.' },
              { icon: Smartphone, title: 'Works Anywhere', desc: 'Install as an app on your phone. Works on iOS, Android, and desktop.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border bg-card p-8 text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
                  <Icon className="h-7 w-7 text-accent" />
                </div>
                <h3 className="mb-3 font-heading text-xl font-bold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Cards */}
      <section className="border-t bg-muted/30 py-24">
        <div className="container">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="relative overflow-hidden rounded-3xl border bg-card p-8 md:p-10">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />
              <span className="text-4xl">🍳</span>
              <h3 className="mt-4 font-heading text-2xl font-bold">Sell your food</h3>
              <p className="mt-3 max-w-sm text-muted-foreground leading-relaxed">
                Set up your vendor profile, manage your menu, and reach hundreds of hungry students every day.
              </p>
              <Link to="/signup?role=vendor">
                <Button className="mt-6 gap-2" variant="outline">
                  Register as Vendor
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="relative overflow-hidden rounded-3xl border bg-card p-8 md:p-10">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-secondary/5 blur-2xl" />
              <span className="text-4xl">🏍️</span>
              <h3 className="mt-4 font-heading text-2xl font-bold">Deliver & earn</h3>
              <p className="mt-3 max-w-sm text-muted-foreground leading-relaxed">
                Become a Belly-Chow rider. Accept deliveries on your own schedule and earn money between classes.
              </p>
              <Link to="/signup?role=rider">
                <Button className="mt-6 gap-2" variant="outline">
                  Become a Rider
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-10 text-center text-primary-foreground shadow-2xl shadow-primary/20 md:p-14">
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">
              Ready to eat?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-primary-foreground/80">
              Join hundreds of students already ordering on Belly-Chow. Your next meal is just a tap away.
            </p>
            <Link to="/signup">
              <Button size="lg" variant="secondary" className="mt-8 h-13 gap-2 px-10 text-base font-semibold shadow-lg">
                Get Started Free
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="container flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Belly-Chow" className="h-7 w-7 rounded-md object-contain" />
            <span className="font-heading text-sm font-semibold">Belly-Chow</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/support" className="hover:text-foreground transition-colors">Support</Link>
            <Link to="/install" className="hover:text-foreground transition-colors">Install App</Link>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Belly-Chow
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
