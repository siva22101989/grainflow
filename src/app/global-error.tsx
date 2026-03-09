'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';


export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry.captureException(error);
    console.error('Global Error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="font-sans font-body">
        <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-background p-4 text-foreground">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="rounded-full bg-destructive/10 p-4">
              <AlertTriangle className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">System Critical Error</h1>
            <p className="text-muted-foreground w-full max-w-md">
              A critical system error occurred that prevents the application from rendering.
            </p>
          </div>
          
          <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
             <p className="mb-4 text-sm font-mono text-destructive bg-destructive/5 p-2 rounded">
               {error.message}
             </p>
             <Button onClick={() => reset()} className="w-full" size="lg">
              Reload Application
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}

