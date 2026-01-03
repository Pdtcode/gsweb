'use client';

import { useState } from 'react';
import { Button } from '@heroui/button';
import { Input } from '@heroui/input';

interface WorkInProgressProps {
  onPasswordCorrect: () => void;
}

export default function WorkInProgress({ onPasswordCorrect }: WorkInProgressProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('site-access', 'granted');
        onPasswordCorrect();
      } else {
        setError(data.error || 'Incorrect password');
        setPassword('');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
      setPassword('');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            🚧 Work in Progress
          </h1>
          <p className="text-foreground/70 text-lg">
            This website is currently under construction. Please enter the password to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full"
            size="lg"
          />

          {error && (
            <p className="text-danger text-sm text-center">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            color="primary"
            size="lg"
            isLoading={isLoading}
          >
            Access Site
          </Button>
        </form>

        <div className="text-center mt-8 text-foreground/50 text-sm">
          Contact us for access if you&apos;re an authorized user.
        </div>
      </div>
    </div>
  );
}