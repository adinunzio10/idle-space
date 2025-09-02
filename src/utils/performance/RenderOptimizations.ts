import React, { memo, useMemo, useCallback, useRef, useEffect } from 'react';

/**
 * Performance-optimized memo comparison functions for React components
 */

/**
 * Compare beacon objects for memoization
 */
export const compareBeacons = (
  prevProps: { beacons: any[]; [key: string]: any },
  nextProps: { beacons: any[]; [key: string]: any }
): boolean => {
  // Quick length check first
  if (prevProps.beacons.length !== nextProps.beacons.length) {
    return false;
  }

  // Compare beacon IDs and positions (most likely to change)
  for (let i = 0; i < prevProps.beacons.length; i++) {
    const prev = prevProps.beacons[i];
    const next = nextProps.beacons[i];

    if (
      prev.id !== next.id ||
      prev.position.x !== next.position.x ||
      prev.position.y !== next.position.y ||
      prev.level !== next.level ||
      prev.type !== next.type
    ) {
      return false;
    }
  }

  // Compare other props (exclude beacons as we already checked them)
  const prevKeys = Object.keys(prevProps).filter(key => key !== 'beacons');
  const nextKeys = Object.keys(nextProps).filter(key => key !== 'beacons');

  if (prevKeys.length !== nextKeys.length) {
    return false;
  }

  for (const key of prevKeys) {
    if (prevProps[key] !== nextProps[key]) {
      return false;
    }
  }

  return true;
};

/**
 * Compare viewport state objects
 */
export const compareViewportState = (
  prev: {
    translateX: number;
    translateY: number;
    scale: number;
    [key: string]: any;
  },
  next: {
    translateX: number;
    translateY: number;
    scale: number;
    [key: string]: any;
  }
): boolean => {
  // Use threshold for floating point comparison
  const threshold = 0.001;

  return (
    Math.abs(prev.translateX - next.translateX) < threshold &&
    Math.abs(prev.translateY - next.translateY) < threshold &&
    Math.abs(prev.scale - next.scale) < threshold
  );
};

/**
 * Shallow comparison for objects with performance optimizations
 */
export const shallowCompareOptimized = (
  objA: Record<string, any>,
  objB: Record<string, any>
): boolean => {
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  // Check if both objects have the same keys and values
  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (objA[key] !== objB[key]) {
      return false;
    }
  }

  return true;
};

/**
 * Higher-order component for performance-optimized memoization
 */
export function withPerformanceMemo<P extends Record<string, any>>(
  Component: React.ComponentType<P>,
  compareFunction?: (prevProps: P, nextProps: P) => boolean
) {
  const MemoizedComponent = memo(Component, compareFunction);
  MemoizedComponent.displayName = `WithPerformanceMemo(${Component.displayName || Component.name})`;
  return MemoizedComponent;
}

/**
 * Hook for stable callback references with dependency optimization
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  const stableRef = useRef<T>(callback);

  // Only update the ref when dependencies actually change
  useEffect(() => {
    stableRef.current = callback;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return useCallback(
    ((...args) => stableRef.current(...args)) as T,
    [] // Empty dependency array for stable reference
  );
}

/**
 * Hook for expensive computations with smart invalidation
 */
