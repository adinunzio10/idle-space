/**
 * SharedValue JSI Crash Analyzer
 * 
 * Systematically tests all SharedValue objects in the app to identify
 * potential JSI serialization crashes before they happen in production.
 */

import { SharedValue, runOnUI, runOnJS } from 'react-native-reanimated';

export interface SharedValueTest {
  name: string;
  sharedValue: SharedValue<any>;
  testValue: any;
  expectedToFail: boolean;
  reason: string;
}

export interface AnalysisResult {
  passed: SharedValueTest[];
  failed: SharedValueTest[];
  errors: Array<{
    test: SharedValueTest;
    error: string;
  }>;
}

/**
 * Test cases that are known to cause JSI crashes
 */
export const PROBLEMATIC_TEST_CASES = [
  {
    name: 'Complex Object',
    value: { nested: { data: 'test' }, array: [1, 2, 3] },
    reason: 'Objects cannot be serialized across worklet boundaries'
  },
  {
    name: 'Array with Objects',
    value: [{ id: 1 }, { id: 2 }],
    reason: 'Arrays containing objects cause serialization errors'
  },
  {
    name: 'Function Reference',
    value: () => console.log('test'),
    reason: 'Functions cannot be serialized'
  },
  {
    name: 'Date Object',
    value: new Date(),
    reason: 'Date objects are not serializable'
  },
  {
    name: 'RegExp Object',
    value: /test/g,
    reason: 'RegExp objects are not serializable'
  },
  {
    name: 'Map Object',
    value: new Map([['key', 'value']]),
    reason: 'Map objects are not serializable'
  },
  {
    name: 'Set Object',
    value: new Set([1, 2, 3]),
    reason: 'Set objects are not serializable'
  }
];

/**
 * Safe test cases that should work
 */
export const SAFE_TEST_CASES = [
  {
    name: 'String Value',
    value: 'test string',
    reason: 'Strings are primitive and safe'
  },
  {
    name: 'Number Value',
    value: 42,
    reason: 'Numbers are primitive and safe'
  },
  {
    name: 'Boolean Value',
    value: true,
    reason: 'Booleans are primitive and safe'
  },
  {
    name: 'JSON String',
    value: '{"nested": {"data": "test"}, "array": [1, 2, 3]}',
    reason: 'JSON strings can represent complex data safely'
  },
  {
    name: 'Serialized Array',
    value: '[1, 2, 3]',
    reason: 'JSON stringified arrays are safe'
  }
];

/**
 * Analyzes a SharedValue for potential JSI issues
 */
export async function analyzeSharedValue(
  name: string, 
  sharedValue: SharedValue<any>
): Promise<{
  name: string;
  currentValue: any;
  valueType: string;
  isProblematic: boolean;
  issues: string[];
  recommendations: string[];
}> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  try {
    const currentValue = sharedValue.value;
    const valueType = Array.isArray(currentValue) 
      ? `Array[${currentValue.length}]`
      : typeof currentValue;
    
    // Check for complex objects
    if (typeof currentValue === 'object' && currentValue !== null) {
      if (Array.isArray(currentValue)) {
        issues.push('Contains array - arrays with objects can cause crashes');
        recommendations.push('Use JSON.stringify() for array data');
        
        // Check array contents
        const hasObjects = currentValue.some(item => 
          typeof item === 'object' && item !== null
        );
        if (hasObjects) {
          issues.push('Array contains objects - high crash risk');
        }
      } else if (currentValue instanceof Date) {
        issues.push('Contains Date object - not serializable');
        recommendations.push('Store date as timestamp number or ISO string');
      } else if (currentValue instanceof RegExp) {
        issues.push('Contains RegExp - not serializable');
        recommendations.push('Store regex pattern as string');
      } else if (currentValue instanceof Map || currentValue instanceof Set) {
        issues.push('Contains Map/Set - not serializable');
        recommendations.push('Use JSON-serializable alternatives');
      } else {
        // Generic object
        issues.push('Contains object - potential serialization issues');
        recommendations.push('Replace with primitive values or JSON string');
        
        // Check for nested complexity
        try {
          JSON.stringify(currentValue);
        } catch (e) {
          issues.push('Object contains non-serializable properties');
        }
      }
    }
    
    // Check for functions
    if (typeof currentValue === 'function') {
      issues.push('Contains function - cannot be serialized');
      recommendations.push('Remove function references from SharedValues');
    }
    
    return {
      name,
      currentValue,
      valueType,
      isProblematic: issues.length > 0,
      issues,
      recommendations
    };
    
  } catch (error) {
    return {
      name,
      currentValue: 'ERROR_READING_VALUE',
      valueType: 'ERROR',
      isProblematic: true,
      issues: [`Failed to read value: ${error}`],
      recommendations: ['Check if SharedValue is properly initialized']
    };
  }
}

