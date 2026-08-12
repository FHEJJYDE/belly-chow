import React from 'react';
import AppNavbar from '@/components/layout/AppNavbar';
import TestPayment from '@/components/TestPayment';
import KoraPayTest from '@/components/KoraPayTest';
import DebugEnv from '@/components/DebugEnv';

const TestPaymentPage = () => {
    return (
        <div className="min-h-screen bg-background">
            <AppNavbar />
            <div className="container mx-auto px-4 py-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-foreground mb-2">Payment System Test</h1>
                    <p className="text-muted-foreground">
                        Test the KoraPay integration and payment flow
                    </p>
                </div>

                <div className="space-y-8">
                    <DebugEnv />
                    <KoraPayTest />
                    <TestPayment />
                </div>
            </div>
        </div>
    );
};

export default TestPaymentPage;