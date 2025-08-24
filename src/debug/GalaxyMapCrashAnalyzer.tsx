/**
 * Galaxy Map Specific JSI Crash Analyzer
 * 
 * Tests the actual SharedValues and patterns used in GalaxyMapView
 * to find the specific source of JSI crashes when opening the Galaxy Map.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { gestureConfig } from '../constants/gestures';
import { GestureStateMachine, GestureStateType, createStateChecker } from '../utils/gestures/gestureStateMachine';

export const GalaxyMapCrashAnalyzer: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  // Replicate the exact SharedValues from GalaxyMapView
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const lastScale = useSharedValue(1);
  const lastTranslateX = useSharedValue(0);
  const lastTranslateY = useSharedValue(0);
  const velocityX = useSharedValue(0);
  const velocityY = useSharedValue(0);
  const isDecaying = useSharedValue(false);
  const prevVelocityX = useSharedValue(0);
  const prevVelocityY = useSharedValue(0);
  const focalPointX = useSharedValue(400); // Default width/2
  const focalPointY = useSharedValue(600); // Default height/2
  const gestureSharedState = useSharedValue(GestureStateType.IDLE);

  // Performance SharedValues
  const performanceLastFrameTime = useSharedValue(0);
  const performanceFrameCount = useSharedValue(0);
  const performanceAvgFrameTime = useSharedValue(16.67);
  const performanceDroppedFrames = useSharedValue(0);
  const performanceGestureResponseTime = useSharedValue(0);

  const debugSharedValue = useSharedValue('');
  
  // The problematic gesture state SharedValues
  const gestureStateIsActive = useSharedValue(false);
  const gestureStateVelocityX = useSharedValue(0);
  const gestureStateVelocityY = useSharedValue(0);
  const gestureStateFocalPointX = useSharedValue(0);
  const gestureStateFocalPointY = useSharedValue(0);
  const gestureStateHasFocalPoint = useSharedValue(false);
  
  const activeTouchAreasData = useSharedValue('');
  const rapidTouchCount = useSharedValue(0);
  const lastTouchTime = useSharedValue(0);
  const activeTouchesData = useSharedValue('');
  const recentTouchesData = useSharedValue('');

  const runAnalysis = async () => {
    setIsRunning(true);
    setResults([]);
    
    const analysisResults: string[] = [];
    
    try {
      analysisResults.push('=== Galaxy Map JSI Crash Analysis ===\n');
      
      // Test 1: Check gesture config
      analysisResults.push('1. Testing gesture configuration...');
      try {
        const panThresholds = gestureConfig.getPanThresholds();
        analysisResults.push(`   ✅ Pan thresholds: ${JSON.stringify(panThresholds)}`);
        
        const tapThresholds = gestureConfig.getTapThresholds();
        analysisResults.push(`   ✅ Tap thresholds: ${JSON.stringify(tapThresholds)}`);
      } catch (error) {
        analysisResults.push(`   🚨 Gesture config error: ${error}`);
      }
      
      // Test 2: Test GestureStateMachine creation
      analysisResults.push('\n2. Testing GestureStateMachine creation...');
      try {
        const gestureStateMachine = new GestureStateMachine(gestureSharedState);
        analysisResults.push(`   ✅ GestureStateMachine created successfully`);
        
        const stateChecker = createStateChecker(gestureSharedState);
        analysisResults.push(`   ✅ StateChecker created successfully`);
      } catch (error) {
        analysisResults.push(`   🚨 StateMachine creation error: ${error}`);
      }
      
      // Test 3: Test SharedValue assignments that happen during gestures
      analysisResults.push('\n3. Testing SharedValue assignments...');
      try {
        // Simulate typical gesture assignments
        gestureSharedState.value = GestureStateType.PAN_STARTING;
        analysisResults.push(`   ✅ Gesture state assignment: OK`);
        
        gestureStateIsActive.value = true;
        gestureStateVelocityX.value = 50;
        gestureStateVelocityY.value = -30;
        analysisResults.push(`   ✅ Gesture state values: OK`);
        
        // Test focal point assignments
        gestureStateFocalPointX.value = 200;
        gestureStateFocalPointY.value = 300;
        gestureStateHasFocalPoint.value = true;
        analysisResults.push(`   ✅ Focal point assignments: OK`);
        
        // Test JSON string assignments
        activeTouchAreasData.value = JSON.stringify([
          { id: 1, x: 100, y: 200, pressure: 0.5 }
        ]);
        analysisResults.push(`   ✅ JSON string assignments: OK`);
        
      } catch (error) {
        analysisResults.push(`   🚨 SharedValue assignment error: ${error}`);
      }
      
      // Test 4: Test the specific patterns that might cause crashes
      analysisResults.push('\n4. Testing crash-prone patterns...');
      try {
        // Test rapid state changes (what happens during gesture)
        for (let i = 0; i < 10; i++) {
          gestureSharedState.value = GestureStateType.PAN_ACTIVE;
          translateX.value = Math.random() * 100;
          translateY.value = Math.random() * 100;
          scale.value = 1 + Math.random() * 2;
        }
        analysisResults.push(`   ✅ Rapid state changes: OK`);
        
        // Test performance tracking updates
        performanceFrameCount.value = 60;
        performanceAvgFrameTime.value = 16.67;
        performanceLastFrameTime.value = Date.now();
        analysisResults.push(`   ✅ Performance tracking: OK`);
        
      } catch (error) {
        analysisResults.push(`   🚨 Pattern testing error: ${error}`);
      }
      
      // Test 5: Check if the issue is with specific gesture handler setup
      analysisResults.push('\n5. Testing gesture handler configuration...');
      try {
        // Test the configuration values that go into .activateAfterLongPress()
        const panConfig = gestureConfig.getPanThresholds();
        if (typeof panConfig.activationDelay !== 'number') {
          analysisResults.push(`   🚨 activationDelay is not a number: ${typeof panConfig.activationDelay} = ${panConfig.activationDelay}`);
        } else {
          analysisResults.push(`   ✅ activationDelay is valid number: ${panConfig.activationDelay}`);
        }
        
        if (panConfig.activationDelay < 0 || panConfig.activationDelay > 1000) {
          analysisResults.push(`   ⚠️  activationDelay seems unusual: ${panConfig.activationDelay}ms`);
        }
        
      } catch (error) {
        analysisResults.push(`   🚨 Gesture config validation error: ${error}`);
      }
      
      analysisResults.push('\n=== Analysis Complete ===');
      
      // Look for any potential issues
      const hasErrors = analysisResults.some(result => result.includes('🚨'));
      const hasWarnings = analysisResults.some(result => result.includes('⚠️'));
      
      if (hasErrors) {
        analysisResults.push('\n🚨 CRITICAL ISSUES FOUND - These may cause JSI crashes');
      } else if (hasWarnings) {
        analysisResults.push('\n⚠️  POTENTIAL ISSUES FOUND - Monitor these closely');
      } else {
        analysisResults.push('\n✅ NO OBVIOUS ISSUES FOUND');
        analysisResults.push('The crash may be happening at a deeper level in the gesture system.');
        analysisResults.push('Try: Disable .activateAfterLongPress() temporarily to isolate the issue.');
      }
      
    } catch (error) {
      analysisResults.push(`\n💥 ANALYZER CRASHED: ${error}`);
      analysisResults.push('This suggests the crash happens during component initialization.');
    }
    
    setResults(analysisResults);
    setIsRunning(false);
    
    // Show summary alert
    const errorCount = analysisResults.filter(r => r.includes('🚨')).length;
    const warningCount = analysisResults.filter(r => r.includes('⚠️')).length;
    
    Alert.alert(
      'Analysis Complete',
      errorCount > 0 
        ? `Found ${errorCount} critical issues that may cause JSI crashes`
        : warningCount > 0
        ? `Found ${warningCount} potential issues to investigate`
        : 'No obvious issues found. The crash may be deeper in the gesture system.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View className="flex-1 bg-background p-4">
      <Text className="text-text text-xl font-bold mb-4">
        Galaxy Map Crash Analyzer
      </Text>

      <Text className="text-text/80 text-sm mb-4">
        This analyzer replicates the exact SharedValues and patterns from GalaxyMapView
        to identify what's causing the immediate crash when opening the Galaxy Map.
      </Text>

      <TouchableOpacity
        onPress={runAnalysis}
        disabled={isRunning}
        className={`${isRunning ? 'bg-gray-500' : 'bg-blue-500'} px-4 py-3 rounded-lg mb-4`}
      >
        <Text className="text-white font-semibold text-center">
          {isRunning ? 'Analyzing Galaxy Map Components...' : 'Analyze Galaxy Map JSI Issues'}
        </Text>
      </TouchableOpacity>

      <ScrollView className="flex-1 bg-surface rounded-lg p-3">
        {results.length > 0 ? (
          results.map((result, index) => (
            <Text key={index} className="text-text/90 text-xs font-mono mb-1">
              {result}
            </Text>
          ))
        ) : (
          <Text className="text-text/60 text-sm text-center">
            Run analysis to identify Galaxy Map JSI crash sources...
          </Text>
        )}
      </ScrollView>
    </View>
  );
};

export default GalaxyMapCrashAnalyzer;