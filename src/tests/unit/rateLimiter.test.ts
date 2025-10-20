import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock setInterval to prevent actual timer
vi.stubGlobal('setInterval', vi.fn());

describe('UrlRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow adding a new URL', async () => {
    // Dynamically import to get fresh instance
    const { urlRateLimiter } = await import('../../utils/rateLimiter');
    
    const url = 'https://example.com';
    const result = urlRateLimiter.canAdd(url);
    
    expect(result).toBe(true);
  });

  it('should not allow adding the same URL within rate limit period', async () => {
    const { urlRateLimiter } = await import('../../utils/rateLimiter');
    
    const url = 'https://example2.com';
    
    urlRateLimiter.canAdd(url);
    const result = urlRateLimiter.canAdd(url);
    
    expect(result).toBe(false);
  });

  it('should allow adding the same URL after rate limit period', async () => {
    const { urlRateLimiter } = await import('../../utils/rateLimiter');
    
    const url = 'https://example3.com';
    
    urlRateLimiter.canAdd(url);
    
    // Advance time by 10 seconds (rate limit from env)
    vi.advanceTimersByTime(10000);
    
    const result = urlRateLimiter.canAdd(url);
    expect(result).toBe(true);
  });

  it('should track different URLs independently', async () => {
    const { urlRateLimiter } = await import('../../utils/rateLimiter');
    
    const url1 = 'https://example4.com';
    const url2 = 'https://example5.com';
    
    expect(urlRateLimiter.canAdd(url1)).toBe(true);
    expect(urlRateLimiter.canAdd(url2)).toBe(true);
    
    expect(urlRateLimiter.canAdd(url1)).toBe(false);
    expect(urlRateLimiter.canAdd(url2)).toBe(false);
  });

  it('should not allow adding just before rate limit expires', async () => {
    const { urlRateLimiter } = await import('../../utils/rateLimiter');
    
    const url = 'https://example6.com';
    
    urlRateLimiter.canAdd(url);
    
    // Advance time by 9 seconds (just before rate limit)
    vi.advanceTimersByTime(9000);
    
    const result = urlRateLimiter.canAdd(url);
    expect(result).toBe(false);
  });

  it('should handle cleanup gracefully', async () => {
    const { urlRateLimiter } = await import('../../utils/rateLimiter');
    
    const url = 'https://example7.com';
    
    urlRateLimiter.canAdd(url);
    
    expect(() => urlRateLimiter.cleanup()).not.toThrow();
  });

  it('should remove expired URLs during cleanup', async () => {
    const { urlRateLimiter } = await import('../../utils/rateLimiter');
    
    const url = 'https://example8.com';
    urlRateLimiter.canAdd(url);
    
    // Advance time past rate limit
    vi.advanceTimersByTime(11000);
    
    // Cleanup should remove expired entries
    urlRateLimiter.cleanup();
    
    // Should be able to add again immediately after cleanup
    const result = urlRateLimiter.canAdd(url);
    expect(result).toBe(true);
  });
});
