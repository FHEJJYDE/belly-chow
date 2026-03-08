import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Truck, Clock, Star, UtensilsCrossed } from 'lucide-react';
import logo from '@/assets/belly_chow_logo.png';

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
            </div>
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
      <section className="container py-20 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
            <span>🎓</span> Made for campus life
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Hungry on campus?
            <br />
            <span className="text-primary">We got you.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground md:text-xl">
            Order from your favorite campus food vendors and get it delivered straight to your hostel, lecture hall, or anywhere on campus.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link to="/signup">
              <Button size="lg" className="w-full px-8 text-base sm:w-auto">
                Start Ordering
              </Button>
            </Link>
            <Link to="/signup?role=vendor">
              <Button variant="outline" size="lg" className="w-full px-8 text-base sm:w-auto">
                Become a Vendor
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/50 py-20">
        <div className="container">
          <h2 className="mb-12 text-center font-heading text-3xl font-bold">
            How it works
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: UtensilsCrossed, title: 'Browse Menus', desc: 'Explore food from vendors right on your campus' },
              { icon: Clock, title: 'Place Order', desc: 'Add to cart and checkout in seconds' },
              { icon: Truck, title: 'Fast Delivery', desc: 'A rider picks up and delivers to your location' },
              { icon: Star, title: 'Rate & Review', desc: 'Help others find the best campus eats' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border bg-card p-6 text-center transition-shadow hover:shadow-lg">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-heading text-lg font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA for Vendors/Riders */}
      <section className="py-20">
        <div className="container">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-8">
              <h3 className="font-heading text-2xl font-bold">🍳 Sell your food</h3>
              <p className="mt-3 text-muted-foreground">
                Set up your vendor account, manage your menu, and reach hundreds of hungry students on campus.
              </p>
              <Link to="/signup?role=vendor">
                <Button className="mt-6" variant="outline">Register as Vendor</Button>
              </Link>
            </div>
            <div className="rounded-2xl border bg-card p-8">
              <h3 className="font-heading text-2xl font-bold">🏍️ Deliver & earn</h3>
              <p className="mt-3 text-muted-foreground">
                Become a Belly-Chow rider. Accept deliveries on your schedule and earn money between classes.
              </p>
              <Link to="/signup?role=rider">
                <Button className="mt-6" variant="outline">Become a Rider</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <UtensilsCrossed className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-heading text-sm font-semibold">Belly-Chow</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Belly-Chow. Feed your belly, fuel your grind.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
