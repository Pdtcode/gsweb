'use client';

import { useState, useEffect } from 'react';
import WorkInProgress from './work-in-progress';

const ACCESS_STORAGE_KEY = 'site-access';

interface SiteProtectionProps {
  children: React.ReactNode;
  /** Whether the password gate is on (set in Sanity Studio → Site Password) */
  enabled: boolean;
  /**
   * What a visitor must have stored to get in. Derived from the current
   * password, so changing the password in Sanity signs everyone out.
   */
  // Not `accessKey`: that is a reserved HTML attribute and fails the a11y lint
  requiredKey: string | null;
}

export default function SiteProtection({ children, enabled, requiredKey }: SiteProtectionProps) {
  const [hasAccess, setHasAccess] = useState(!enabled);
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setHasAccess(true);
      setIsLoading(false);
      return;
    }

    let stored: string | null = null;
    try {
      stored = localStorage.getItem(ACCESS_STORAGE_KEY);
    } catch {
      // Storage blocked (private mode etc.) — just ask for the password
    }
    setHasAccess(!!requiredKey && stored === requiredKey);
    setIsLoading(false);
  }, [enabled, requiredKey]);

  // When the gate hands off to the real site, the tall content mounts in one
  // shot and iOS Safari/Chrome can land the page a little scrolled down (you
  // could nudge back up to the true top). Snap to the top once access is
  // granted — after the next frame so the layout has settled first.
  useEffect(() => {
    if (hasAccess && !isLoading) {
      requestAnimationFrame(() => window.scrollTo(0, 0));
    }
  }, [hasAccess, isLoading]);

  const handlePasswordCorrect = (grantedKey: string | null) => {
    if (grantedKey) {
      try {
        localStorage.setItem(ACCESS_STORAGE_KEY, grantedKey);
      } catch {
        // Access still lasts for this visit
      }
    }
    setHasAccess(true);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="fixed inset-0">
        <WorkInProgress onPasswordCorrect={handlePasswordCorrect} />
      </div>
    );
  }

  return <>{children}</>;
}