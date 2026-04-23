'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isNative, exitApp, hapticImpact } from '@/lib/native/capacitor-bridge';
import { useToast } from '@/hooks/use-toast';

/**
 * Handles the Android hardware back button when running inside the
 * Capacitor app.
 *
 * Behavior:
 *   1. If an open [data-radix-popper-content-wrapper] dialog / sheet /
 *      popover is on screen → close the topmost one (ESC keypress).
 *   2. Else, if we're not at the root → router.back().
 *   3. Else (at root) → first press shows "Press back again to exit"
 *      toast; second press within 2 seconds exits the app.
 *
 * On web: mounts but registers no listener.
 */
export function CapacitorBackHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const lastBackPressRef = useRef<number>(0);

  useEffect(() => {
    if (!isNative()) return;

    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const handle = await App.addListener('backButton', ({ canGoBack }) => {
          // 1. Close an open Radix dialog / sheet / popover if there is one.
          // Radix tracks open state via data-state="open" on its content.
          const openOverlay = document.querySelector(
            '[data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"], [data-state="open"][data-radix-popper-content-wrapper]'
          );
          if (openOverlay) {
            // Simulate ESC which Radix handles natively
            document.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })
            );
            hapticImpact('light');
            return;
          }

          // 2. Non-root — go back
          const isAtRoot =
            pathname === '/' || pathname === '/dashboard' || pathname === '/login';
          if (!isAtRoot && canGoBack) {
            router.back();
            hapticImpact('light');
            return;
          }

          // 3. Root — double-press to exit
          const now = Date.now();
          if (now - lastBackPressRef.current < 2000) {
            exitApp();
          } else {
            lastBackPressRef.current = now;
            toast({ description: 'Press back again to exit.' });
            hapticImpact('medium');
          }
        });

        cleanup = () => {
          handle.remove();
        };
      } catch {
        // Capacitor App plugin unavailable — should not happen in native build
      }
    })();

    return () => {
      cleanup?.();
    };
  }, [router, pathname, toast]);

  return null;
}
