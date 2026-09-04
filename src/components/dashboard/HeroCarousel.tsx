import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Sparkles, ArrowRight, Copy } from 'lucide-react';
import { toast } from 'sonner';

export interface HeroSlide {
  id: string;
  title: string;
  subtitle: string | null;
  badge_text: string | null;
  cta_text: string | null;
  cta_action: string | null;
  theme_gradient: string | null;
  image_url: string | null;
  display_order: number;
}

interface HeroCarouselProps {
  onOpenWallet?: () => void;
  onOpenLocations?: () => void;
  onFilterCategory?: (category: string) => void;
  onOpenPromo?: () => void;
}

const FALLBACK_SLIDES: HeroSlide[] = [
  {
    id: 'default-1',
    title: 'Exam Crunch Chow: 20% OFF',
    subtitle: 'Fuel your night study with hot Jollof & Shawarma. Use code CHOWPASS at checkout!',
    badge_text: '⚡ Flash Deal',
    cta_text: 'Claim 20% OFF',
    cta_action: 'promo_code:CHOWPASS',
    theme_gradient: 'orange-amber',
    image_url: null,
    display_order: 1,
  },
  {
    id: 'default-2',
    title: '₦0 Free Campus Delivery',
    subtitle: 'Enjoy zero delivery fees to all Hostels and Faculty complexes on orders over ₦2,500.',
    badge_text: '🛵 Campus Perk',
    cta_text: 'Pick Your Hall',
    cta_action: 'open_locations',
    theme_gradient: 'emerald-teal',
    image_url: null,
    display_order: 2,
  },
  {
    id: 'default-3',
    title: 'Instant Wallet Cashback',
    subtitle: 'Top up ₦5,000 or more into your Belly-Chow wallet and get instant bonus food credit.',
    badge_text: '💳 Bonus Credit',
    cta_text: 'Top Up Wallet',
    cta_action: 'open_wallet',
    theme_gradient: 'midnight-purple',
    image_url: null,
    display_order: 3,
  },
  {
    id: 'default-4',
    title: 'Late Night Grills & Shawarma',
    subtitle: 'Craving juicy chicken & chips? Open late every night with rapid campus dispatch.',
    badge_text: '🔥 Hot Pick',
    cta_text: 'Explore Grills',
    cta_action: 'filter_category:shawarma',
    theme_gradient: 'crimson-fire',
    image_url: null,
    display_order: 4,
  }
];

const GRADIENT_CLASSES: Record<string, string> = {
  'orange-amber': 'from-orange-600 via-amber-600 to-orange-500',
  'emerald-teal': 'from-emerald-700 via-teal-700 to-cyan-800',
  'midnight-purple': 'from-purple-800 via-indigo-800 to-blue-900',
  'crimson-fire': 'from-rose-700 via-red-700 to-amber-700',
  'royal-blue': 'from-blue-700 via-indigo-700 to-teal-700',
  'dark-gold': 'from-zinc-900 via-neutral-900 to-amber-950 border border-amber-500/30',
};

