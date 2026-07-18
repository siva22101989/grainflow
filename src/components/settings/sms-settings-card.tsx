'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare, Save } from 'lucide-react';
import { getSMSSettings, updateSMSSettings } from '@/lib/sms-settings-actions';
import { useToast } from '@/hooks/use-toast';

export function SMSSettingsCard() {
    const [settings, setSettings] = useState({
        enable_sms: false,
        enable_payment_reminders: true,
        enable_inflow_welcome: false,
        enable_outflow_confirmation: false,
        enable_payment_confirmation: false,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const data = await getSMSSettings();
            if (data) {
                setSettings({
                    enable_sms: data.enable_sms ?? false,
                    enable_payment_reminders: data.enable_payment_reminders ?? true,
                    enable_inflow_welcome: data.enable_inflow_welcome ?? false,
                    enable_outflow_confirmation: data.enable_outflow_confirmation ?? false,
                    enable_payment_confirmation: data.enable_payment_confirmation ?? false,
                });
            }
        } catch (error) {
            console.error('Failed to load SMS settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await updateSMSSettings(settings);
            
            if (result.success) {
                toast({
                    title: 'Settings Saved',
                    description: 'SMS notification preferences updated successfully.',
                });
            } else {
                toast({
                    title: 'Error',
                    description: result.error || 'Failed to save settings',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to save settings. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        SMS Notifications
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    SMS Notifications
                </CardTitle>
                <CardDescription>
                    Control when SMS notifications are sent to customers via TextBee
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Master switch — turns ALL SMS on or off */}
                <div className={`flex items-center justify-between gap-4 rounded-lg border-2 p-4 shadow-sm ${settings.enable_sms ? 'border-primary/40 bg-primary/5' : 'border-destructive/30 bg-destructive/5'}`}>
                    <div className="space-y-0.5 flex-1">
                        <Label htmlFor="enable-sms" className="text-base font-semibold">
                            Enable SMS {settings.enable_sms ? '' : '(All SMS are OFF)'}
                        </Label>
                        <p className="text-sm text-muted-foreground mr-2">
                            Master switch. When off, no SMS is sent to customers from anywhere in the app, regardless of the options below.
                        </p>
                    </div>
                    <Switch
                        id="enable-sms"
                        className="shrink-0"
                        checked={settings.enable_sms}
                        onCheckedChange={(checked) =>
                            setSettings({ ...settings, enable_sms: checked })
                        }
                    />
                </div>

                <div className={`space-y-6 ${settings.enable_sms ? '' : 'opacity-50 pointer-events-none'}`}>
                {/* Payment Reminders */}
                <div className="flex items-center justify-between gap-4 rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5 flex-1">
                        <Label htmlFor="payment-reminders" className="text-base font-medium">
                            Payment Reminders
                        </Label>
                        <p className="text-sm text-muted-foreground mr-2">
                            Manual SMS when you click "Send Reminder" button
                        </p>
                    </div>
                    <Switch
                        id="payment-reminders"
                        className="shrink-0"
                        checked={settings.enable_payment_reminders}
                        onCheckedChange={(checked) =>
                            setSettings({ ...settings, enable_payment_reminders: checked })
                        }
                    />
                </div>

                {/* Inflow Welcome */}
                <div className="flex items-center justify-between gap-4 rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5 flex-1">
                        <Label htmlFor="inflow-welcome" className="text-base font-medium">
                            Inflow Welcome SMS
                        </Label>
                        <p className="text-sm text-muted-foreground mr-2">
                            Automatic SMS when new storage record is created
                        </p>
                    </div>
                    <Switch
                        id="inflow-welcome"
                        className="shrink-0"
                        checked={settings.enable_inflow_welcome}
                        onCheckedChange={(checked) =>
                            setSettings({ ...settings, enable_inflow_welcome: checked })
                        }
                    />
                </div>

                {/* Outflow Confirmation */}
                <div className="flex items-center justify-between gap-4 rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5 flex-1">
                        <Label htmlFor="outflow-confirmation" className="text-base font-medium">
                            Outflow Confirmation SMS
                        </Label>
                        <p className="text-sm text-muted-foreground mr-2">
                            Automatic SMS when withdrawal is processed
                        </p>
                    </div>
                    <Switch
                        id="outflow-confirmation"
                        className="shrink-0"
                        checked={settings.enable_outflow_confirmation}
                        onCheckedChange={(checked) =>
                            setSettings({ ...settings, enable_outflow_confirmation: checked })
                        }
                    />
                </div>

                {/* Payment Confirmation */}
                <div className="flex items-center justify-between gap-4 rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5 flex-1">
                        <Label htmlFor="payment-confirmation" className="text-base font-medium">
                            Payment Confirmation SMS
                        </Label>
                        <p className="text-sm text-muted-foreground mr-2">
                            Automatic SMS when payment is recorded
                        </p>
                    </div>
                    <Switch
                        id="payment-confirmation"
                        className="shrink-0"
                        checked={settings.enable_payment_confirmation}
                        onCheckedChange={(checked) =>
                            setSettings({ ...settings, enable_payment_confirmation: checked })
                        }
                    />
                </div>
                </div>

                {/* Save Button */}
                <div className="pt-4">
                    <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Save Settings
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
