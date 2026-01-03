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