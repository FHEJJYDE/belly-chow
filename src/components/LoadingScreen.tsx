import logo from '@/assets/belly_chow_logo.png';

const LoadingScreen = () => {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="relative">
                    <img
                        src={logo}
                        alt="Belly-Chow"
                        className="h-16 w-16 rounded-lg object-contain animate-pulse"
                    />
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <h2 className="font-heading text-xl font-bold tracking-tight">Belly-Chow</h2>
                    <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="h-2 w-2 rounded-full bg-primary animate-bounce"></div>
                    </div>
                    <p className="text-sm text-muted-foreground">Loading your experience...</p>
                </div>
            </div>
        </div>
    );
};

export default LoadingScreen;