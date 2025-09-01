import React from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { DebugOverlay } from './DebugOverlay';
import { GestureDebugOverlay } from './GestureDebugOverlay';

interface SettingsAwareDebugOverlayProps {
  // Props that would be passed to the debug overlays
  [key: string]: any;
}

/**
 * Wrapper component that shows debug overlays only when debug setting is enabled
 * Automatically hides debug information in production or when user disables debug mode
 */
export const SettingsAwareDebugOverlay: React.FC<SettingsAwareDebugOverlayProps> = (props) => {
  const { settings } = useSettings();
  
  // Only show debug overlay if:
  // 1. We're in development mode (__DEV__ is true)
  // 2. User has enabled debug info in settings
  const shouldShowDebug = __DEV__ && settings.debugInfoEnabled;
  
  if (!shouldShowDebug) {
    return null;
  }

  return (
    <>
      {/* You can conditionally render different debug overlays based on needs */}
      {props.stateMachine && (
        <DebugOverlay
          stateMachine={props.stateMachine}
          selectedBeacon={props.selectedBeacon}
          enabled={shouldShowDebug}
          position={props.debugPosition || 'top-right'}
          compact={props.compact || false}
        />
      )}
      
      {props.showGestureDebug && (
        <GestureDebugOverlay
          enabled={shouldShowDebug}
          {...props.gestureDebugProps}
        />
      )}
    </>
  );
};

/**
 * Higher-order component that adds debug functionality to any component
 */
export const withDebugOverlay = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return (props: P & { debugProps?: any }) => {
    const { settings } = useSettings();
    const shouldShowDebug = __DEV__ && settings.debugInfoEnabled;
    
    return (
      <>
        <Component {...props} />
        {shouldShowDebug && props.debugProps && (
          <SettingsAwareDebugOverlay {...props.debugProps} />
        )}
      </>
    );
  };
};