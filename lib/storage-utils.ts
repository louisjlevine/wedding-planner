/**
 * Utilities for handling storage errors and improving save reliability
 */

export interface SaveResult {
  success: boolean;
  error?: string;
  needsRetry?: boolean;
}

export interface StorageQuotaInfo {
  used: number;
  total: number;
  remaining: number;
  quotaExceeded: boolean;
}

/**
 * Check localStorage quota and usage
 */
export async function checkStorageQuota(): Promise<StorageQuotaInfo | null> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const total = estimate.quota || 0;
      const remaining = total - used;
      
      return {
        used,
        total,
        remaining,
        quotaExceeded: remaining < 1024 * 1024, // Less than 1MB remaining
      };
    }
  } catch (err) {
    console.warn('[storage-utils] Could not estimate storage quota:', err);
  }
  return null;
}

/**
 * Safe localStorage setter with error handling
 */
export function safeLocalStorageSet(key: string, value: string): SaveResult {
  try {
    localStorage.setItem(key, value);
    return { success: true };
  } catch (err) {
    if (err instanceof DOMException) {
      if (err.name === 'QuotaExceededError') {
        return {
          success: false,
          error: 'Storage quota exceeded. Try removing some photos or clearing browser data.',
          needsRetry: false,
        };
      }
      if (err.name === 'SecurityError') {
        return {
          success: false,
          error: 'Storage access denied. Check browser settings.',
          needsRetry: false,
        };
      }
    }
    return {
      success: false,
      error: `Storage error: ${err instanceof Error ? err.message : String(err)}`,
      needsRetry: true,
    };
  }
}

/**
 * Calculate estimated size of data to be stored
 */
export function estimateDataSize(data: unknown): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return 0;
  }
}

/**
 * Retry function with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      // Exponential backoff: 1s, 2s, 4s, etc.
      const delay = delayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Clean up old data to free storage space
 */
export function cleanupStorage(): SaveResult {
  try {
    // Remove old cache entries
    const keysToCheck = Object.keys(localStorage);
    let removedCount = 0;
    
    for (const key of keysToCheck) {
      // Remove old research cache, temporary data, etc.
      if (key.includes('temp-') || key.includes('cache-')) {
        localStorage.removeItem(key);
        removedCount++;
      }
    }
    
    return {
      success: true,
      error: removedCount > 0 ? `Cleared ${removedCount} cached items` : undefined,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to cleanup storage: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}