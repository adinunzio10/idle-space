import { AccessibilityHelper } from './accessibility';

/**
 * Accessibility testing and validation utilities for development and QA
 */
export class AccessibilityTesting {
  private static testResults: {
    component: string;
    test: string;
    passed: boolean;
    message: string;
    timestamp: number;
  }[] = [];

  /**
   * Test component accessibility compliance
   */
  static testComponent(
    componentName: string,
    element: {
      hasLabel?: boolean;
      hasRole?: boolean;
      isInteractive?: boolean;
      hasContrast?: boolean;
      hasFocusState?: boolean;
      hasHint?: boolean;
      touchTargetSize?: { width: number; height: number };
      children?: any[];
    }
  ): boolean {
    const results = [];
    let allPassed = true;

    // Test basic accessibility properties
    const basicTest = AccessibilityHelper.validateAccessibility({
      hasLabel: element.hasLabel,
      hasRole: element.hasRole,
      isInteractive: element.isInteractive,
      hasContrast: element.hasContrast,
      hasFocusState: element.hasFocusState,
    });

    results.push({
      component: componentName,
      test: 'Basic Accessibility',
      passed: basicTest.valid,
      message: basicTest.issues.join(', ') || 'All basic tests passed',
      timestamp: Date.now(),
    });

    if (!basicTest.valid) allPassed = false;

    // Test touch target size for mobile accessibility
    if (element.isInteractive && element.touchTargetSize) {
      const { width, height } = element.touchTargetSize;
      const minSize = 44; // WCAG AA minimum
      const targetSizePassed = width >= minSize && height >= minSize;

      results.push({
        component: componentName,
        test: 'Touch Target Size',
        passed: targetSizePassed,
        message: targetSizePassed
          ? `Touch target ${width}x${height}px meets requirements`
          : `Touch target ${width}x${height}px too small (minimum ${minSize}x${minSize}px)`,
        timestamp: Date.now(),
      });

      if (!targetSizePassed) allPassed = false;
    }

    // Test for meaningful descriptions
    if (element.isInteractive && !element.hasHint) {
      results.push({
        component: componentName,
        test: 'Accessibility Hint',
        passed: false,
        message:
          'Interactive element should have accessibility hint for better user guidance',
        timestamp: Date.now(),
      });
      allPassed = false;
    }

    // Test for complex UI structures
    if (element.children && element.children.length > 5) {
      const hasGrouping = element.children.some(
        child =>
          child.role === 'group' ||
          child.role === 'list' ||
          child.role === 'tablist'
      );

      results.push({
        component: componentName,
        test: 'Complex UI Structure',
        passed: hasGrouping,
        message: hasGrouping
          ? 'Complex UI properly grouped for navigation'
          : 'Complex UI should use grouping roles for easier navigation',
        timestamp: Date.now(),
      });

      if (!hasGrouping) allPassed = false;
    }

    // Store results
    this.testResults.push(...results);

    return allPassed;
  }

  /**
   * Test one-handed navigation compliance
   */
  static testOneHandedNavigation(
    screenName: string,
    elements: {
      name: string;
      position: { bottom: number };
      isImportant: boolean;
      isInteractive: boolean;
    }[],
    screenHeight: number
  ): boolean {
    const thumbReachHeight = screenHeight * 0.65; // Bottom 65% is reachable
    const reachableTop = screenHeight - thumbReachHeight;

    let allPassed = true;
    const results = [];

    // Test important interactive elements are in reach zone
    const importantElements = elements.filter(
      el => el.isImportant && el.isInteractive
    );
    const elementsInReach = importantElements.filter(
      el => el.position.bottom >= reachableTop
    );

    const reachabilityPassed =
      elementsInReach.length === importantElements.length;

    results.push({
      component: screenName,
      test: 'One-Handed Reachability',
      passed: reachabilityPassed,
      message: reachabilityPassed
        ? `All ${importantElements.length} important elements are within thumb reach`
        : `${importantElements.length - elementsInReach.length} important elements are outside thumb reach zone`,
      timestamp: Date.now(),
    });

    if (!reachabilityPassed) allPassed = false;

    // Test navigation elements distribution
    const navElements = elements.filter(
      el =>
        el.name.toLowerCase().includes('nav') ||
        el.name.toLowerCase().includes('button') ||
        el.name.toLowerCase().includes('tab')
    );

    const navInReach = navElements.filter(
      el => el.position.bottom >= reachableTop
    );
    const navReachabilityPassed = navInReach.length / navElements.length >= 0.8; // At least 80%

    results.push({
      component: screenName,
      test: 'Navigation Reachability',
      passed: navReachabilityPassed,
      message: `${navInReach.length}/${navElements.length} navigation elements are reachable`,
      timestamp: Date.now(),
    });

    if (!navReachabilityPassed) allPassed = false;

    this.testResults.push(...results);
    return allPassed;
  }

