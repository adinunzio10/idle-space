/**
 * Performance Budget Manager
 * 
 * Implements performance budgets and component architecture review system
 * to enforce performance constraints and optimize component structure for
 * the galaxy map system.
 */

/**
 * Performance budget configuration
 */
export interface PerformanceBudget {
  name: string;
  frameTime: {
    budget: number; // milliseconds
    warning: number; // threshold for warning
    critical: number; // threshold for critical alert
  };
  interactionDelay: {
    budget: number; // milliseconds
    warning: number;
    critical: number;
  };
  memoryUsage: {
    budget: number; // MB
    warning: number;
    critical: number;
  };
  bundleSize: {
    budget: number; // KB
    warning: number;
    critical: number;
  };
  renderCount: {
    budget: number; // renders per second
    warning: number;
    critical: number;
  };
  networkRequests: {
    budget: number; // requests per minute
    warning: number;
    critical: number;
  };
  customMetrics: Record<string, {
    budget: number;
    warning: number;
    critical: number;
    unit: string;
  }>;
}

/**
 * Performance budget violation
 */
export interface BudgetViolation {
  id: string;
  budgetName: string;
  metric: string;
  currentValue: number;
  budgetValue: number;
  severity: 'warning' | 'critical';
  timestamp: number;
  component?: string;
  suggestion: string;
  impact: string;
}

/**
 * Component architecture issue
 */
export interface ComponentArchitectureIssue {
  id: string;
  type: 'prop-drilling' | 'missing-memo' | 'inefficient-reconciliation' | 'excessive-nesting' | 'large-bundle' | 'circular-dependency';
  component: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: string;
  suggestedFix: string;
  codeExample: string;
  detectedAt: number;
  metadata: Record<string, any>;
}

/**
 * Component performance profile
 */
export interface ComponentPerformanceProfile {
  name: string;
  renderTime: number;
  renderCount: number;
  memoryUsage: number;
  bundleSize: number;
  dependencies: string[];
  children: string[];
  props: {
    count: number;
    complexity: 'low' | 'medium' | 'high';
  };
  state: {
    count: number;
    complexity: 'low' | 'medium' | 'high';
  };
  hooks: string[];
  issues: ComponentArchitectureIssue[];
  optimizationScore: number; // 0-100
}

/**
 * Performance budget report
 */
export interface PerformanceBudgetReport {
  budgetName: string;
  violations: BudgetViolation[];
  compliance: number; // 0-100 percentage
  recommendations: string[];
  componentProfiles: ComponentPerformanceProfile[];
  architectureIssues: ComponentArchitectureIssue[];
  summary: {
    totalViolations: number;
    criticalViolations: number;
    warningViolations: number;
    averageOptimizationScore: number;
    worstPerformingComponents: string[];
  };
}

/**
 * Default performance budgets for different contexts
 */
export const DEFAULT_PERFORMANCE_BUDGETS = {
  mobile: {
    name: 'Mobile Performance Budget',
    frameTime: { budget: 16.67, warning: 20, critical: 33 },
    interactionDelay: { budget: 100, warning: 200, critical: 500 },
    memoryUsage: { budget: 50, warning: 75, critical: 100 },
    bundleSize: { budget: 500, warning: 750, critical: 1000 },
    renderCount: { budget: 60, warning: 80, critical: 100 },
    networkRequests: { budget: 30, warning: 50, critical: 100 },
    customMetrics: {
      'svgNodes': { budget: 500, warning: 750, critical: 1000, unit: 'nodes' },
      'eventListeners': { budget: 50, warning: 75, critical: 100, unit: 'listeners' },
      'activeAnimations': { budget: 10, warning: 15, critical: 25, unit: 'animations' },
    },
  },
  desktop: {
    name: 'Desktop Performance Budget',
    frameTime: { budget: 16.67, warning: 18, critical: 25 },
    interactionDelay: { budget: 50, warning: 100, critical: 200 },
    memoryUsage: { budget: 100, warning: 150, critical: 250 },
    bundleSize: { budget: 1000, warning: 1500, critical: 2000 },
    renderCount: { budget: 60, warning: 70, critical: 90 },
    networkRequests: { budget: 60, warning: 100, critical: 200 },
    customMetrics: {
      'svgNodes': { budget: 1000, warning: 1500, critical: 2000, unit: 'nodes' },
      'eventListeners': { budget: 100, warning: 150, critical: 200, unit: 'listeners' },
      'activeAnimations': { budget: 20, warning: 30, critical: 50, unit: 'animations' },
    },
  },
  galaxyMap: {
    name: 'Galaxy Map Performance Budget',
    frameTime: { budget: 16.67, warning: 20, critical: 33 },
    interactionDelay: { budget: 50, warning: 100, critical: 200 },
    memoryUsage: { budget: 75, warning: 100, critical: 150 },
    bundleSize: { budget: 800, warning: 1200, critical: 1500 },
    renderCount: { budget: 60, warning: 80, critical: 100 },
    networkRequests: { budget: 10, warning: 20, critical: 50 },
    customMetrics: {
      'visibleBeacons': { budget: 500, warning: 750, critical: 1000, unit: 'beacons' },
      'activeConnections': { budget: 1000, warning: 1500, critical: 2000, unit: 'connections' },
      'renderLayers': { budget: 8, warning: 12, critical: 16, unit: 'layers' },
      'gestureHandlers': { budget: 5, warning: 8, critical: 12, unit: 'handlers' },
    },
  },
} as const;

