/**
 * Comprehensive SharedValue Crash Tester
 * 
 * This component systematically tests all SharedValue objects in the app
 * to identify JSI serialization issues before they cause crashes.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import {
  analyzeSharedValue,
  testSharedValueSafety,
  generateAnalysisReport,
  AnalysisResult
} from './SharedValueAnalyzer';

export const SharedValueCrashTester: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<string>('');
  const [progress, setProgress] = useState('');

  // Create test SharedValues that mirror the ones in GalaxyMapView
  const testGestureStateIsActive = useSharedValue(false);
  const testGestureStateVelocityX = useSharedValue(0);
  const testGestureStateVelocityY = useSharedValue(0);
  const testGestureStateFocalPoint = useSharedValue('');
  
  const testTranslateX = useSharedValue(0);
  const testTranslateY = useSharedValue(0);
  const testScale = useSharedValue(1);
  const testTouchCount = useSharedValue(0);
  
  // Test SharedValues from JSICrashTester
  const testComplexNestedData = useSharedValue('test');
  const testComplexArrayData = useSharedValue('[1,2,3]');

  // Create some intentionally problematic SharedValues for testing
  const problematicObjectValue = useSharedValue({ shouldFail: true });
  const problematicArrayValue = useSharedValue([{ id: 1 }, { id: 2 }]);

  const runComprehensiveTest = async () => {
    setIsRunning(true);
    setResults('');
    setProgress('Starting comprehensive SharedValue analysis...');

    const allResults: AnalysisResult[] = [];

    const testSharedValues = [
      { name: 'gestureStateIsActive', sharedValue: testGestureStateIsActive },
      { name: 'gestureStateVelocityX', sharedValue: testGestureStateVelocityX },
      { name: 'gestureStateVelocityY', sharedValue: testGestureStateVelocityY },
      { name: 'gestureStateFocalPoint', sharedValue: testGestureStateFocalPoint },
      { name: 'translateX', sharedValue: testTranslateX },
      { name: 'translateY', sharedValue: testTranslateY },
      { name: 'scale', sharedValue: testScale },
      { name: 'touchCount', sharedValue: testTouchCount },
      { name: 'complexNestedData', sharedValue: testComplexNestedData },
      { name: 'complexArrayData', sharedValue: testComplexArrayData },
      { name: 'problematicObject', sharedValue: problematicObjectValue },
      { name: 'problematicArray', sharedValue: problematicArrayValue },
    ];

    let completedTests = 0;
    const totalTests = testSharedValues.length;

    for (const { name, sharedValue } of testSharedValues) {
      setProgress(`Testing ${name} (${completedTests + 1}/${totalTests})...`);

      try {
        // First, analyze current values
        const analysis = await analyzeSharedValue(name, sharedValue);
        console.log(`Analysis for ${name}:`, analysis);

        // Then run safety tests
        const testResult = await testSharedValueSafety(name, sharedValue);
        allResults.push(testResult);

        completedTests++;
        setProgress(`Completed ${completedTests}/${totalTests} tests`);

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error testing ${name}:`, error);
        // Add error result
        allResults.push({
          passed: [],
          failed: [],
          errors: [{
            test: {
              name: `${name} - Error during testing`,
              sharedValue,
              testValue: 'N/A',
              expectedToFail: false,
              reason: 'Testing failed'
            },
            error: String(error)
          }]
        });
        completedTests++;
      }
    }

    // Generate comprehensive report
    const report = generateAnalysisReport(allResults);
    setResults(report);
    setProgress('Analysis complete!');
    setIsRunning(false);

    // Show alert with summary
    const totalErrors = allResults.reduce((sum, r) => sum + r.errors.length, 0);
    const totalFailed = allResults.reduce((sum, r) => sum + r.failed.length, 0);

    if (totalErrors > 0) {
      Alert.alert(
        '🚨 Critical Issues Found!',
        `Found ${totalErrors} SharedValues that will cause crashes. Check the detailed report below.`,
        [{ text: 'OK' }]
      );
    } else if (totalFailed > 0) {
      Alert.alert(
        '⚠️ Unexpected Results',
        `Found ${totalFailed} unexpected test results. Some fixes may not be working correctly.`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        '✅ All Tests Passed!',
        'No JSI crash issues detected in SharedValues.',
        [{ text: 'Great!' }]
      );
    }
  };

  const runQuickScan = async () => {
    setIsRunning(true);
    setResults('');
    setProgress('Running quick scan for existing issues...');

    const quickResults: string[] = [];

    const testSharedValues = [
      { name: 'gestureStateIsActive', sharedValue: testGestureStateIsActive },
      { name: 'gestureStateVelocityX', sharedValue: testGestureStateVelocityX },
      { name: 'gestureStateVelocityY', sharedValue: testGestureStateVelocityY },
      { name: 'gestureStateFocalPoint', sharedValue: testGestureStateFocalPoint },
      { name: 'translateX', sharedValue: testTranslateX },
      { name: 'translateY', sharedValue: testTranslateY },
      { name: 'scale', sharedValue: testScale },
      { name: 'touchCount', sharedValue: testTouchCount },
      { name: 'complexNestedData', sharedValue: testComplexNestedData },
      { name: 'complexArrayData', sharedValue: testComplexArrayData },
      { name: 'problematicObject', sharedValue: problematicObjectValue },
      { name: 'problematicArray', sharedValue: problematicArrayValue },
    ];

    for (const { name, sharedValue } of testSharedValues) {
      try {
        const analysis = await analyzeSharedValue(name, sharedValue);
        
        if (analysis.isProblematic) {
          quickResults.push(`🚨 ${name}: ${analysis.issues.join(', ')}`);
          quickResults.push(`   Recommendations: ${analysis.recommendations.join(', ')}`);
        } else {
          quickResults.push(`✅ ${name}: Safe`);
        }
      } catch (error) {
        quickResults.push(`❌ ${name}: Error - ${error}`);
      }
    }

    setResults(quickResults.join('\n'));
    setProgress('Quick scan complete!');
    setIsRunning(false);
  };

  return (
    <View className="flex-1 bg-background p-4">
      <Text className="text-text text-xl font-bold mb-4">
        SharedValue JSI Crash Analyzer
      </Text>

      <Text className="text-text/80 text-sm mb-4">
        This tool systematically tests SharedValue objects to identify potential JSI crashes 
        before they happen in production. Run tests to find serialization issues.
      </Text>

      <View className="flex-row mb-4 space-x-2">
        <TouchableOpacity
          onPress={runQuickScan}
          disabled={isRunning}
          className={`${isRunning ? 'bg-gray-500' : 'bg-blue-500'} px-4 py-3 rounded-lg flex-1`}
        >
          <Text className="text-white font-semibold text-center">
            Quick Scan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={runComprehensiveTest}
          disabled={isRunning}
          className={`${isRunning ? 'bg-gray-500' : 'bg-red-500'} px-4 py-3 rounded-lg flex-1`}
        >
          <Text className="text-white font-semibold text-center">
            Full Analysis
          </Text>
        </TouchableOpacity>
      </View>

      {progress && (
        <View className="bg-surface rounded-lg p-3 mb-4">
          <Text className="text-primary text-sm font-medium">
            {progress}
          </Text>
        </View>
      )}

      <ScrollView className="flex-1 bg-surface rounded-lg p-3">
        {results ? (
          <Text className="text-text/90 text-xs font-mono">
            {results}
          </Text>
        ) : (
          <Text className="text-text/60 text-sm text-center">
            Run a test to see results here...
          </Text>
        )}
      </ScrollView>

      <View className="mt-4 bg-orange-900/30 rounded-lg p-3">
        <Text className="text-orange-400 text-xs">
          <Text className="font-bold">Note:</Text> This tool tests for common JSI crash patterns.
          The "Full Analysis" performs actual SharedValue assignments in worklets to detect crashes.
          Use in development only.
        </Text>
      </View>
    </View>
  );
};

export default SharedValueCrashTester;