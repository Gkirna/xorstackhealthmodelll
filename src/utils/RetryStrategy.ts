/**
 * Production-Grade Retry Strategy with Exponential Backoff
 * 
 * For critical medical transcription operations that must succeed
 */

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number; // Random jitter to avoid thundering herd
  retryableErrors?: string[]; // Only retry these errors
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.2,
  retryableErrors: [
    'Rate limit',
    'temporarily unavailable',
    'timeout',
    'network error',
    '429',
    '500',
    '502',
    '503',
    '504'
  ]
};

export class RetryStrategy {
  private config: RetryConfig;
  private attemptCount: number = 0;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute operation with exponential backoff retry
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string = 'operation'
  ): Promise<T> {
    this.attemptCount = 0;

    while (true) {
      try {
        const result = await operation();
        
        // Log success if retries were needed
        if (this.attemptCount > 0) {
          console.log(`[Retry] ${context} succeeded after ${this.attemptCount} retries`);
        }
        
        return result;

      } catch (error: any) {
        this.attemptCount++;

        // Check if error is retryable
        const isRetryable = this.isErrorRetryable(error);
        
        // Check if we've exceeded max retries
        if (this.attemptCount >= this.config.maxRetries) {
          console.error(`[Retry] ${context} failed after ${this.attemptCount} attempts:`, error.message);
          throw new Error(`Operation failed after ${this.attemptCount} retries: ${error.message}`);
        }

        // Don't retry non-retryable errors
        if (!isRetryable) {
          console.error(`[Retry] ${context} non-retryable error:`, error.message);
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(this.attemptCount);
        
        console.log(`[Retry] ${context} attempt ${this.attemptCount}/${this.config.maxRetries} failed. Retrying in ${delay}ms...`, {
          error: error.message
        });

        await this.sleep(delay);
      }
    }
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateDelay(attempt: number): number {
    // Exponential backoff: initialDelay * (backoff ^ attempt)
    const exponentialDelay = this.config.initialDelayMs * 
      Math.pow(this.config.backoffMultiplier, attempt - 1);

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);

    // Add random jitter to avoid thundering herd problem
    const jitterRange = cappedDelay * this.config.jitterFactor;
    const jitter = (Math.random() * 2 - 1) * jitterRange;

    return Math.max(0, Math.floor(cappedDelay + jitter));
  }

  /**
   * Check if error is retryable
   */
  private isErrorRetryable(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorStatus = error.status?.toString() || '';

    return this.config.retryableErrors?.some(retryable => 
      errorMessage.includes(retryable.toLowerCase()) ||
      errorStatus.includes(retryable)
    ) ?? false;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current retry statistics
   */
  getStats() {
    return {
      attempts: this.attemptCount,
      maxRetries: this.config.maxRetries,
      remainingRetries: Math.max(0, this.config.maxRetries - this.attemptCount)
    };
  }

  /**
   * Reset attempt counter
   */
  reset() {
    this.attemptCount = 0;
  }
}

/**
 * Circuit Breaker Pattern for preventing cascading failures
 */
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private failureThreshold: number = 5,
    private resetTimeoutMs: number = 60000, // 1 minute
    private successThreshold: number = 2
  ) {}

  async execute<T>(operation: () => Promise<T>, context: string = 'operation'): Promise<T> {
    // Check circuit state
    if (this.state === 'open') {
      // Check if we should try again (half-open)
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        console.log(`[CircuitBreaker] ${context} entering half-open state`);
        this.state = 'half-open';
      } else {
        throw new Error(`Circuit breaker is open for ${context}. Try again later.`);
      }
    }

    try {
      const result = await operation();
      
      // Success in half-open state
      if (this.state === 'half-open') {
        this.failures = Math.max(0, this.failures - 1);
        if (this.failures === 0) {
          console.log(`[CircuitBreaker] ${context} closed after recovery`);
          this.state = 'closed';
        }
      }
      
      return result;

    } catch (error) {
      this.recordFailure(context);
      throw error;
    }
  }

  private recordFailure(context: string) {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold && this.state === 'closed') {
      console.error(`[CircuitBreaker] ${context} opened after ${this.failures} failures`);
      this.state = 'open';
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      threshold: this.failureThreshold
    };
  }

  reset() {
    this.failures = 0;
    this.state = 'closed';
    console.log('[CircuitBreaker] Manually reset');
  }
}