/**
 * Performance Budget Manager Class
 */
export class PerformanceBudgetManager {
  private isMonitoring = false;
  private currentBudget: PerformanceBudget;
  private violations: BudgetViolation[] = [];
  private componentProfiles = new Map<string, ComponentPerformanceProfile>();
  private architectureIssues: ComponentArchitectureIssue[] = [];
  
  // Monitoring intervals
  private budgetMonitor?: NodeJS.Timeout;
  private architectureAnalyzer?: NodeJS.Timeout;

  constructor(budget: PerformanceBudget = DEFAULT_PERFORMANCE_BUDGETS.galaxyMap) {
    this.currentBudget = budget;
  }

  /**
   * Start performance budget monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      console.warn('[PerformanceBudgetManager] Already monitoring');
      return;
    }

    console.log(`[PerformanceBudgetManager] Starting monitoring with budget: ${this.currentBudget.name}`);
    this.isMonitoring = true;
    
    // Clear previous data
    this.violations = [];
    this.componentProfiles.clear();
    this.architectureIssues = [];
    
    // Start budget monitoring
    this.startBudgetMonitoring();
    
    // Start architecture analysis
    this.startArchitectureAnalysis();
  }

  /**
   * Stop monitoring and generate report
   */
  stopMonitoring(): PerformanceBudgetReport {
    if (!this.isMonitoring) {
      throw new Error('Not currently monitoring');
    }

    console.log('[PerformanceBudgetManager] Stopping monitoring and generating report');
    this.isMonitoring = false;
    
    // Stop monitoring
    this.stopBudgetMonitoring();
    this.stopArchitectureAnalysis();
    
    // Generate comprehensive report
    return this.generateReport();
  }

  /**
   * Set performance budget
   */
  setBudget(budget: PerformanceBudget): void {
    this.currentBudget = budget;
    console.log(`[PerformanceBudgetManager] Budget updated to: ${budget.name}`);
  }

  /**
   * Track component performance
   */
  trackComponentPerformance(
    componentName: string,
    metrics: {
      renderTime?: number;
      renderCount?: number;
      memoryUsage?: number;
      bundleSize?: number;
      dependencies?: string[];
      propsCount?: number;
      stateCount?: number;
      hooks?: string[];
    }
  ): void {
    if (!this.isMonitoring) return;

    let profile = this.componentProfiles.get(componentName);
    if (!profile) {
      profile = {
        name: componentName,
        renderTime: 0,
        renderCount: 0,
        memoryUsage: 0,
        bundleSize: 0,
        dependencies: [],
        children: [],
        props: { count: 0, complexity: 'low' },
        state: { count: 0, complexity: 'low' },
        hooks: [],
        issues: [],
        optimizationScore: 100,
      };
      this.componentProfiles.set(componentName, profile);
    }

    // Update metrics
    if (metrics.renderTime !== undefined) {
      profile.renderTime = Math.max(profile.renderTime, metrics.renderTime);
    }
    if (metrics.renderCount !== undefined) {
      profile.renderCount += metrics.renderCount;
    }
    if (metrics.memoryUsage !== undefined) {
      profile.memoryUsage = Math.max(profile.memoryUsage, metrics.memoryUsage);
    }
    if (metrics.bundleSize !== undefined) {
      profile.bundleSize = metrics.bundleSize;
    }
    if (metrics.dependencies) {
      profile.dependencies = [...new Set([...profile.dependencies, ...metrics.dependencies])];
    }
    if (metrics.propsCount !== undefined) {
      profile.props.count = metrics.propsCount;
      profile.props.complexity = metrics.propsCount > 20 ? 'high' : metrics.propsCount > 10 ? 'medium' : 'low';
    }
    if (metrics.stateCount !== undefined) {
      profile.state.count = metrics.stateCount;
      profile.state.complexity = metrics.stateCount > 10 ? 'high' : metrics.stateCount > 5 ? 'medium' : 'low';
    }
    if (metrics.hooks) {
      profile.hooks = [...new Set([...profile.hooks, ...metrics.hooks])];
    }

    // Analyze for immediate issues
    this.analyzeComponentProfile(profile);
  }

