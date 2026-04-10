
import type {Metadata} from 'next';
// Self-hosted Inter font - eliminates Google Fonts API calls and timeout warnings
import '@fontsource/inter/400.css'; // Regular
import '@fontsource/inter/500.css'; // Medium
import '@fontsource/inter/600.css'; // SemiBold
import '@fontsource/inter/700.css'; // Bold
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/providers/theme-provider"
import NextTopLoader from 'nextjs-toploader';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";

export const metadata: Metadata = {
  title: {
    template: '%s | GrainFlow',
    default: 'GrainFlow - Smart Warehouse Management'
  },
  description: 'Professional agricultural warehouse management system for inventory, billing, and rent tracking.',
  keywords: ['warehouse', 'agriculture', 'inventory', 'billing', 'rent', 'management', 'saas'],
};

export const viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevents zooming on inputs, common for "app-like" feel
};

import { OfflineIndicator } from '@/components/shared/offline-indicator';
import { AnalyticsProvider } from '@/components/shared/analytics-provider';
import { LoadingProvider } from '@/components/providers/loading-provider';
import { QueryProvider } from '@/providers/query-provider';

import { Suspense } from 'react';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans font-body antialiased bg-background">
        <ThemeProvider>
          <QueryProvider>
            <NextTopLoader color="#1DA1F2" showSpinner={false} height={3} />
            <LoadingProvider>
              {children}
              <Toaster />
              <SpeedInsights />
              <Analytics />
              <Suspense fallback={null}>
                <AnalyticsProvider />
              </Suspense>
              <KeyboardShortcuts />
              <OfflineIndicator />
            </LoadingProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