/**
 * Tests a SharedValue with various potentially problematic values
 */
export async function testSharedValueSafety(
  name: string,
  sharedValue: SharedValue<any>
): Promise<AnalysisResult> {
  const results: AnalysisResult = {
    passed: [],
    failed: [],
    errors: []
  };
  
  // Test with problematic values
  for (const testCase of PROBLEMATIC_TEST_CASES) {
    const test: SharedValueTest = {
      name: `${name} - ${testCase.name}`,
      sharedValue,
      testValue: testCase.value,
      expectedToFail: true,
      reason: testCase.reason
    };
    
    try {
      await new Promise<void>((resolve, reject) => {
        runOnUI(() => {
          'worklet';
          try {
            sharedValue.value = testCase.value;
            // If we get here without crashing, it's unexpected
            runOnJS(resolve)();
          } catch (error) {
            // Expected to fail, so this is good
            runOnJS(reject)(error);
          }
        })();
        
        // Timeout after 1 second
        setTimeout(() => reject(new Error('Test timeout')), 1000);
      });
      
      // If we reach here, the test unexpectedly passed
      results.failed.push(test);
      
    } catch (error) {
      // Expected to fail
      results.passed.push(test);
    }
  }
  
  // Test with safe values
  for (const testCase of SAFE_TEST_CASES) {
    const test: SharedValueTest = {
      name: `${name} - ${testCase.name}`,
      sharedValue,
      testValue: testCase.value,
      expectedToFail: false,
      reason: testCase.reason
    };
    
    try {
      await new Promise<void>((resolve, reject) => {
        runOnUI(() => {
          'worklet';
          try {
            sharedValue.value = testCase.value;
            runOnJS(resolve)();
          } catch (error) {
            runOnJS(reject)(error);
          }
        })();
        
        setTimeout(() => reject(new Error('Test timeout')), 1000);
      });
      
      // Expected to pass
      results.passed.push(test);
      
    } catch (error) {
      // Unexpected failure
      results.errors.push({
        test,
        error: String(error)
      });
    }
  }
  
  return results;
}

/**
 * Comprehensive report generator
 */
export function generateAnalysisReport(results: AnalysisResult[]): string {
  let report = '=== SharedValue JSI Crash Analysis Report ===\n\n';
  
  const totalTests = results.reduce((sum, r) => 
    sum + r.passed.length + r.failed.length + r.errors.length, 0
  );
  
  const totalPassed = results.reduce((sum, r) => sum + r.passed.length, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed.length, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  
  report += `Total Tests: ${totalTests}\n`;
  report += `Passed: ${totalPassed}\n`;
  report += `Failed: ${totalFailed}\n`;
  report += `Errors: ${totalErrors}\n\n`;
  
  if (totalErrors > 0) {
    report += '🚨 CRITICAL ISSUES (Will cause crashes):\n';
    results.forEach(result => {
      result.errors.forEach(error => {
        report += `  - ${error.test.name}: ${error.error}\n`;
        report += `    Reason: ${error.test.reason}\n`;
      });
    });
    report += '\n';
  }
  
  if (totalFailed > 0) {
    report += '⚠️  UNEXPECTED FAILURES:\n';
    results.forEach(result => {
      result.failed.forEach(test => {
        report += `  - ${test.name}: Expected to fail but didn't\n`;
        report += `    This suggests the fix may not be working correctly\n`;
      });
    });
    report += '\n';
  }
  
  report += '✅ RECOMMENDATIONS:\n';
  report += '1. Replace all complex objects in SharedValues with primitives\n';
  report += '2. Use JSON.stringify() for complex data storage\n';
  report += '3. Store arrays as JSON strings: JSON.stringify([1,2,3])\n';
  report += '4. Store objects as JSON strings: JSON.stringify({key: "value"})\n';
  report += '5. Use primitive values (string, number, boolean) whenever possible\n\n';
  
  return report;
}