  /**
   * Check metric against budget
   */
  checkBudget(
    metric: string,
    value: number,
    component?: string,
    customBudget?: { budget: number; warning: number; critical: number }
  ): void {
    if (!this.isMonitoring) return;

    const budget = customBudget || this.getBudgetForMetric(metric);
    if (!budget) return;

    let severity: 'warning' | 'critical' | null = null;
    if (value >= budget.critical) {
      severity = 'critical';
    } else if (value >= budget.warning) {
      severity = 'warning';
    }

    if (severity) {
      this.addBudgetViolation({
        budgetName: this.currentBudget.name,
        metric,
        currentValue: value,
        budgetValue: budget.budget,
        severity,
        component,
        suggestion: this.generateSuggestionForMetric(metric, value, budget.budget),
        impact: this.generateImpactForMetric(metric, severity),
      });
    }
  }

  /**
   * Start budget monitoring
   */
  private startBudgetMonitoring(): void {
    this.budgetMonitor = setInterval(() => {
      if (!this.isMonitoring) return;

      // Monitor global performance metrics
      this.checkGlobalMetrics();
    }, 1000); // Check every second
  }

  /**
   * Stop budget monitoring
   */
  private stopBudgetMonitoring(): void {
    if (this.budgetMonitor) {
      clearInterval(this.budgetMonitor);
      this.budgetMonitor = undefined;
    }
  }

