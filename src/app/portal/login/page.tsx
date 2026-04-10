'use client';

import { useActionState } from 'react';
import { sendPortalLoginLink } from '@/lib/portal-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

const initialState = {
    message: '',
    success: false,
};

export default function PortalLoginPage() {
    const [state, formAction, isPending] = useActionState(sendPortalLoginLink, initialState);
    const [sent, setSent] = useState(false);

    // If success, just show success state locally to avoid hydration issues with server state
    if (state.success && !sent) {
        setSent(true);
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
             <div className="absolute top-4 left-4">
                <Link href="/" className="inline-flex items-center text-sm text-slate-500 hover:text-blue-600 transition-colors">
                    <ArrowLeft className="mr-1 h-4 w-4" /> Back Home
                </Link>
            </div>

            <Card className="w-full max-w-md shadow-lg border-border/50">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight">Customer Portal</CardTitle>
                    <CardDescription>
                        Enter your registered email to access your storage records.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!sent ? (
                        <form action={formAction} className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="phone" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Mobile Number
                                </label>
                                <div className="flex gap-2">
                                    <div className="flex h-11 w-16 items-center justify-center rounded-md border border-input bg-muted text-sm text-muted-foreground">
                                        +91
                                    </div>
                                    <Input 
                                        type="tel" 
                                        name="phone" 
                                        id="phone"
                                        placeholder="98765 43210" 
                                        required 
                                        className="h-11 flex-1 font-mono text-base"
                                        pattern="[0-9]{10}"
                                        title="Please enter a valid 10-digit mobile number"
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    Enter your 10-digit mobile number linked to your account.
                                </p>
                            </div>
                            
                            {state.message && !state.success && (
                                <div className="text-sm text-red-500 font-medium px-1">
                                    {state.message}
                                </div>
                            )}

                            <Button type="submit" className="w-full h-11" disabled={isPending}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending OTP...
                                    </>
                                ) : (
                                    <>
                                        Get Login OTP <Send className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </form>
                    ) : (
                        <div className="flex flex-col items-center space-y-4 py-4 text-center animate-in fade-in zoom-in duration-300">
                            <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                <Send className="h-6 w-6 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-semibold text-xl">Check your email</h3>
                                <p className="text-muted-foreground text-sm">
                                    We sent a magic link to your inbox.<br/>
                                    Click it to sign in instantly.
                                </p>
                            </div>
                            <Button variant="outline" onClick={() => setSent(false)} className="mt-4">
                                Use different email
                            </Button>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="justify-center border-t bg-muted/10 py-4">
                    <p className="text-xs text-muted-foreground text-center">
                        Secure passwordless access. <br/>
                        Protected by GrainFlow Security.
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
