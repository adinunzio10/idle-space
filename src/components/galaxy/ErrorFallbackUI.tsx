/**
 * ErrorFallbackUI - Error Boundary Fallback Component
 * 
 * Displays user-friendly error messages and recovery options when React components crash.
 * Provides different UI based on error type and severity with accessibility support.
 * 
 * Features:
 * - Contextual error messages based on error type
 * - Multiple recovery options (retry, disable module, emergency mode)
 * - Progressive degradation controls
 * - Error reporting and debugging tools
 * - Full accessibility support with keyboard navigation
 * - Circuit breaker UI for repeated failures
 */

import React, { ErrorInfo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export interface ErrorFallbackProps {
  error: Error;
  errorInfo?: ErrorInfo | object;
  resetError: () => void;
  onRecoverModule?: (moduleId?: string) => void;
  onEnableEmergencyMode?: () => void;
  errorType?: string;
  moduleId?: string;
  isCritical?: boolean;
  canDegrade?: boolean;
  showReporting?: boolean;
  isCircuitBreakerTripped?: boolean;
  errorCount?: number;
  maxErrors?: number;
  testID?: string;
}

const ErrorFallbackUI: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  resetError,
  onRecoverModule,
  onEnableEmergencyMode,
  errorType = 'unknown-error',
  moduleId,
  isCritical = false,
  canDegrade = false,
  showReporting = false,
  isCircuitBreakerTripped = false,
  errorCount = 0,
  maxErrors = 5,
  testID = 'error-fallback-ui',
}) => {
  
  const handleRetry = () => {
    resetError();
  };

  const handleRecoverModule = () => {
    if (onRecoverModule) {
      onRecoverModule(moduleId);
    }
  };

  const handleEmergencyMode = () => {
    if (onEnableEmergencyMode) {
      onEnableEmergencyMode();
    }
  };

  const handleDisableModule = () => {
    console.log(`[ErrorFallbackUI] Disabling module: ${moduleId}`);
    // Module disabling logic would be handled by parent
    resetError();
  };

  const handleReportError = () => {
    console.log('[ErrorFallbackUI] Reporting error:', error);
    // Error reporting logic would go here
  };

  const handleCopyErrorInfo = () => {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo ? (errorInfo as any).componentStack : 'Unknown',
      timestamp: new Date().toISOString(),
      errorType,
      moduleId,
    };
    
    console.log('[ErrorFallbackUI] Error info copied:', JSON.stringify(errorDetails, null, 2));
    // Copy to clipboard logic would go here
  };

  // Generate user-friendly error messages
  const getUserFriendlyMessage = (): string => {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('network')) {
      return 'Check your internet connection and try again';
    }
    
    if (errorMessage.includes('beacon-rendering') || moduleId === 'beacon-rendering') {
      return 'Beacon display temporarily unavailable';
    }
    
    if (errorMessage.includes('performance') || errorMessage.includes('degradation')) {
      return 'Reducing quality to improve performance';
    }
    
    if (errorType === 'module-failure' && moduleId) {
      return `${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)} module temporarily unavailable`;
    }
    
    if (isCritical) {
      return 'Critical system error occurred. Please restart the application.';
    }
    
    return 'An unexpected error occurred. Please try again.';
  };

  const getErrorTitle = (): string => {
    if (isCircuitBreakerTripped) {
      return 'Multiple Errors Detected';
    }
    
    if (isCritical) {
      return 'Critical Error';
    }
    
    if (errorType === 'module-failure') {
      return 'Module Error';
    }
    
    if (errorType === 'performance-failure') {
      return 'Performance Issue';
    }
    
    if (errorType === 'network-failure') {
      return 'Connection Error';
    }
    
    return 'Something Went Wrong';
  };

  return (
    <View 
      testID={testID}
      className="flex-1 justify-center items-center p-6 bg-gray-900"
      accessible={true}
      accessibilityRole="alert"
    >
      {/* Error Title */}
      <View testID="error-title" className="mb-4">
        <Text 
          className="text-red-400 text-xl font-bold text-center"
          accessibilityRole="header"
          accessibilityLevel={1}
        >
          🚨 {getErrorTitle()}
        </Text>
      </View>

      {/* User-Friendly Message */}
      <View testID="user-friendly-message" className="mb-4">
        <Text 
          className="text-white text-base text-center mb-2"
          accessibilityRole="text"
        >
          {getUserFriendlyMessage()}
        </Text>
      </View>

      {/* Technical Error Message */}
      <View testID="error-message" className="mb-6 p-4 bg-gray-800 rounded max-w-lg">
        <Text 
          className="text-gray-300 text-sm text-center"
          accessibilityRole="alert"
          accessibilityLabel={`Error details: ${error.message}`}
        >
          {error.message}
        </Text>
      </View>

      {/* Error Details (for debugging) */}
      {errorInfo && (
        <View testID="error-details" className="mb-6 max-w-lg">
          <TouchableOpacity 
            className="bg-gray-700 p-2 rounded"
            onPress={() => console.log('Error details:', errorInfo)}
          >
            <Text className="text-gray-400 text-xs text-center">
              Tap for technical details
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Circuit Breaker Message */}
      {isCircuitBreakerTripped && (
        <View testID="circuit-breaker-message" className="mb-6 p-4 bg-red-900 rounded max-w-lg">
          <Text className="text-red-300 text-sm text-center">
            Too many errors occurred ({errorCount}/{maxErrors}). 
            Please refresh the page or contact support.
          </Text>
        </View>
      )}

      {/* Recovery Controls */}
      {!isCircuitBreakerTripped && (
        <View className="space-y-3 w-full max-w-xs">
          
          {/* Retry Button */}
          <TouchableOpacity
            testID="retry-button"
            onPress={handleRetry}
            className="bg-blue-600 py-3 px-6 rounded-lg"
            accessibilityRole="button"
            accessibilityLabel="Retry and reload the component"
            accessible={true}
            onAccessibilityAction={(event) => {
              if (event.name === 'activate') {
                handleRetry();
              }
            }}
          >
            <Text className="text-white text-center font-semibold">
              🔄 Try Again
            </Text>
          </TouchableOpacity>

          {/* Module-Specific Recovery Options */}
          {errorType === 'module-failure' && moduleId && (
            <>
              <TouchableOpacity
                testID="recover-module-button"
                onPress={handleRecoverModule}
                className="bg-green-600 py-3 px-6 rounded-lg"
                accessibilityRole="button"
                accessibilityLabel={`Recover ${moduleId} module`}
                accessible={true}
              >
                <Text className="text-white text-center font-semibold">
                  🔧 Recover Module
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="disable-module-button"
                onPress={handleDisableModule}
                className="bg-yellow-600 py-3 px-6 rounded-lg"
                accessibilityRole="button"
                accessibilityLabel={`Disable ${moduleId} module`}
                accessible={true}
              >
                <Text className="text-white text-center font-semibold">
                  ⚠️ Disable Module
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Emergency Mode Button */}
          <TouchableOpacity
            testID="emergency-mode-button"
            onPress={handleEmergencyMode}
            className="bg-orange-600 py-3 px-6 rounded-lg"
            accessibilityRole="button"
            accessibilityLabel="Enable emergency mode"
            accessible={true}
          >
            <Text className="text-white text-center font-semibold">
              🚨 Emergency Mode
            </Text>
          </TouchableOpacity>

          {/* Progressive Degradation Options */}
          {canDegrade && (
            <>
              <TouchableOpacity
                testID="reduce-quality-button"
                onPress={() => {
                  console.log('[ErrorFallbackUI] Reducing quality');
                  resetError();
                }}
                className="bg-purple-600 py-3 px-6 rounded-lg"
                accessibilityRole="button"
                accessibilityLabel="Reduce graphics quality"
                accessible={true}
              >
                <Text className="text-white text-center font-semibold">
                  📉 Reduce Quality
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="disable-effects-button"
                onPress={() => {
                  console.log('[ErrorFallbackUI] Disabling effects');
                  resetError();
                }}
                className="bg-purple-600 py-3 px-6 rounded-lg"
                accessibilityRole="button"
                accessibilityLabel="Disable visual effects"
                accessible={true}
              >
                <Text className="text-white text-center font-semibold">
                  ✨ Disable Effects
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="minimal-mode-button"
                onPress={() => {
                  console.log('[ErrorFallbackUI] Enabling minimal mode');
                  resetError();
                }}
                className="bg-gray-600 py-3 px-6 rounded-lg"
                accessibilityRole="button"
                accessibilityLabel="Enable minimal mode"
                accessible={true}
              >
                <Text className="text-white text-center font-semibold">
                  📱 Minimal Mode
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Critical Error Options */}
          {isCritical && (
            <>
              <TouchableOpacity
                testID="full-restart-button"
                onPress={() => {
                  console.log('[ErrorFallbackUI] Full restart requested');
                  // Would trigger app restart or page refresh
                }}
                className="bg-red-600 py-3 px-6 rounded-lg"
                accessibilityRole="button"
                accessibilityLabel="Restart the application"
                accessible={true}
              >
                <Text className="text-white text-center font-semibold">
                  🔄 Restart App
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="emergency-contact-button"
                onPress={() => {
                  console.log('[ErrorFallbackUI] Emergency contact requested');
                  // Would open support contact
                }}
                className="bg-red-800 py-3 px-6 rounded-lg"
                accessibilityRole="button"
                accessibilityLabel="Contact emergency support"
                accessible={true}
              >
                <Text className="text-white text-center font-semibold">
                  📞 Contact Support
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Error Reporting Section */}
      {showReporting && (
        <View className="mt-6 space-y-2 w-full max-w-xs">
          <TouchableOpacity
            testID="report-error-button"
            onPress={handleReportError}
            className="bg-gray-700 py-2 px-4 rounded"
            accessibilityRole="button"
            accessibilityLabel="Report this error"
            accessible={true}
          >
            <Text className="text-gray-300 text-center text-sm">
              📋 Report Error
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="copy-error-info-button"
            onPress={handleCopyErrorInfo}
            className="bg-gray-700 py-2 px-4 rounded"
            accessibilityRole="button"
            accessibilityLabel="Copy error information"
            accessible={true}
          >
            <Text className="text-gray-300 text-center text-sm">
              📋 Copy Error Info
            </Text>
          </TouchableOpacity>

          <View testID="error-timestamp" className="pt-2">
            <Text className="text-gray-500 text-center text-xs">
              Error occurred at: {new Date().toLocaleString()}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default ErrorFallbackUI;