export default function HeroCarousel({
  onOpenWallet,
  onOpenLocations,
  onFilterCategory,
  onOpenPromo
}: HeroCarouselProps) {
  const [slides, setSlides] = useState<HeroSlide[]>(FALLBACK_SLIDES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const navigate = useNavigate();

  // Touch gesture state
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Fetch active hero banners from Supabase
  useEffect(() => {
    async function loadBanners() {
      try {
        const { data, error } = await supabase
          .from('hero_banners')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (!error && data && data.length > 0) {
          setSlides(data as HeroSlide[]);
        }
      } catch (err) {
        console.error('Error loading hero banners:', err);
      }
    }
    loadBanners();
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  // Auto-play timer
  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide, slides.length]);

  // Handle CTA Action Click
  const handleAction = (action?: string | null) => {
    if (!action) return;

    if (action.startsWith('promo_code:')) {
      const code = action.replace('promo_code:', '');
      navigator.clipboard.writeText(code);
      toast.success(`Coupon code ${code} copied to clipboard!`, {
        description: 'Paste it at checkout for your discount.',
      });
      onOpenPromo?.();
    } else if (action === 'open_wallet') {
      onOpenWallet?.();
    } else if (action === 'open_locations') {
      onOpenLocations?.();
    } else if (action.startsWith('filter_category:')) {
      const cat = action.replace('filter_category:', '');
      onFilterCategory?.(cat);
      toast.info(`Filtered by: ${cat}`);
    } else if (action.startsWith('link:')) {
      const path = action.replace('link:', '');
      navigate(path);
    } else {
      navigate(action);
    }
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 45;
    const isRightSwipe = distance < -45;

    if (isLeftSwipe) {
      nextSlide();
    } else if (isRightSwipe) {
      prevSlide();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (!slides.length) return null;

  const currentSlide = slides[currentIndex] || slides[0];
  const gradientClass = GRADIENT_CLASSES[currentSlide.theme_gradient || 'orange-amber'] || GRADIENT_CLASSES['orange-amber'];

  return (
    <div 
      className="group relative w-full overflow-hidden rounded-2xl md:rounded-3xl shadow-lg transition-all"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Animated Slider Container */}
      <div 
        className={`relative flex min-h-[190px] sm:min-h-[210px] md:min-h-[220px] w-full flex-col justify-between p-5 sm:p-6 md:p-8 text-white bg-gradient-to-r ${gradientClass} transition-all duration-700 ease-out`}
        style={currentSlide.image_url ? {
          backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.65) 60%, rgba(0,0,0,0.4) 100%), url(${currentSlide.image_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : undefined}
      >
        {/* Subtle Decorative Ambient Glow */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-black/20 blur-2xl" />

        {/* Top Meta Bar (Badge + Slide Indicator) */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          {currentSlide.badge_text ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/20 shadow-sm animate-pulse">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              {currentSlide.badge_text}
            </span>
          ) : <div />}

          <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[11px] font-medium text-white/90">
            <span>{currentIndex + 1}</span>
            <span className="text-white/40">/</span>
            <span>{slides.length}</span>
          </div>
        </div>

        {/* Content Box */}
        <div className="relative z-10 my-auto py-2 space-y-1.5 max-w-xl">
          <h2 className="font-heading text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight leading-snug drop-shadow-sm text-white">
            {currentSlide.title}
          </h2>
          {currentSlide.subtitle && (
            <p className="text-xs sm:text-sm text-white/90 line-clamp-2 leading-relaxed">
              {currentSlide.subtitle}
            </p>
          )}
        </div>

        {/* Bottom Action Bar */}
        <div className="relative z-10 flex items-center justify-between pt-2">
          <Button
            size="sm"
            onClick={() => handleAction(currentSlide.cta_action)}
            className="group/btn h-9 sm:h-10 rounded-xl bg-white text-zinc-900 font-bold hover:bg-white/90 shadow-md transition-all active:scale-95 text-xs sm:text-sm px-4 gap-2"
          >
            {currentSlide.cta_action?.startsWith('promo_code:') && (
              <Copy className="h-3.5 w-3.5 text-primary" />
            )}
            <span>{currentSlide.cta_text || 'Explore Deal'}</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
          </Button>

          {/* Navigation Dots */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentIndex === idx 
                    ? 'w-6 bg-white shadow-sm' 
                    : 'w-2 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Desktop Previous / Next Hover Arrows */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 -translate-y-1/2 hidden md:flex h-9 w-9 items-center justify-center rounded-full bg-black/30 backdrop-blur-md text-white border border-white/20 opacity-0 transition-all hover:bg-black/50 group-hover:opacity-100 shadow-md"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:flex h-9 w-9 items-center justify-center rounded-full bg-black/30 backdrop-blur-md text-white border border-white/20 opacity-0 transition-all hover:bg-black/50 group-hover:opacity-100 shadow-md"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}
