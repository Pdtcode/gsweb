'use client';

import { useState } from 'react';
import { Button } from '@heroui/button';
import { Input } from '@heroui/input';
import Image from 'next/image';
import { color } from 'framer-motion';

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
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="max-w-md w-full mx-auto p-8">
        <div className="text-center mb-8">
          {/* Crash Dummy Splash Image */}
          <div className="mb-6 flex justify-center">
            <Image
              src="/Try again crash dummy.jpg"
              alt="Try Again Crash Dummy"
              width={200}
              height={200}
              className="rounded-lg"
              priority
            />
          </div>

          <h1 className="text-xl font-bold text-gray-400 mb-4">
            Please enter the password to continue
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full text-black"
            classNames={{
              input: "!bg-white !text-black",
              inputWrapper: "!bg-white !text-black"
            }}
            style={{
              backgroundColor: 'white'
            }}
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

        <div className="text-center mt-8 text-gray-400 text-sm">
          Contact us for access if you&apos;re an authorized user.
        </div>
      </div>
    </div>
  );
}