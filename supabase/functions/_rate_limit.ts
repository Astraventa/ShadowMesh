// Rate limiting utility for edge functions
// Usage: import { checkRateLimit } from './_rate_limit.ts';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  identifier: string; // IP, email, user ID, etc.
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(config: RateLimitConfig): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const key = `${config.identifier}:${Math.floor(now / config.windowMs)}`;
  const limit = rateLimitStore.get(key);

  if (!limit || now > limit.resetAt) {
    rateLimitStore.set(key, { 
      count: 1, 
      resetAt: now + config.windowMs 
    });
    return { 
      allowed: true, 
      remaining: config.maxRequests - 1, 
      resetAt: now + config.windowMs 
    };
  }

  if (limit.count >= config.maxRequests) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetAt: limit.resetAt 
    };
  }

  limit.count++;
  return { 
    allowed: true, 
    remaining: config.maxRequests - limit.count, 
    resetAt: limit.resetAt 
  };
}

// Clean up old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 300000); // 5 minutes

