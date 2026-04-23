'use client';

import { useState } from 'react';
import { QrReader } from 'react-qr-reader';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, X, CheckCircle2 } from 'lucide-react';
import { isNative, scanBarcodeNative, hapticImpact } from '@/lib/native/capacitor-bridge';

export function QRScanner() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Route a scanned value to the storage page
  const routeToRecord = (value: string) => {
    setResult(value);
    setScanning(false);
    hapticImpact('medium');
    setTimeout(() => {
      router.push(`/storage?search=${encodeURIComponent(value)}`);
    }, 800);
  };

  const handleScan = (result: any) => {
    if (result) {
      const scannedValue = result?.text || result;
      routeToRecord(scannedValue);
    }
  };

  // Inside the Capacitor app, open the ML Kit native scanner instead of
  // the web camera preview — much faster, works better in low light.
  const startScan = async () => {
    setScanError(null);
    if (isNative()) {
      const res = await scanBarcodeNative();
      if (res.ok && res.value) {
        routeToRecord(res.value);
      } else if (res.error && res.error !== 'canceled' && res.error !== 'No code scanned') {
        setScanError(res.error);
      }
      return;
    }
    setScanning(true);
  };


  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Scan QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!scanning && !result && (
            <div className="text-center py-8">
              <Camera className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Point your camera at a storage record QR code
              </p>
              <Button onClick={startScan}>
                <Camera className="h-4 w-4 mr-2" />
                Start Scanning
              </Button>
              {scanError && (
                <Alert className="mt-4 text-left">
                  <AlertDescription>{scanError}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {scanning && (
            <div className="relative">
              <div className="rounded-lg overflow-hidden border-2 border-primary">
                <QrReader
                  onResult={handleScan}
                  constraints={{ facingMode: 'environment' }}
                  containerStyle={{ width: '100%' }}
                />
              </div>
              
              <div className="absolute top-4 right-4">
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => setScanning(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Align QR code within the frame
                </p>
              </div>
            </div>
          )}

          {result && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>Scanned:</strong> {result}
                <br />
                <span className="text-sm text-muted-foreground">
                  Redirecting to record...
                </span>
              </AlertDescription>
            </Alert>
          )}


          {!scanning && result && (
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null);
                }}
              >
                Scan Another
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">How to Use</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Click "Start Scanning" to activate your camera</li>
            <li>Point your camera at the QR code on a storage record receipt</li>
            <li>Hold steady until the code is recognized</li>
            <li>You'll be automatically redirected to the record details</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
