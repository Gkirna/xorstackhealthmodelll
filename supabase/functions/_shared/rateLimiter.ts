/**
 * Server-side rate limiting middleware for edge functions
 * Tracks requests per user and enforces limits
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const LIMITS: Record<string, RateLimitConfig> = {
  'ai-generation': { maxRequests: 20, windowMs: 60 * 1000 }, // 20 per minute
  'transcription': { maxRequests: 10, windowMs: 60 * 1000 }, // 10 per minute
  'export': { maxRequests: 5, windowMs: 60 * 1000 }, // 5 per minute
  'default': { maxRequests: 30, windowMs: 60 * 1000 }, // 30 per minute
};

// In-memory store (would use Redis in production)
const requestLogs = new Map<string, { timestamp: number; count: number }[]>();

export function checkRateLimit(
  userId: string, 
  limitType: keyof typeof LIMITS = 'default'
): {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
} {
  const config = LIMITS[limitType];
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const key = `${userId}:${limitType}`;

  // Get or create log for this key
  let logs = requestLogs.get(key) || [];
  
  // Remove expired entries
  logs = logs.filter(log => log.timestamp > windowStart);

  // Count requests in current window
  const requestCount = logs.reduce((sum, log) => sum + log.count, 0);

  const allowed = requestCount < config.maxRequests;
  const remainingRequests = Math.max(0, config.maxRequests - requestCount);
  const resetTime = logs.length > 0 
    ? logs[0].timestamp + config.windowMs 
    : now + config.windowMs;

  if (allowed) {
    // Add new request to log
    logs.push({ timestamp: now, count: 1 });
    requestLogs.set(key, logs);
  }

  return {
    allowed,
    remainingRequests,
    resetTime,
  };
}

export function getRateLimitHeaders(
  remainingRequests: number,
  resetTime: number
): Record<string, string> {
  return {
    'X-RateLimit-Remaining': remainingRequests.toString(),
    'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
  };
}
