import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { ProbeInstance, PROBE_TYPE_CONFIG } from '../../types/probe';
import { Point2D } from '../../types/galaxy';

interface ProbeAnimationRendererProps {
  probes: ProbeInstance[];
  scale: Animated.SharedValue<number>;
  translateX: Animated.SharedValue<number>;
  translateY: Animated.SharedValue<number>;
  width: number;
  height: number;
}

interface AnimatedProbeProps {
  probe: ProbeInstance;
  scale: Animated.SharedValue<number>;
  translateX: Animated.SharedValue<number>;
  translateY: Animated.SharedValue<number>;
  screenWidth: number;
  screenHeight: number;
}

const AnimatedProbe: React.FC<AnimatedProbeProps> = React.memo(({
  probe,
  scale,
  translateX,
  translateY,
  screenWidth,
  screenHeight,
}) => {
  const probeX = useSharedValue(probe.startPosition.x);
  const probeY = useSharedValue(probe.startPosition.y);
  const opacity = useSharedValue(0);
  const probeScale = useSharedValue(0.5);
  const rotation = useSharedValue(0);
  
  // Calculate travel distance and direction
  const deltaX = probe.targetPosition.x - probe.startPosition.x;
  const deltaY = probe.targetPosition.y - probe.startPosition.y;
  const totalDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
  // Calculate rotation angle (probe faces toward target)
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

  useEffect(() => {
    // Initialize probe at start position with entrance animation
    opacity.value = withSequence(
      withTiming(0, { duration: 100 }),
      withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) })
    );
    
    probeScale.value = withSequence(
      withTiming(0.5, { duration: 100 }),
      withSpring(1.2, { damping: 15, stiffness: 200 })
    );
    
    // Set rotation to face target
    rotation.value = withTiming(angle, { duration: 200, easing: Easing.out(Easing.quad) });
  }, [probe.id, angle, opacity, probeScale, rotation]);

  useEffect(() => {
    // Animate probe position based on travel progress
    if (probe.status === 'launching' && probe.travelProgress > 0) {
      const targetX = probe.startPosition.x + deltaX * probe.travelProgress;
      const targetY = probe.startPosition.y + deltaY * probe.travelProgress;
      
      // Use timing animation for smooth travel
      const duration = 1000; // 1 second for smooth interpolation
      
      probeX.value = withTiming(targetX, {
        duration,
        easing: Easing.inOut(Easing.ease),
      });
      
      probeY.value = withTiming(targetY, {
        duration,
        easing: Easing.inOut(Easing.ease),
      });
    }
  }, [probe.travelProgress, probe.status, deltaX, deltaY, probeX, probeY]);

  useEffect(() => {
    // Arrival animation when probe reaches destination
    if (probe.status === 'deployed' && probe.travelProgress >= 1) {
      // Final position animation
      probeX.value = withTiming(probe.targetPosition.x, {
        duration: 300,
        easing: Easing.out(Easing.back(1.2)),
      });
      
      probeY.value = withTiming(probe.targetPosition.y, {
        duration: 300,
        easing: Easing.out(Easing.back(1.2)),
      });
      
      // Arrival effect - scale up and fade out
      probeScale.value = withSequence(
        withTiming(1.2, { duration: 300, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 500, easing: Easing.in(Easing.quad) })
      );
      
      opacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 800, easing: Easing.in(Easing.quad) })
      );
    }
  }, [probe.status, probe.travelProgress, probe.targetPosition, probeX, probeY, probeScale, opacity]);

  // Convert galaxy coordinates to screen coordinates
  const animatedStyle = useAnimatedStyle(() => {
    // FIXED: Use same coordinate transformation as galaxy map SVG elements
    // Remove the incorrect screenWidth/2 and screenHeight/2 offsets
    const screenX = (probeX.value * scale.value) + translateX.value;
    const screenY = (probeY.value * scale.value) + translateY.value;
    
    return {
      position: 'absolute',
      left: screenX - 20, // Center the probe (40px width / 2)
      top: screenY - 20,  // Center the probe (40px height / 2)
      transform: [
        { scale: probeScale.value },
        { rotate: `${rotation.value}deg` }
      ],
      opacity: opacity.value,
      zIndex: 1000, // Ensure probes render above other elements
    };
  });

  const config = PROBE_TYPE_CONFIG[probe.type];
  
  // Show acceleration effect for boosted probes
  const isAccelerated = probe.accelerationBonus > 1;
  
  return (
    <Animated.View style={animatedStyle}>
      <View className="flex items-center justify-center w-10 h-10 relative">
        {/* Acceleration glow effect */}
        {isAccelerated && (
          <View 
            className="absolute inset-0 rounded-full bg-accent opacity-60"
            style={{
              shadowColor: '#F59E0B',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 12,
              elevation: 10,
            }}
          />
        )}
        
        {/* Probe icon - styled as proper probe */}
        <View 
          className="flex items-center justify-center w-10 h-10 rounded-full border-2"
          style={{
            backgroundColor: config.color + '40', // Semi-transparent background
            borderColor: config.color,
            shadowColor: config.color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 4,
            elevation: 5,
          }}
        >
          <View>
            {/* Probe core */}
            <View 
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: config.color }}
            />
          </View>
        </View>
        
        {/* Travel trail effect */}
        {probe.status === 'launching' && (
          <View 
            className="absolute w-8 h-1 opacity-30"
            style={{
              backgroundColor: config.color,
              left: -20,
              top: 10,
              transform: [{ rotate: `${angle}deg` }],
              shadowColor: config.color,
              shadowOffset: { width: -4, height: 0 },
              shadowOpacity: 0.3,
              shadowRadius: 2,
            }}
          />
        )}
      </View>
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo - re-render if probe properties change
  const prevProbe = prevProps.probe;
  const nextProbe = nextProps.probe;
  
  return (
    prevProbe.id === nextProbe.id &&
    prevProbe.status === nextProbe.status &&
    prevProbe.travelProgress === nextProbe.travelProgress &&
    prevProps.scale === nextProps.scale &&
    prevProps.translateX === nextProps.translateX &&
    prevProps.translateY === nextProps.translateY
  );
});

export const ProbeAnimationRenderer: React.FC<ProbeAnimationRendererProps> = ({
  probes,
  scale,
  translateX,
  translateY,
  width,
  height,
}) => {
  // Only render probes that are actively traveling or recently deployed
  const activeProbes = probes.filter(probe => 
    probe.status === 'launching' || 
    (probe.status === 'deployed' && Date.now() - (probe.deploymentCompletedAt || 0) < 5000) // Show for 5 seconds after deployment (matches ProbeManager)
  );

  return (
    <View className="absolute inset-0" pointerEvents="none">
      {activeProbes.map((probe) => (
        <AnimatedProbe
          key={probe.id}
          probe={probe}
          scale={scale}
          translateX={translateX}
          translateY={translateY}
          screenWidth={width}
          screenHeight={height}
        />
      ))}
    </View>
  );
};