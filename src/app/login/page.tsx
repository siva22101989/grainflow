'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/layout/logo';
import { createClient } from '@/utils/supabase/client';
import { Eye, EyeOff } from 'lucide-react';
import { getFriendlyErrorMessage } from '@/lib/error-utils';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    
    // Check if input looks like a mobile number (10 digits)
    let loginEmail = email.trim();
    const isMobile = /^\d{10}$/.test(loginEmail);
    
    if (isMobile) {
        loginEmail = `${loginEmail}@rentapp.local`;

    }

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (error) {
      setError(getFriendlyErrorMessage(error));
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-blue-500/5" />
        
        {/* Animated glow orbs (same as landing page) */}
        <div className="absolute top-0 -left-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 -right-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1000ms' }} />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        
        <div className="absolute top-8 left-8 z-10">
            <Logo href="/" />
        </div>
        <Card className="w-full max-w-sm z-10 shadow-2xl border-muted/60 backdrop-blur-sm bg-background/95">
        <CardHeader>
            <CardTitle className="text-2xl">Login</CardTitle>
            <CardDescription>
            Enter your email or mobile number to log in.
            </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
            <form onSubmit={handleLogin} className="grid gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="email">Email or Mobile Number</Label>
                    <Input
                    id="email"
                    name="email"
                    type="text"
                    placeholder="Mobile Number or Email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    />
                </div>
                <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <Link 
                            href="/forgot-password" 
                            className="text-xs text-muted-foreground underline hover:text-primary transition-colors"
                        >
                            Forgot password?
                        </Link>
                    </div>
                    <div className="relative">
                        <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        className="pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                            tabIndex={-1}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                            ) : (
                                <Eye className="h-4 w-4" />
                            )}
                            <span className="sr-only">
                                {showPassword ? "Hide password" : "Show password"}
                            </span>
                        </button>
                    </div>
                </div>
                 {error && (
                    <div className="text-sm font-medium text-destructive">{error}</div>
                )}
                <Button type="submit" className="w-full" isLoading={loading}>
                    Login
                </Button>
            </form>
            <div className="mt-4 text-center text-sm">
                <span className="text-muted-foreground">Don&apos;t have an account? </span>
                <Link href="/signup" className="underline text-primary hover:text-primary/80 font-medium">
                    Sign up
                </Link>
            </div>
        </CardContent>
        </Card>
    </div>
  );
}
