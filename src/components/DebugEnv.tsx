import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DebugEnv = () => {
    const publicKey = import.meta.env.VITE_KORAPAY_PUBLIC_KEY;
    const environment = import.meta.env.VITE_PAYMENT_ENVIRONMENT;

    return (
        <Card className="max-w-md mx-auto mb-4">
            <CardHeader>
                <CardTitle>Environment Debug</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                <div>
                    <strong>Public Key:</strong>
                    <p className="text-xs break-all bg-muted p-2 rounded">
                        {publicKey || 'NOT SET'}
                    </p>
                </div>
                <div>
                    <strong>Environment:</strong>
                    <p className="text-xs bg-muted p-2 rounded">
                        {environment || 'NOT SET'}
                    </p>
                </div>
                <div>
                    <strong>Key Length:</strong>
                    <p className="text-xs bg-muted p-2 rounded">
                        {publicKey ? publicKey.length : 0} characters
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};

export default DebugEnv;