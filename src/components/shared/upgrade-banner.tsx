'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UpgradeBannerProps {
    title?: string;
    description: string;
    type?: 'warning' | 'blocker';
}

export function UpgradeBanner({ title = "Upgrade Required", description, type = 'blocker' }: UpgradeBannerProps) {
    const router = useRouter();

    return (
        <Alert variant={type === 'blocker' ? 'destructive' : 'default'} className="mb-6">
            {type === 'blocker' ? <Lock className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mt-2">
                <span>{description}</span>
                <Button size="sm" variant={type === 'blocker' ? 'secondary' : 'default'} onClick={() => router.push('/upgrade')}>
                    View Plans
                </Button>
            </AlertDescription>
        </Alert>
    );
}
