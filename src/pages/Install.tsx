import { useEffect, useState } from "react";
import { Download, Share, Plus, ArrowUp, CheckCircle2, Smartphone, Monitor, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

type Platform = "ios-safari" | "ios-other" | "android" | "desktop" | "standalone";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true;
  if (isStandalone) return "standalone";

  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) {
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
    return isSafari ? "ios-safari" : "ios-other";
  }

  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export default function Install() {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setPlatform(detectPlatform());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  if (platform === "standalone" || installed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <CheckCircle2 className="h-16 w-16 text-primary mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">You're all set!</h1>
        <p className="text-muted-foreground text-center mb-6">
          Belly-Chow is already installed on your device.
        </p>
        <Button onClick={() => navigate("/dashboard")} className="bg-primary text-primary-foreground">
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-accent/10 pt-12 pb-8 px-6 text-center">
        <div className="mx-auto w-20 h-20 rounded-2xl overflow-hidden shadow-lg mb-4 border-2 border-primary/20">
          <img src="/belly_chow_logo.png" alt="Belly-Chow" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-2xl font-bold text-foreground font-display">Install Belly-Chow</h1>
        <p className="text-muted-foreground mt-2 max-w-sm mx-auto text-sm">
          Get the full app experience — faster loading, offline access, and home screen launch.
        </p>
      </div>

      <div className="max-w-md mx-auto px-5 pb-24 -mt-2">
        {/* Native install button for Android / desktop with prompt */}
        {deferredPrompt && (
          <Button
            onClick={handleNativeInstall}
            className="w-full mb-6 h-14 text-base gap-3 bg-primary text-primary-foreground shadow-lg"
          >
            <Download className="h-5 w-5" />
            Install Now
          </Button>
        )}

        {/* iOS Safari instructions */}
        {platform === "ios-safari" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">How to install on iPhone</h2>

            <StepCard
              step={1}
              icon={<Share className="h-5 w-5 text-primary" />}
              title="Tap the Share button"
              description='Look for the share icon at the bottom of Safari (square with an arrow pointing up).'
            />
            <StepCard
              step={2}
              icon={<Plus className="h-5 w-5 text-primary" />}
              title='"Add to Home Screen"'
              description="Scroll down in the share menu and tap "Add to Home Screen"."
            />
            <StepCard
              step={3}
              icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
              title='Tap "Add"'
              description="Confirm the name and tap Add in the top-right corner. That's it!"
            />

            {/* Visual hint */}
            <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <ArrowUp className="h-4 w-4 animate-bounce" />
              <span>The share button is at the bottom of your screen</span>
            </div>
          </div>
        )}

        {/* iOS but not Safari */}
        {platform === "ios-other" && (
          <div className="space-y-4">
            <Card className="p-5 border-primary/30 bg-primary/5">
              <h2 className="text-base font-semibold text-foreground mb-2">Open in Safari to install</h2>
              <p className="text-sm text-muted-foreground mb-3">
                On iPhone, apps can only be installed from <strong>Safari</strong>. Copy the link below and open it in Safari.
              </p>
              <div className="flex items-center gap-2 bg-muted rounded-lg p-3">
                <code className="text-xs flex-1 truncate text-foreground">belly-chow.lovable.app/install</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText("https://belly-chow.lovable.app/install");
                  }}
                >
                  Copy
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Android without native prompt */}
        {platform === "android" && !deferredPrompt && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">How to install on Android</h2>
            <StepCard
              step={1}
              icon={<Smartphone className="h-5 w-5 text-primary" />}
              title="Open browser menu"
              description='Tap the three-dot menu (⋮) in the top-right corner of Chrome.'
            />
            <StepCard
              step={2}
              icon={<Download className="h-5 w-5 text-primary" />}
              title='"Install app" or "Add to Home screen"'
              description="Select the install option from the menu."
            />
            <StepCard
              step={3}
              icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
              title="Confirm installation"
              description="Tap Install and the app will appear on your home screen."
            />
          </div>
        )}

        {/* Desktop */}
        {platform === "desktop" && !deferredPrompt && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">How to install on Desktop</h2>
            <StepCard
              step={1}
              icon={<Monitor className="h-5 w-5 text-primary" />}
              title="Look for the install icon"
              description="In Chrome, look for the install icon (⊕) in the address bar on the right side."
            />
            <StepCard
              step={2}
              icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
              title='Click "Install"'
              description="Click Install in the popup to add Belly-Chow to your desktop."
            />
          </div>
        )}

        {/* Benefits */}
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Why install?</h3>
          <div className="grid grid-cols-1 gap-3">
            {[
              { emoji: "⚡", text: "Loads instantly, even offline" },
              { emoji: "🔔", text: "Get order update notifications" },
              { emoji: "📱", text: "Full-screen app experience" },
              { emoji: "🏠", text: "One tap from your home screen" },
            ].map((b) => (
              <div key={b.text} className="flex items-center gap-3 text-sm text-foreground">
                <span className="text-lg">{b.emoji}</span>
                {b.text}
              </div>
            ))}
          </div>
        </div>

        <Button
          variant="ghost"
          className="w-full mt-8 text-muted-foreground"
          onClick={() => navigate("/dashboard")}
        >
          Skip for now <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function StepCard({ step, icon, title, description }: { step: number; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="flex items-start gap-4 p-4 border-border/50">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
        {step}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="font-semibold text-foreground text-sm">{title}</span>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Card>
  );
}
