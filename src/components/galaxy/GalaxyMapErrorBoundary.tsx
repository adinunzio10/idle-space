/**
 * GalaxyMapErrorBoundary - React Error Boundary Component
 * 
 * Implements React Error Boundary pattern with componentDidCatch and getDerivedStateFromError
 * lifecycle methods to catch JavaScript errors in the component tree and display fallback UI.
 * 
 * Features:
 * - Error isolation to prevent entire map from crashing
 * - Module-specific error handling
 * - Error recovery and retry mechanisms
 * - Circuit breaker pattern for repeated failures
 * - Error analytics and reporting
 * - Accessibility support
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View } from 'react-native';
import ErrorFallbackUI from './ErrorFallbackUI';

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  lastErrorTime: number;
  errorType?: string;
  moduleId?: string;
  isCritical?: boolean;
  canDegrade?: boolean;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  resetOnPropsChange?: boolean;
  maxErrors?: number;
  onErrorReport?: (errorReport: any) => void;
  showReporting?: boolean;
  testID?: string;
}

class GalaxyMapErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: 0,
    };
    
    this.resetError = this.resetError.bind(this);
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Parse error to determine type and severity
    const errorMessage = error.message.toLowerCase();
    let errorType = 'unknown-error';
    let moduleId: string | undefined;
    let isCritical = false;
    let canDegrade = false;

    // Determine error type and module from error message
    if (errorMessage.includes('module')) {
      errorType = 'module-failure';
      const moduleMatch = error.message.match(/module (\w+[-\w]*)/i);
      moduleId = moduleMatch ? moduleMatch[1] : undefined;
    } else if (errorMessage.includes('critical') || errorMessage.includes('system failure')) {
      errorType = 'critical-failure';
      isCritical = true;
    } else if (errorMessage.includes('performance') || errorMessage.includes('degradation')) {
      errorType = 'performance-failure';
      canDegrade = true;
    } else if (errorMessage.includes('network')) {
      errorType = 'network-failure';
    }

    return {
      hasError: true,
      error,
      errorType,
      moduleId,
      isCritical,
      canDegrade,
      errorCount: 0, // Will be updated in componentDidCatch
      lastErrorTime: Date.now(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Update error count
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
      lastErrorTime: Date.now(),
    }));

    // Log error for debugging
    console.error('[GalaxyMapErrorBoundary] Component error caught:', error);
    console.error('[GalaxyMapErrorBoundary] Error info:', errorInfo);
    console.error('[GalaxyMapErrorBoundary] Component stack:', errorInfo.componentStack);

    // Report error analytics if callback provided
    if (this.props.onErrorReport) {
      const errorReport = {
        error,
        errorInfo,
        timestamp: Date.now(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        errorCount: this.state.errorCount + 1,
        errorType: this.state.errorType,
        moduleId: this.state.moduleId,
      };
      
      this.props.onErrorReport(errorReport);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error state when props change (if enabled)
    if (this.props.resetOnPropsChange && this.state.hasError) {
      // Check if children or key props changed
      const childrenChanged = prevProps.children !== this.props.children;
      const keyChanged = (prevProps as any).key !== (this.props as any).key;
      
      if (childrenChanged || keyChanged) {
        this.resetError();
      }
    }
  }

  componentWillUnmount(): void {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: undefined,
      moduleId: undefined,
      isCritical: false,
      canDegrade: false,
      // Keep error count for circuit breaker pattern
    });
  };

  handleRecoverModule = (moduleId?: string): void => {
    console.log(`[GalaxyMapErrorBoundary] Recovering module: ${moduleId}`);
    // Module recovery logic would go here
    this.resetError();
  };

  handleEnableEmergencyMode = (): void => {
    console.log('[GalaxyMapErrorBoundary] Enabling emergency mode');
    // Emergency mode logic would go here
    this.resetError();
  };

  render(): ReactNode {
    const { children, maxErrors = 5, showReporting = false, testID } = this.props;
    const { hasError, error, errorInfo, errorCount, errorType, moduleId, isCritical, canDegrade } = this.state;

    if (hasError && error) {
      // Circuit breaker pattern - stop showing retry after max errors
      const isCircuitBreakerTripped = maxErrors > 0 && errorCount >= maxErrors;

      return (
        <ErrorFallbackUI
          error={error}
          errorInfo={errorInfo}
          resetError={this.resetError}
          onRecoverModule={this.handleRecoverModule}
          onEnableEmergencyMode={this.handleEnableEmergencyMode}
          errorType={errorType}
          moduleId={moduleId}
          isCritical={isCritical}
          canDegrade={canDegrade}
          showReporting={showReporting}
          isCircuitBreakerTripped={isCircuitBreakerTripped}
          errorCount={errorCount}
          maxErrors={maxErrors}
          testID="error-boundary-fallback"
        />
      );
    }

    // Wrap children in a container with testID for testing
    return (
      <View testID={testID || 'galaxy-map-error-boundary'}>
        {children}
      </View>
    );
  }
}

export default GalaxyMapErrorBoundary;