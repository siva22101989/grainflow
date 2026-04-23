'use client';

import { Button } from '@/components/ui/button';
import { Share2, Check } from 'lucide-react';
import { useState } from 'react';
import { getShareableFilterUrl } from '@/lib/url-filters';
import { shareNative } from '@/lib/native/capacitor-bridge';

interface ShareFilterButtonProps {
  filters: any;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

/**
 * Button to share current filtered view via URL
 * Uses native share API on mobile, clipboard on desktop
 */
export function ShareFilterButton({ 
  filters, 
  variant = 'outline', 
  size = 'sm',
  showLabel = true 
}: ShareFilterButtonProps) {
  const [copied, setCopied] = useState(false);
  
  const handleShare = async () => {
    const url = getShareableFilterUrl(filters);

    // shareNative handles all three paths:
    //  1. Capacitor native share sheet (Android app)
    //  2. navigator.share (mobile browser)
    //  3. clipboard fallback (desktop browser, older phones)
    const result = await shareNative({
      title: 'Filtered View',
      text: 'Check out this filtered view',
      url,
    });

    if (result.method === 'clipboard' && result.ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else if (!result.ok && result.error !== 'canceled') {
      console.error('Share failed:', result.error);
    }
  };
  
  return (
    <Button variant={variant} size={size} onClick={handleShare} aria-label="Share filtered view">
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          {showLabel && size !== 'icon' && <span className="ml-2">Copied!</span>}
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          {showLabel && size !== 'icon' && <span className="ml-2">Share</span>}
        </>
      )}
    </Button>
  );
}