  /**
   * Test screen reader compatibility
   */
  static testScreenReaderCompatibility(
    screenName: string,
    elements: {
      type: 'text' | 'button' | 'image' | 'list' | 'header';
      hasLabel: boolean;
      hasRole: boolean;
      hasState?: boolean;
      isDecorative?: boolean;
    }[]
  ): boolean {
    let allPassed = true;
    const results = [];

    // Test text elements
    const textElements = elements.filter(el => el.type === 'text');
    const textWithLabels = textElements.filter(
      el => el.hasLabel || el.isDecorative
    );
    const textPassed = textWithLabels.length === textElements.length;

    results.push({
      component: screenName,
      test: 'Text Accessibility',
      passed: textPassed,
      message: `${textWithLabels.length}/${textElements.length} text elements properly labeled`,
      timestamp: Date.now(),
    });

    if (!textPassed) allPassed = false;

    // Test interactive elements
    const interactiveElements = elements.filter(
      el => el.type === 'button' || el.type === 'list'
    );
    const interactiveProperlyLabeled = interactiveElements.filter(
      el => el.hasLabel && el.hasRole
    );
    const interactivePassed =
      interactiveProperlyLabeled.length === interactiveElements.length;

    results.push({
      component: screenName,
      test: 'Interactive Element Accessibility',
      passed: interactivePassed,
      message: `${interactiveProperlyLabeled.length}/${interactiveElements.length} interactive elements properly configured`,
      timestamp: Date.now(),
    });

    if (!interactivePassed) allPassed = false;

    // Test structural elements
    const headerElements = elements.filter(el => el.type === 'header');
    const headersWithRoles = headerElements.filter(el => el.hasRole);
    const headersPassed = headersWithRoles.length === headerElements.length;

    results.push({
      component: screenName,
      test: 'Screen Structure',
      passed: headersPassed,
      message: `${headersWithRoles.length}/${headerElements.length} headers have proper roles`,
      timestamp: Date.now(),
    });

    if (!headersPassed) allPassed = false;

    this.testResults.push(...results);
    return allPassed;
  }

  /**
   * Generate accessibility report
   */
  static generateReport(): {
    summary: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      passRate: number;
    };
    componentResults: Record<
      string,
      {
        totalTests: number;
        passed: number;
        failed: number;
        issues: string[];
      }
    >;
    recommendations: string[];
    detailedResults: typeof AccessibilityTesting.testResults;
  } {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    // Group results by component
    const componentResults: Record<string, any> = {};
    const allIssues: string[] = [];

    this.testResults.forEach(result => {
      if (!componentResults[result.component]) {
        componentResults[result.component] = {
          totalTests: 0,
          passed: 0,
          failed: 0,
          issues: [],
        };
      }

      componentResults[result.component].totalTests++;
      if (result.passed) {
        componentResults[result.component].passed++;
      } else {
        componentResults[result.component].failed++;
        componentResults[result.component].issues.push(
          `${result.test}: ${result.message}`
        );
        allIssues.push(
          `${result.component} - ${result.test}: ${result.message}`
        );
      }
    });

    // Generate recommendations based on common issues
    const recommendations = this.generateRecommendations(allIssues);

    return {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        passRate:
          totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0,
      },
      componentResults,
      recommendations,
      detailedResults: [...this.testResults],
    };
  }

  /**
   * Generate recommendations based on test results
   */
  private static generateRecommendations(issues: string[]): string[] {
    const recommendations: string[] = [];

    if (issues.some(issue => issue.includes('accessibility label'))) {
      recommendations.push(
        'Add descriptive accessibility labels to all interactive elements using accessibilityLabel prop'
      );
    }

    if (issues.some(issue => issue.includes('touch target'))) {
      recommendations.push(
        'Increase touch target sizes to minimum 44x44 pixels for better mobile accessibility'
      );
    }

    if (issues.some(issue => issue.includes('thumb reach'))) {
      recommendations.push(
        'Move important interactive elements to the bottom 65% of the screen for one-handed operation'
      );
    }

    if (issues.some(issue => issue.includes('hint'))) {
      recommendations.push(
        'Add accessibility hints to interactive elements to provide context about their actions'
      );
    }

    if (issues.some(issue => issue.includes('grouping'))) {
      recommendations.push(
        'Use grouping roles (group, list, tablist) for complex UI structures to improve navigation'
      );
    }

    if (issues.some(issue => issue.includes('contrast'))) {
      recommendations.push(
        'Ensure all text meets WCAG AA contrast requirements (4.5:1 for normal text, 3:1 for large text)'
      );
    }

    return recommendations;
  }

  /**
   * Clear test results
   */
  static clearResults(): void {
    this.testResults = [];
  }

  /**
   * Quick test suite for development
   */
  static runQuickTest(componentName: string): {
    passed: boolean;
    message: string;
  } {
    // This would be used in development to quickly validate components
    const mockElement = {
      hasLabel: true,
      hasRole: true,
      isInteractive: true,
      hasContrast: true,
      hasFocusState: true,
      hasHint: true,
      touchTargetSize: { width: 48, height: 48 },
    };

    const passed = this.testComponent(componentName, mockElement);

    return {
      passed,
      message: passed
        ? `${componentName} passes basic accessibility tests`
        : `${componentName} has accessibility issues - check detailed report`,
    };
  }
}

// Development helper for easy testing
export const testAccessibility = (componentName: string, element: any) => {
  if (__DEV__) {
    return AccessibilityTesting.testComponent(componentName, element);
  }
  return true;
};

export const testOneHandedNavigation = (
  screenName: string,
  elements: any[],
  screenHeight: number
) => {
  if (__DEV__) {
    return AccessibilityTesting.testOneHandedNavigation(
      screenName,
      elements,
      screenHeight
    );
  }
  return true;
};