  /**
   * Start architecture analysis
   */
  private startArchitectureAnalysis(): void {
    this.architectureAnalyzer = setInterval(() => {
      if (!this.isMonitoring) return;

      // Analyze component architecture
      this.analyzeComponentArchitecture();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop architecture analysis
   */
  private stopArchitectureAnalysis(): void {
    if (this.architectureAnalyzer) {
      clearInterval(this.architectureAnalyzer);
      this.architectureAnalyzer = undefined;
    }
  }

  /**
   * Check global performance metrics
   */
  private checkGlobalMetrics(): void {
    // Simulate performance metric collection
    // In a real implementation, this would integrate with actual performance APIs
    
    // Frame time check
    const currentFrameTime = 16.67; // Would be measured from performance monitor
    this.checkBudget('frameTime', currentFrameTime);

    // Memory usage check
    if (typeof window !== 'undefined' && (performance as any).memory) {
      const memoryUsage = (performance as any).memory.usedJSHeapSize / (1024 * 1024);
      this.checkBudget('memoryUsage', memoryUsage);
    }

    // Component render count checks
    for (const [name, profile] of this.componentProfiles) {
      const renderRate = profile.renderCount / (Date.now() - profile.renderTime || 1) * 1000;
      this.checkBudget('renderCount', renderRate, name);
    }
  }

  /**
   * Analyze component architecture
   */
  private analyzeComponentArchitecture(): void {
    for (const [name, profile] of this.componentProfiles) {
      // Check for prop drilling
      if (profile.props.count > 15) {
        this.addArchitectureIssue({
          type: 'prop-drilling',
          component: name,
          description: `Component has ${profile.props.count} props, indicating possible prop drilling`,
          severity: profile.props.count > 25 ? 'high' : 'medium',
          impact: 'Prop drilling makes components hard to maintain and can cause unnecessary re-renders',
          suggestedFix: 'Consider using Context API or state management library',
          codeExample: this.generatePropDrillingFix(name),
          metadata: { propsCount: profile.props.count },
        });
      }

      // Check for missing memoization
      if (profile.renderCount > 100 && !profile.hooks.includes('useMemo')) {
        this.addArchitectureIssue({
          type: 'missing-memo',
          component: name,
          description: `High render count (${profile.renderCount}) without memoization`,
          severity: 'medium',
          impact: 'Component may be re-rendering unnecessarily',
          suggestedFix: 'Add React.memo or useMemo for expensive calculations',
          codeExample: this.generateMemoizationFix(name),
          metadata: { renderCount: profile.renderCount },
        });
      }

      // Check for excessive dependencies
      if (profile.dependencies.length > 20) {
        this.addArchitectureIssue({
          type: 'large-bundle',
          component: name,
          description: `Component has ${profile.dependencies.length} dependencies`,
          severity: profile.dependencies.length > 30 ? 'high' : 'medium',
          impact: 'High dependency count increases bundle size and complexity',
          suggestedFix: 'Review and optimize dependencies, consider code splitting',
          codeExample: this.generateDependencyOptimizationExample(name),
          metadata: { dependencyCount: profile.dependencies.length },
        });
      }

      // Calculate optimization score
      profile.optimizationScore = this.calculateOptimizationScore(profile);
    }
  }

  /**
   * Analyze individual component profile
   */
  private analyzeComponentProfile(profile: ComponentPerformanceProfile): void {
    const issues: ComponentArchitectureIssue[] = [];

    // Check render time
    if (profile.renderTime > this.currentBudget.frameTime.warning) {
      issues.push({
        id: this.generateId(),
        type: 'inefficient-reconciliation',
        component: profile.name,
        description: `Slow render time: ${profile.renderTime.toFixed(2)}ms`,
        severity: profile.renderTime > this.currentBudget.frameTime.critical ? 'critical' : 'high',
        impact: 'Slow renders can cause frame drops and poor user experience',
        suggestedFix: 'Optimize component logic and consider React.memo',
        codeExample: this.generateRenderOptimizationExample(profile.name),
        detectedAt: Date.now(),
        metadata: { renderTime: profile.renderTime },
      });
    }

    // Check for excessive nesting
    const estimatedDepth = Math.ceil(profile.children.length / 3);
    if (estimatedDepth > 8) {
      issues.push({
        id: this.generateId(),
        type: 'excessive-nesting',
        component: profile.name,
        description: `Deep component nesting detected (estimated depth: ${estimatedDepth})`,
        severity: 'medium',
        impact: 'Deep nesting can make reconciliation slower and code harder to maintain',
        suggestedFix: 'Flatten component hierarchy and extract reusable components',
        codeExample: this.generateNestingOptimizationExample(profile.name),
        detectedAt: Date.now(),
        metadata: { estimatedDepth },
      });
    }

    profile.issues = issues;
    this.architectureIssues.push(...issues);
  }

  /**
   * Calculate optimization score for component
   */
  private calculateOptimizationScore(profile: ComponentPerformanceProfile): number {
    let score = 100;

    // Deduct points for issues
    score -= profile.issues.length * 10;
    
    // Deduct for high render count without memoization
    if (profile.renderCount > 50 && !profile.hooks.includes('useMemo')) {
      score -= 15;
    }
    
    // Deduct for slow render time
    if (profile.renderTime > this.currentBudget.frameTime.warning) {
      score -= 20;
    }
    
    // Deduct for high prop count
    if (profile.props.complexity === 'high') {
      score -= 10;
    }
    
    // Deduct for high state complexity
    if (profile.state.complexity === 'high') {
      score -= 10;
    }
    
    // Deduct for many dependencies
    if (profile.dependencies.length > 15) {
      score -= 5;
    }

    return Math.max(0, score);
  }

  /**
   * Get budget configuration for metric
   */
  private getBudgetForMetric(metric: string) {
    const budget = this.currentBudget;
    
    switch (metric) {
      case 'frameTime':
        return budget.frameTime;
      case 'interactionDelay':
        return budget.interactionDelay;
      case 'memoryUsage':
        return budget.memoryUsage;
      case 'bundleSize':
        return budget.bundleSize;
      case 'renderCount':
        return budget.renderCount;
      case 'networkRequests':
        return budget.networkRequests;
      default:
        return budget.customMetrics[metric];
    }
  }

  /**
   * Generate suggestion for metric violation
   */
  private generateSuggestionForMetric(metric: string, value: number, budget: number): string {
    const excess = ((value - budget) / budget * 100).toFixed(1);
    
    switch (metric) {
      case 'frameTime':
        return `Frame time is ${excess}% over budget. Optimize render logic or reduce component complexity.`;
      case 'memoryUsage':
        return `Memory usage is ${excess}% over budget. Check for memory leaks and optimize data structures.`;
      case 'renderCount':
        return `Render count is ${excess}% over budget. Implement React.memo or optimize dependencies.`;
      case 'bundleSize':
        return `Bundle size is ${excess}% over budget. Consider code splitting or removing unused dependencies.`;
      default:
        return `${metric} is ${excess}% over budget. Review and optimize this metric.`;
    }
  }

  /**
   * Generate impact description for metric violation
   */
  private generateImpactForMetric(metric: string, severity: 'warning' | 'critical'): string {
    const level = severity === 'critical' ? 'Severe' : 'Moderate';
    
    switch (metric) {
      case 'frameTime':
        return `${level} impact on animation smoothness and user experience`;
      case 'memoryUsage':
        return `${level} impact on device performance and potential crashes`;
      case 'renderCount':
        return `${level} impact on battery life and performance`;
      case 'bundleSize':
        return `${level} impact on app load time and download size`;
      default:
        return `${level} performance impact`;
    }
  }

  /**
   * Add budget violation
   */
  private addBudgetViolation(violation: Omit<BudgetViolation, 'id' | 'timestamp'>): void {
    // Avoid duplicate violations
    const existing = this.violations.find(v => 
      v.metric === violation.metric && 
      v.component === violation.component &&
      Date.now() - v.timestamp < 5000 // Within 5 seconds
    );

    if (!existing) {
      this.violations.push({
        ...violation,
        id: this.generateId(),
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Add architecture issue
   */
  private addArchitectureIssue(issue: Omit<ComponentArchitectureIssue, 'id' | 'detectedAt'>): void {
    // Avoid duplicate issues
    const existing = this.architectureIssues.find(i => 
      i.type === issue.type && 
      i.component === issue.component
    );

    if (!existing) {
      this.architectureIssues.push({
        ...issue,
        id: this.generateId(),
        detectedAt: Date.now(),
      });
    }
  }

  /**
   * Generate comprehensive report
   */
  private generateReport(): PerformanceBudgetReport {
    const componentProfiles = Array.from(this.componentProfiles.values());
    const criticalViolations = this.violations.filter(v => v.severity === 'critical').length;
    const warningViolations = this.violations.filter(v => v.severity === 'warning').length;
    const totalViolations = this.violations.length;
    
    const compliance = totalViolations > 0 ? 
      Math.max(0, 100 - (criticalViolations * 20 + warningViolations * 5)) : 100;

    const averageOptimizationScore = componentProfiles.length > 0 ?
      componentProfiles.reduce((sum, p) => sum + p.optimizationScore, 0) / componentProfiles.length : 100;

    const worstPerformingComponents = componentProfiles
      .sort((a, b) => a.optimizationScore - b.optimizationScore)
      .slice(0, 5)
      .map(p => p.name);

    const recommendations = this.generateRecommendations(componentProfiles);

    return {
      budgetName: this.currentBudget.name,
      violations: this.violations,
      compliance,
      recommendations,
      componentProfiles,
      architectureIssues: this.architectureIssues,
      summary: {
        totalViolations,
        criticalViolations,
        warningViolations,
        averageOptimizationScore,
        worstPerformingComponents,
      },
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(profiles: ComponentPerformanceProfile[]): string[] {
    const recommendations: string[] = [];
    
    const criticalViolations = this.violations.filter(v => v.severity === 'critical').length;
    if (criticalViolations > 0) {
      recommendations.push(`Address ${criticalViolations} critical performance budget violations immediately`);
    }
    
    const slowComponents = profiles.filter(p => p.renderTime > this.currentBudget.frameTime.warning).length;
    if (slowComponents > 0) {
      recommendations.push(`Optimize ${slowComponents} slow-rendering components`);
    }
    
    const unmemoizedComponents = profiles.filter(p => 
      p.renderCount > 50 && !p.hooks.includes('useMemo')
    ).length;
    if (unmemoizedComponents > 0) {
      recommendations.push(`Add memoization to ${unmemoizedComponents} frequently rendering components`);
    }
    
    const propDrillingIssues = this.architectureIssues.filter(i => i.type === 'prop-drilling').length;
    if (propDrillingIssues > 0) {
      recommendations.push(`Refactor ${propDrillingIssues} components with prop drilling issues`);
    }
    
    if (profiles.some(p => p.dependencies.length > 20)) {
      recommendations.push('Review and optimize component dependencies to reduce bundle size');
    }
    
    return recommendations;
  }

  /**
   * Generate code examples for fixes
   */
  private generatePropDrillingFix(componentName: string): string {
    return `
// Before: Prop drilling
const ${componentName} = ({ prop1, prop2, prop3, ...manyProps }) => {
  return (
    <ChildComponent 
      prop1={prop1} 
      prop2={prop2} 
      prop3={prop3}
      {...manyProps} 
    />
  );
};

// After: Context API
const ${componentName}Context = createContext();

const ${componentName}Provider = ({ children, ...props }) => {
  return (
    <${componentName}Context.Provider value={props}>
      {children}
    </${componentName}Context.Provider>
  );
};

const ${componentName} = () => {
  const contextValue = useContext(${componentName}Context);
  return <ChildComponent />; // No prop drilling
};`;
  }

  private generateMemoizationFix(componentName: string): string {
    return `
// Before: No memoization
const ${componentName} = ({ data, callback }) => {
  const expensiveValue = computeExpensive(data);
  return <div onClick={callback}>{expensiveValue}</div>;
};

// After: With memoization
const ${componentName} = React.memo(({ data, callback }) => {
  const expensiveValue = useMemo(() => computeExpensive(data), [data]);
  const memoizedCallback = useCallback(callback, []);
  
  return <div onClick={memoizedCallback}>{expensiveValue}</div>;
});`;
  }

  private generateRenderOptimizationExample(componentName: string): string {
    return `
// Before: Inefficient render
const ${componentName} = ({ items }) => {
  return (
    <div>
      {items.map((item, index) => (
        <ExpensiveComponent key={index} item={item} />
      ))}
    </div>
  );
};

// After: Optimized render
const ${componentName} = React.memo(({ items }) => {
  const memoizedItems = useMemo(() => 
    items.map(item => ({ ...item, id: item.id || generateId() })), 
    [items]
  );
  
  return (
    <div>
      {memoizedItems.map(item => (
        <MemoizedExpensiveComponent key={item.id} item={item} />
      ))}
    </div>
  );
});

const MemoizedExpensiveComponent = React.memo(ExpensiveComponent);`;
  }

  private generateNestingOptimizationExample(componentName: string): string {
    return `
// Before: Deep nesting
const ${componentName} = () => (
  <Container>
    <Header>
      <Navigation>
        <Menu>
          <MenuItem>
            <Link>
              <Icon />
              <Text>Item</Text>
            </Link>
          </MenuItem>
        </Menu>
      </Navigation>
    </Header>
  </Container>
);

// After: Flattened structure
const ${componentName} = () => (
  <Container>
    <NavigationHeader />
    <MenuContent />
  </Container>
);

const NavigationHeader = () => (
  <Header>
    <Navigation />
  </Header>
);

const MenuContent = () => (
  <Menu>
    <MenuItemComponent />
  </Menu>
);`;
  }

  private generateDependencyOptimizationExample(componentName: string): string {
    return `
// Before: Many imports
import { util1, util2, util3, ... } from 'large-library';
import { component1, component2, ... } from 'ui-library';

// After: Selective imports and code splitting
import { util1 } from 'large-library/util1';
import { util2 } from 'large-library/util2';

// Lazy load heavy components
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// Use dynamic imports for conditional features
const loadFeature = async () => {
  const { feature } = await import('./optional-feature');
  return feature;
};`;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Singleton performance budget manager
 */
export const performanceBudgetManager = new PerformanceBudgetManager();

/**
 * Hook for performance budget management
 */
export function usePerformanceBudget() {
  return {
    manager: performanceBudgetManager,
    startMonitoring: () => performanceBudgetManager.startMonitoring(),
    stopMonitoring: () => performanceBudgetManager.stopMonitoring(),
    setBudget: (budget: PerformanceBudget) => performanceBudgetManager.setBudget(budget),
    trackComponent: (name: string, metrics: any) => 
      performanceBudgetManager.trackComponentPerformance(name, metrics),
    checkBudget: (metric: string, value: number, component?: string) =>
      performanceBudgetManager.checkBudget(metric, value, component),
  };
}