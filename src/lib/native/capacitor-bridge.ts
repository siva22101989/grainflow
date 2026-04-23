/**
 * Capacitor runtime bridge.
 *
 * The Next.js app runs in two environments:
 *   1. Browser (web) — no Capacitor, fall back to web APIs.
 *   2. Capacitor Android WebView — use native plugins.
 *
 * This module detects the environment and exposes ONE interface that
 * "just does the right thing" regardless of where the code is running.
 *
 * All Capacitor plugin imports are DYNAMIC (inside each function) so the
 * web bundle never pulls in native-only code at SSR or static-build time.
 */

/**
 * True when running inside the Capacitor Android app (not the browser).
 */
export function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  // Capacitor injects window.Capacitor at runtime when loaded inside the app
  return (
    (window as any).Capacitor?.isNativePlatform?.() === true ||
    (window as any).Capacitor?.platform === 'android' ||
    (window as any).Capacitor?.platform === 'ios'
  );
}

/**
 * Lightweight haptic feedback on native; no-op on web.
 */
export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const map = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    } as const;
    await Haptics.impact({ style: map[style] });
  } catch {
    // Plugin unavailable — silent
  }
}

/**
 * Share text / URL / file via the platform share sheet.
 *
 * Native: Android share sheet (WhatsApp, Gmail, Drive, Messages).
 * Web (with navigator.share): browser share sheet.
 * Web (without): copy-to-clipboard fallback.
 */
export async function shareNative(opts: {
  title?: string;
  text?: string;
  url?: string;
  /** Local file path (native only, e.g., from Filesystem plugin) */
  files?: string[];
}): Promise<{ ok: boolean; method: 'native' | 'web' | 'clipboard'; error?: string }> {
  if (isNative()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: opts.title,
        text: opts.text,
        url: opts.url,
        files: opts.files,
        dialogTitle: opts.title,
      });
      return { ok: true, method: 'native' };
    } catch (e: any) {
      // User dismissed the share sheet — not an error
      if (e?.message?.toLowerCase?.()?.includes('canceled')) {
        return { ok: false, method: 'native', error: 'canceled' };
      }
      return { ok: false, method: 'native', error: e?.message || 'share failed' };
    }
  }

  // Web fallbacks
  if (typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
    try {
      await (navigator as any).share({ title: opts.title, text: opts.text, url: opts.url });
      return { ok: true, method: 'web' };
    } catch (e: any) {
      // AbortError = user canceled
      if (e?.name === 'AbortError') return { ok: false, method: 'web', error: 'canceled' };
      // Fall through to clipboard below
    }
  }

  // Last resort: copy to clipboard
  const payload = [opts.title, opts.text, opts.url].filter(Boolean).join('\n');
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(payload);
      return { ok: true, method: 'clipboard' };
    }
  } catch {
    // Give up
  }
  return { ok: false, method: 'clipboard', error: 'no share mechanism available' };
}

/**
 * Open an external URL.
 *
 * Native: Chrome Custom Tabs via @capacitor/browser (stays in-app but
 *         visually separate, has its own URL bar + controls).
 * Web: window.open new tab.
 */
export async function openExternalLink(url: string) {
  if (isNative()) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
      return;
    } catch {
      // fall through to window.open below
    }
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Save a PDF (or any binary) to the device's Downloads folder and
 * optionally share it. Returns the file URI so the caller can pass it
 * to shareNative({ files: [uri] }).
 *
 * Native: @capacitor/filesystem writes to Directory.Documents
 *         (Android: /storage/emulated/0/Documents/GrainFlow/).
 * Web: triggers a standard browser download.
 */
export async function savePDFNative(params: {
  filename: string;
  /** Either a data-URL ("data:application/pdf;base64,...") or raw base64 string. */
  base64: string;
  mimeType?: string;
}): Promise<{ ok: boolean; uri?: string; error?: string }> {
  const { filename, base64, mimeType = 'application/pdf' } = params;
  const cleanBase64 = base64.startsWith('data:') ? base64.split(',')[1] || '' : base64;

  if (isNative()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const path = `GrainFlow/${filename}`;
      const result = await Filesystem.writeFile({
        path,
        data: cleanBase64,
        directory: Directory.Documents,
        recursive: true,
      });
      return { ok: true, uri: result.uri };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'write failed' };
    }
  }

  // Web: trigger a regular download
  try {
    const byteChars = atob(cleanBase64);
    const byteNumbers = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteNumbers], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'download failed' };
  }
}

/**
 * Scan a QR / barcode with the device camera.
 *
 * Native: ML Kit barcode scanning (fast, hardware-accelerated,
 *         works in low light). Returns the first scanned code.
 * Web: caller must fall back to the existing react-qr-reader UI;
 *      this function returns { ok: false, fallback: 'web' }.
 */
export async function scanBarcodeNative(): Promise<{
  ok: boolean;
  value?: string;
  format?: string;
  fallback?: 'web';
  error?: string;
}> {
  if (!isNative()) {
    return { ok: false, fallback: 'web' };
  }
  try {
    const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');

    // Check camera permission
    const perm = await BarcodeScanner.checkPermissions();
    if (perm.camera !== 'granted') {
      const req = await BarcodeScanner.requestPermissions();
      if (req.camera !== 'granted') {
        return { ok: false, error: 'Camera permission denied' };
      }
    }

    const result = await BarcodeScanner.scan({
      formats: [BarcodeFormat.QrCode, BarcodeFormat.Code128, BarcodeFormat.Code39, BarcodeFormat.Ean13],
    });

    const first = result.barcodes?.[0];
    if (!first) return { ok: false, error: 'No code scanned' };
    return { ok: true, value: first.rawValue, format: first.format };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'scan failed' };
  }
}

/**
 * Exit the app. Native only; no-op on web.
 */
export async function exitApp() {
  if (!isNative()) return;
  try {
    const { App } = await import('@capacitor/app');
    await App.exitApp();
  } catch {
    // ignore
  }
}
