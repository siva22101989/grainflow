'use client';

import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { completeOnboardingTour } from '@/lib/user-actions';

interface OnboardingTourProps {
    tourCompleted?: boolean;
}

export function OnboardingTour({ tourCompleted }: OnboardingTourProps) {
    useEffect(() => {
        if (tourCompleted) return;

        const driverObj = driver({
            showProgress: true,
            animate: true,
            nextBtnText: 'Next',
            prevBtnText: 'Previous',
            onDestroyed: async () => {
                // Mark tour as complete when finished or skipped
                await completeOnboardingTour();
            },
            steps: [
                {
                    popover: {
                        title: 'Welcome to GrainFlow! 🌾',
                        description: 'Let us take you on a quick tour of your new warehouse management system.',
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '#tour-dashboard-stats',
                    popover: {
                        title: 'Quick Stats',
                        description: 'See your total stock, active records, and occupancy at a glance.',
                        side: 'bottom',
                        align: 'start'
                    }
                },
                {
                    element: '#tour-inflow-action',
                    popover: {
                        title: 'New Inflow',
                        description: 'Click here to record new stock arriving at your warehouse.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                     element: '#tour-storage-nav',
                     popover: {
                         title: 'Storage Records',
                         description: 'Manage all your active inventory lots and records here.',
                         side: 'right',
                         align: 'start'
                     }
                },
                {
                    element: '#tour-nav-billing',
                    popover: {
                        title: 'Billing & Subscriptions',
                        description: 'Track your plan usage and subscription status.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                     popover: {
                         title: 'You are all set! 🚀',
                         description: 'Start managing your warehouse like a pro. Need help? Check the Settings tab.',
                         side: 'bottom',
                         align: 'start'
                     }
                }
            ]
        });

        // Small delay to ensure DOM is ready
        const timer = setTimeout(() => {
            driverObj.drive();
        }, 1500);

        return () => clearTimeout(timer);
    }, [tourCompleted]);

    return null; // This component renders nothing itself
}
