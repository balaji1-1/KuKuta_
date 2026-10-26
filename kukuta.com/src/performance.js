/**
 * Performance optimization utilities for React application.
 * Includes lazy loading, image optimization, and caching strategies.
 */

import React, { Suspense } from 'react';

/**
 * Lazy loading boundary component with fallback UI
 */
export function LazyBoundary({ children, fallback = null }) {
  return (
    <Suspense fallback={fallback || <div className="loading-spinner">Loading...</div>}>
      {children}
    </Suspense>
  );
}

/**
 * Image optimization hook for responsive images
 */
export function useOptimizedImage(src, alt = '') {
  const [imageSrc, setImageSrc] = React.useState(src);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    setIsLoading(true);
    const img = new Image();
    
    // Set up success handler
    img.onload = () => {
      setImageSrc(img.src);
      setIsLoading(false);
      setError(false);
    };
    
    // Set up error handler
    img.onerror = () => {
      setError(true);
      setIsLoading(false);
    };
    
    // Set source to trigger load
    img.src = src;
    
    // Cleanup
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return { imageSrc, isLoading, error };
}

/**
 * Lazy Image component with intersection observer for lazy loading
 */
export const LazyImage = React.memo(({ src, alt = '', className = '', onLoad = null }) => {
  const [imageSrc, setImageSrc] = React.useState(null);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const imgRef = React.useRef(null);

  React.useEffect(() => {
    // Use Intersection Observer for lazy loading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setImageSrc(src);
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '50px' } // Start loading 50px before image comes into view
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [src]);

  const handleLoad = () => {
    setIsLoaded(true);
    if (onLoad) onLoad();
  };

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={`lazy-image ${className} ${isLoaded ? 'loaded' : 'loading'}`}
      onLoad={handleLoad}
      loading="lazy"
    />
  );
});

LazyImage.displayName = 'LazyImage';

/**
 * API request caching utility
 */
class APICache {
  constructor(ttl = 5 * 60 * 1000) { // 5 minute default TTL
    this.cache = new Map();
    this.ttl = ttl;
  }

  set(key, value, ttl = null) {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.ttl,
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    const age = Date.now() - item.timestamp;
    if (age > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  clear() {
    this.cache.clear();
  }

  delete(key) {
    this.cache.delete(key);
  }
}

export const apiCache = new APICache();

/**
 * Fetch wrapper with caching support
 */
export async function cachedFetch(url, options = {}) {
  const cacheKey = `${options.method || 'GET'}:${url}`;
  const cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutes default

  // Check cache first (only for GET requests)
  if (options.method !== 'POST' && options.method !== 'PUT' && options.method !== 'DELETE') {
    const cached = apiCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Cache successful GET responses
    if (options.method !== 'POST' && options.method !== 'PUT' && options.method !== 'DELETE') {
      apiCache.set(cacheKey, data, cacheTTL);
    }

    return data;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

/**
 * Debounce hook for performance optimization
 */
export function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Throttle hook for performance optimization
 */
export function useThrottle(value, interval = 500) {
  const [throttledValue, setThrottledValue] = React.useState(value);
  const lastUpdated = React.useRef(null);

  React.useEffect(() => {
    const now = Date.now();

    if (lastUpdated.current && now >= lastUpdated.current + interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
    } else {
      const timer = setTimeout(() => {
        lastUpdated.current = now;
        setThrottledValue(value);
      }, interval);

      return () => clearTimeout(timer);
    }
  }, [value, interval]);

  return throttledValue;
}

/**
 * Memoization hook for expensive computations
 */
export function useMemo(computeFn, dependencies) {
  return React.useMemo(computeFn, dependencies);
}

/**
 * Callback memoization hook
 */
export function useCallback(callback, dependencies) {
  return React.useCallback(callback, dependencies);
}

/**
 * Virtual scroll list for large datasets
 */
export const VirtualList = React.memo(({
  items = [],
  itemHeight = 50,
  containerHeight = 400,
  renderItem = (item) => <div>{item.id}</div>,
  className = '',
}) => {
  const [scrollTop, setScrollTop] = React.useState(0);
  const containerRef = React.useRef(null);

  // Calculate visible range
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.ceil((scrollTop + containerHeight) / itemHeight);
  const visibleItems = items.slice(visibleStart, visibleEnd);
  const offsetY = visibleStart * itemHeight;

  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
  };

  return (
    <div
      ref={containerRef}
      className={`virtual-list ${className}`}
      style={{
        height: containerHeight,
        overflowY: 'auto',
        position: 'relative',
      }}
      onScroll={handleScroll}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, idx) => (
            <div key={visibleStart + idx} style={{ height: itemHeight }}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

VirtualList.displayName = 'VirtualList';

/**
 * Service worker registration for offline support and caching
 */
export function registerServiceWorker() {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.log('ServiceWorker registered:', registration);
        },
        (error) => {
          console.log('ServiceWorker registration failed:', error);
        }
      );
    });
  }
}

/**
 * Performance monitoring and metrics
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = {};
  }

  mark(name) {
    performance.mark(name);
  }

  measure(name, startMark, endMark) {
    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name)[0];
      this.metrics[name] = measure.duration;
      return measure.duration;
    } catch (error) {
      console.error('Measurement error:', error);
    }
  }

  getMetric(name) {
    return this.metrics[name];
  }

  getAllMetrics() {
    return { ...this.metrics };
  }

  clearMetrics() {
    this.metrics = {};
    performance.clearMarks();
    performance.clearMeasures();
  }

  logWebVitals() {
    if ('web-vital' in window) {
      const vitals = window['web-vital'];
      console.log('Web Vitals:', vitals);
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();