export function useSmartMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  compareFunction?: (prev: T, next: T) => boolean
): T {
  const prevDepsRef = useRef<React.DependencyList>();
  const prevValueRef = useRef<T>();
  const hasInitializedRef = useRef(false);

  return useMemo(() => {
    // First run
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      prevDepsRef.current = deps;
      const value = factory();
      prevValueRef.current = value;
      return value;
    }

    // Check if dependencies have actually changed
    const prevDeps = prevDepsRef.current!;
    let depsChanged = false;

    if (deps.length !== prevDeps.length) {
      depsChanged = true;
    } else {
      for (let i = 0; i < deps.length; i++) {
        if (deps[i] !== prevDeps[i]) {
          depsChanged = true;
          break;
        }
      }
    }

    if (!depsChanged) {
      return prevValueRef.current!;
    }

    const newValue = factory();

    // Use custom comparison if provided
    if (compareFunction && compareFunction(prevValueRef.current!, newValue)) {
      return prevValueRef.current!;
    }

    prevDepsRef.current = deps;
    prevValueRef.current = newValue;
    return newValue;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Hook for batching state updates to reduce render cycles
 */
export function useBatchedState<T>(
  initialState: T,
  batchDelay: number = 16 // Default to ~60fps
): [T, (newState: T | ((prev: T) => T)) => void, () => void] {
  const [state, setState] = React.useState(initialState);
  const pendingUpdateRef = useRef<T | ((prev: T) => T) | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const flushUpdates = useCallback(() => {
    if (pendingUpdateRef.current !== null) {
      setState(pendingUpdateRef.current);
      pendingUpdateRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const setBatchedState = useCallback(
    (newState: T | ((prev: T) => T)) => {
      pendingUpdateRef.current = newState;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(flushUpdates, batchDelay);
    },
    [flushUpdates, batchDelay]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, setBatchedState, flushUpdates];
}

/**
 * Hook for optimized list rendering with virtualization hints
 */
export function useVirtualizedList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
): {
  visibleItems: { item: T; index: number }[];
  startIndex: number;
  endIndex: number;
  scrollOffset: number;
  totalHeight: number;
} {
  const [scrollOffset, setScrollOffset] = React.useState(0);

  const { visibleItems, startIndex, endIndex, totalHeight } = useMemo(() => {
    const totalHeight = items.length * itemHeight;
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.max(
      0,
      Math.floor(scrollOffset / itemHeight) - overscan
    );
    const endIndex = Math.min(
      items.length - 1,
      startIndex + visibleCount + overscan * 2
    );

    const visibleItems = [];
    for (let i = startIndex; i <= endIndex; i++) {
      visibleItems.push({ item: items[i], index: i });
    }

    return { visibleItems, startIndex, endIndex, totalHeight };
  }, [items, itemHeight, containerHeight, scrollOffset, overscan]);

  return {
    visibleItems,
    startIndex,
    endIndex,
    scrollOffset,
    totalHeight,
  };
}

/**
 * Performance-optimized component factory for repetitive elements
 */
export function createOptimizedComponent<P extends Record<string, any>>(
  render: (props: P) => React.ReactElement,
  displayName: string,
  compareProps?: (prevProps: P, nextProps: P) => boolean
): React.ComponentType<P> {
  const Component = (props: P) => render(props);
  Component.displayName = displayName;

  return memo(Component, compareProps);
}

/**
 * Hook for tracking component render performance
 */
export function useRenderTracker(componentName: string, props?: any) {
  const renderStartRef = useRef<number>(0);
  const renderCountRef = useRef<number>(0);

  useEffect(() => {
    renderStartRef.current = performance.now();
    renderCountRef.current += 1;
  });

  useEffect(() => {
    const renderTime = performance.now() - renderStartRef.current;

    if (__DEV__ && renderTime > 16.67) {
      console.warn(
        `[Performance] ${componentName} render took ${renderTime.toFixed(2)}ms (render #${renderCountRef.current})`,
        props ? { props } : ''
      );
    }
  });

  return {
    renderCount: renderCountRef.current,
    logRenderTime: (customName?: string) => {
      const renderTime = performance.now() - renderStartRef.current;
      console.log(
        `[Performance] ${customName || componentName} render: ${renderTime.toFixed(2)}ms`
      );
    },
  };
}

/**
 * Debounced state hook for expensive operations
 */
export function useDebouncedState<T>(
  initialValue: T,
  delay: number
): [T, T, React.Dispatch<React.SetStateAction<T>>] {
  const [immediateValue, setImmediateValue] = React.useState(initialValue);
  const [debouncedValue, setDebouncedValue] = React.useState(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(immediateValue);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [immediateValue, delay]);

  return [immediateValue, debouncedValue, setImmediateValue];
}

/**
 * Hook for frame-rate limited state updates
 */
export function useFrameLimitedState<T>(
  initialValue: T
): [T, (newValue: T) => void] {
  const [state, setState] = React.useState(initialValue);
  const pendingValueRef = useRef<T>(initialValue);
  const frameRequestRef = useRef<number | null>(null);

  const setFrameLimitedState = useCallback((newValue: T) => {
    pendingValueRef.current = newValue;

    if (frameRequestRef.current === null) {
      frameRequestRef.current = requestAnimationFrame(() => {
        setState(pendingValueRef.current);
        frameRequestRef.current = null;
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (frameRequestRef.current !== null) {
        cancelAnimationFrame(frameRequestRef.current);
      }
    };
  }, []);

  return [state, setFrameLimitedState];
}
