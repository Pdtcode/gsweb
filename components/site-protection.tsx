'use client';

import { useState, useEffect } from 'react';
import WorkInProgress from './work-in-progress';

interface SiteProtectionProps {
  children: React.ReactNode;
}

export default function SiteProtection({ children }: SiteProtectionProps) {
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const access = localStorage.getItem('site-access');
    setHasAccess(access === 'granted');
    setIsLoading(false);
  }, []);

  // When the gate hands off to the real site, the tall content mounts in one
  // shot and iOS Safari/Chrome can land the page a little scrolled down (you
  // could nudge back up to the true top). Snap to the top once access is
  // granted — after the next frame so the layout has settled first.
  useEffect(() => {
    if (hasAccess && !isLoading) {
      requestAnimationFrame(() => window.scrollTo(0, 0));
    }
  }, [hasAccess, isLoading]);

  const handlePasswordCorrect = () => {
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