// Simple in-memory rate limiter (for production, use Redis or a database)
interface RateLimitAttempt {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
}

interface BruteForceAttempt {
  attempts: number;
  lastAttempt: number;
  blockedUntil?: number;
}

class RateLimiter {
  private attempts: Map<string, RateLimitAttempt> = new Map();
  private bruteForceAttempts: Map<string, BruteForceAttempt> = new Map();

  // Rate limiting: max attempts per window
  isRateLimited(
    identifier: string,
    maxAttempts: number = 5,
    windowMs: number = 60000 // 1 minute
  ): { limited: boolean; resetTime?: number; remainingAttempts?: number } {
    const now = Date.now();
    const attempt = this.attempts.get(identifier);

    if (!attempt) {
      this.attempts.set(identifier, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now
      });
      return { limited: false, remainingAttempts: maxAttempts - 1 };
    }

    // Reset window if enough time has passed
    if (now - attempt.firstAttempt > windowMs) {
      this.attempts.set(identifier, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now
      });
      return { limited: false, remainingAttempts: maxAttempts - 1 };
    }

    // Increment attempt count
    attempt.count++;
    attempt.lastAttempt = now;

    if (attempt.count > maxAttempts) {
      const resetTime = attempt.firstAttempt + windowMs;
      return {
        limited: true,
        resetTime,
        remainingAttempts: 0
      };
    }

    return {
      limited: false,
      remainingAttempts: maxAttempts - attempt.count
    };
  }

  // Brute force protection: progressive blocking
  checkBruteForce(
    identifier: string,
    isSuccessful: boolean = false
  ): { blocked: boolean; blockedUntil?: number; attempts?: number } {
    const now = Date.now();
    const bruteForce = this.bruteForceAttempts.get(identifier);

    if (!bruteForce) {
      if (!isSuccessful) {
        this.bruteForceAttempts.set(identifier, {
          attempts: 1,
          lastAttempt: now
        });
      }
      return { blocked: false };
    }

    // Check if currently blocked
    if (bruteForce.blockedUntil && now < bruteForce.blockedUntil) {
      return {
        blocked: true,
        blockedUntil: bruteForce.blockedUntil,
        attempts: bruteForce.attempts
      };
    }

    if (isSuccessful) {
      // Reset on successful attempt
      this.bruteForceAttempts.delete(identifier);
      return { blocked: false };
    }

    // Failed attempt
    bruteForce.attempts++;
    bruteForce.lastAttempt = now;

    // Progressive blocking: 1min, 5min, 15min, 1hour, 24hours
    const blockDurations = [
      60000,      // 1 minute
      300000,     // 5 minutes
      900000,     // 15 minutes
      3600000,    // 1 hour
      86400000    // 24 hours
    ];

    const blockIndex = Math.min(bruteForce.attempts - 10, blockDurations.length - 1);

    if (bruteForce.attempts >= 10) {
      bruteForce.blockedUntil = now + blockDurations[blockIndex];
      return {
        blocked: true,
        blockedUntil: bruteForce.blockedUntil,
        attempts: bruteForce.attempts
      };
    }

    return { blocked: false, attempts: bruteForce.attempts };
  }

  // Clean up old entries periodically
  cleanup(): void {
    const now = Date.now();
    const maxAge = 86400000; // 24 hours

    // Clean rate limit attempts
    this.attempts.forEach((attempt, key) => {
      if (now - attempt.lastAttempt > maxAge) {
        this.attempts.delete(key);
      }
    });

    // Clean brute force attempts
    this.bruteForceAttempts.forEach((bruteForce, key) => {
      if (bruteForce.blockedUntil && now > bruteForce.blockedUntil + maxAge) {
        this.bruteForceAttempts.delete(key);
      } else if (!bruteForce.blockedUntil && now - bruteForce.lastAttempt > maxAge) {
        this.bruteForceAttempts.delete(key);
      }
    });
  }
}

// Global instance
const rateLimiter = new RateLimiter();

// Clean up every hour
setInterval(() => rateLimiter.cleanup(), 3600000);

export { rateLimiter };

// Utility functions
export function getRealIP(req: Request): string {
  // Get real IP from various headers (for proxies, load balancers, etc.)
  const forwarded = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  const clientIP = req.headers.get('x-client-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return realIP || clientIP || 'unknown';
}

export function createSecureIdentifier(ip: string, userAgent?: string): string {
  // Create a more secure identifier that's harder to bypass
  const baseId = ip;
  if (userAgent) {
    // Use parts of user agent but not the full string (to avoid easy spoofing)
    const uaParts = userAgent.split(' ').slice(0, 2).join(' ');
    return `${baseId}:${Buffer.from(uaParts).toString('base64').substring(0, 10)}`;
  }
  return baseId;
}

export function validatePromoCodeFormat(code: string): boolean {
  // Basic format validation
  if (!code || typeof code !== 'string') return false;

  // Must be 3-20 characters, alphanumeric only
  if (!/^[A-Z0-9]{3,20}$/.test(code.toUpperCase())) return false;

  // Prevent common exploitation attempts
  const suspiciousPatterns = [
    /script/i,
    /select/i,
    /union/i,
    /insert/i,
    /delete/i,
    /drop/i,
    /<.*>/,
    /javascript:/i
  ];

  return !suspiciousPatterns.some(pattern => pattern.test(code));
}