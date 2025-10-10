/**
 * Client-side rate limiting to prevent abuse
 * 
 * Tracks API calls and enforces limits before hitting the server
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const LIMITS: Record<string, RateLimitConfig> = {
  'ai-generation': { maxRequests: 10, windowMs: 60 * 1000 }, // 10 per minute
  'transcription': { maxRequests: 5, windowMs: 60 * 1000 }, // 5 per minute
  'export': { maxRequests: 3, windowMs: 60 * 1000 }, // 3 per minute
  'default': { maxRequests: 20, windowMs: 60 * 1000 }, // 20 per minute
};

interface RequestLog {
  timestamp: number;
  count: number;
}

const requestLogs = new Map<string, RequestLog[]>();

/**
 * Check if request is within rate limit
 */
export function checkRateLimit(key: string, type: keyof typeof LIMITS = 'default'): {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
} {
  const config = LIMITS[type];
  const now = Date.now();
  const windowStart = now - config.windowMs;

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

/**
 * Reset rate limit for a specific key
 */
export function resetRateLimit(key: string): void {
  requestLogs.delete(key);
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(key: string, type: keyof typeof LIMITS = 'default'): {
  remainingRequests: number;
  resetTime: number;
} {
  const config = LIMITS[type];
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const logs = requestLogs.get(key) || [];
  const validLogs = logs.filter(log => log.timestamp > windowStart);
  const requestCount = validLogs.reduce((sum, log) => sum + log.count, 0);

  return {
    remainingRequests: Math.max(0, config.maxRequests - requestCount),
    resetTime: validLogs.length > 0 
      ? validLogs[0].timestamp + config.windowMs 
      : now + config.windowMs,
  };
}
