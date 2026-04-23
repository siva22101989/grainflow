import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config for the GrainFlow Android app.
 *
 * The app loads the deployed Next.js web app remotely from Vercel.
 * That means every web deploy is instantly live in the installed APK —
 * no APK rebuild needed for code changes. Only native-layer changes
 * (plugins, icons, splash, FCM config) require a new APK build.
 */
const config: CapacitorConfig = {
  appId: 'com.grainflow.app',
  appName: 'GrainFlow',
  // webDir is a placeholder — required by Capacitor but unused since we
  // load remotely via server.url. 'public' is the only always-present
  // directory we can point at; nothing in it is bundled for native use.
  webDir: 'public',
  server: {
    url: 'https://grainflow.vercel.app',
    cleartext: false,
    androidScheme: 'https',
    // Domains the in-app WebView is allowed to navigate to without
    // kicking out to an external browser. Everything else (wa.me, tel:,
    // external links) should be opened via @capacitor/browser.
    allowNavigation: [
      'grainflow.vercel.app',
      '*.supabase.co',
      'wa.me',
      'api.textbee.dev',
      '*.sentry.io',
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      // Light icons on a dark status bar, matching the landing page aesthetic.
      style: 'LIGHT',
      backgroundColor: '#030712',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    buildOptions: {
      signingType: 'apksigner',
    },
  },
};

export default config;
