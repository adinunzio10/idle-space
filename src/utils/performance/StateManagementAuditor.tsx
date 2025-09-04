/**
 * State Management Auditor
 * 
 * Analyzes React state management patterns to identify performance issues
 * including excessive context updates, improper state normalization, and
 * unnecessary re-renders caused by state management anti-patterns.
 */

import React from 'react';

/**
 * State management issue
 */
export interface StateManagementIssue {
  id: string;
  type: 'context-value-recreation' | 'missing-memoization' | 'state-normalization' | 'prop-drilling' | 'excessive-renders';
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
 * Context usage analysis
 */
export interface ContextAnalysis {
  contextName: string;
  providerComponent: string;
  consumers: string[];
  valueRecreationCount: number;
  unnecessaryUpdates: number;
  issues: StateManagementIssue[];
}

/**
 * Component state analysis
 */
export interface ComponentStateAnalysis {
  componentName: string;
  stateVariables: StateVariable[];
  renderCount: number;
  unnecessaryRenders: number;
  issues: StateManagementIssue[];
}

/**
 * State variable analysis
 */
interface StateVariable {
  name: string;
  type: 'primitive' | 'object' | 'array';
  updateFrequency: number;
  causesRender: boolean;
  isNormalized: boolean;
}

/**
 * State Management Auditor Class
 */
export class StateManagementAuditor {
  private isAuditing = false;
  private auditStartTime = 0;
  private detectedIssues: StateManagementIssue[] = [];
  private contextAnalyses: ContextAnalysis[] = [];
  private componentAnalyses = new Map<string, ComponentStateAnalysis>();
  
  // React Context tracking
  private trackedContexts = new Map<string, ContextAnalysis>();
  private contextValueHistory = new Map<string, any[]>();
  
  // Component state tracking
  private componentRenderCounts = new Map<string, number>();
  private stateUpdateTracking = new Map<string, Map<string, number>>();

  constructor() {
    console.log('[StateManagementAuditor] Initialized');
  }

  /**
   * Start state management audit
   */
  startAudit(): void {
    if (this.isAuditing) {
      console.warn('[StateManagementAuditor] Audit already running');
      return;
    }

    console.log('[StateManagementAuditor] Starting state management audit');
    this.isAuditing = true;
    this.auditStartTime = Date.now();
    
    // Clear previous data
    this.detectedIssues = [];
    this.contextAnalyses = [];
    this.componentAnalyses.clear();
    this.trackedContexts.clear();
    this.contextValueHistory.clear();
    this.componentRenderCounts.clear();
    this.stateUpdateTracking.clear();
    
    // Start periodic analysis
    this.startPeriodicAnalysis();
  }

  /**
   * Stop audit and generate report
   */
  stopAudit(): {
    issues: StateManagementIssue[];
    contextAnalyses: ContextAnalysis[];
    componentAnalyses: ComponentStateAnalysis[];
    summary: {
      totalIssues: number;
      criticalIssues: number;
      highIssues: number;
      contextIssues: number;
      stateIssues: number;
    };
    recommendations: string[];
  } {
    if (!this.isAuditing) {
      throw new Error('Audit is not running');
    }

    console.log('[StateManagementAuditor] Stopping audit and generating report');
    this.isAuditing = false;
    
    // Generate final analysis
    this.performFinalAnalysis();
    
    const componentAnalyses = Array.from(this.componentAnalyses.values());
    
    const summary = {
      totalIssues: this.detectedIssues.length,
      criticalIssues: this.detectedIssues.filter(i => i.severity === 'critical').length,
      highIssues: this.detectedIssues.filter(i => i.severity === 'high').length,
      contextIssues: this.detectedIssues.filter(i => i.type.includes('context')).length,
      stateIssues: this.detectedIssues.filter(i => i.type.includes('state')).length,
    };
    
    const recommendations = this.generateRecommendations();
    
    console.log('[StateManagementAuditor] Audit complete:', summary);
    
    return {
      issues: this.detectedIssues,
      contextAnalyses: this.contextAnalyses,
      componentAnalyses,
      summary,
      recommendations,
    };
  }

  /**
   * Track context value update
   */
  trackContextUpdate(
    contextName: string,
    value: any,
    providerComponent: string
  ): void {
    if (!this.isAuditing) return;

    let contextAnalysis = this.trackedContexts.get(contextName);
    if (!contextAnalysis) {
      contextAnalysis = {
        contextName,
        providerComponent,
        consumers: [],
        valueRecreationCount: 0,
        unnecessaryUpdates: 0,
        issues: [],
      };
      this.trackedContexts.set(contextName, contextAnalysis);
    }

    // Track value history
    let history = this.contextValueHistory.get(contextName) || [];
    history.push(value);
    
    // Keep only recent history (last 20 values)
    if (history.length > 20) {
      history = history.slice(-20);
    }
    this.contextValueHistory.set(contextName, history);

    // Check for value recreation
    if (history.length > 1) {
      const current = history[history.length - 1];
      const previous = history[history.length - 2];
      
      if (this.isValueRecreated(current, previous)) {
        contextAnalysis.valueRecreationCount++;
        
        if (contextAnalysis.valueRecreationCount > 10) {
          this.addIssue({
            type: 'context-value-recreation',
            component: providerComponent,
            description: `Context ${contextName} value is being recreated frequently`,
            severity: 'high',
            impact: 'Causes unnecessary re-renders of all consumers',
            suggestedFix: 'Memoize context value using useMemo',
            codeExample: this.generateContextMemoizationExample(contextName),
            metadata: { contextName, recreationCount: contextAnalysis.valueRecreationCount },
          });
        }
      }
    }
  }

  /**
   * Track context consumer
   */
  trackContextConsumer(contextName: string, consumerComponent: string): void {
    if (!this.isAuditing) return;

    const contextAnalysis = this.trackedContexts.get(contextName);
    if (contextAnalysis && !contextAnalysis.consumers.includes(consumerComponent)) {
      contextAnalysis.consumers.push(consumerComponent);
    }
  }

  /**
   * Track component render
   */
  trackComponentRender(componentName: string, renderReason: string): void {
    if (!this.isAuditing) return;

    const currentCount = this.componentRenderCounts.get(componentName) || 0;
    this.componentRenderCounts.set(componentName, currentCount + 1);

    // Analyze render patterns
    if (currentCount > 0 && currentCount % 10 === 0) {
      this.analyzeComponentRenderPattern(componentName);
    }
  }

  /**
   * Track state update
   */
  trackStateUpdate(
    componentName: string,
    stateKey: string,
    newValue: any,
    oldValue?: any
  ): void {
    if (!this.isAuditing) return;

    let componentUpdates = this.stateUpdateTracking.get(componentName);
    if (!componentUpdates) {
      componentUpdates = new Map();
      this.stateUpdateTracking.set(componentName, componentUpdates);
    }

    const currentCount = componentUpdates.get(stateKey) || 0;
    componentUpdates.set(stateKey, currentCount + 1);

    // Check for unnecessary updates (same value)
    if (oldValue !== undefined && this.isValueEqual(newValue, oldValue)) {
      this.addIssue({
        type: 'excessive-renders',
        component: componentName,
        description: `State ${stateKey} updated with same value`,
        severity: 'medium',
        impact: 'Causes unnecessary re-render',
        suggestedFix: 'Check value before setting state or use functional update',
        codeExample: this.generateStateUpdateExample(stateKey),
        metadata: { stateKey, updateCount: currentCount + 1 },
      });
    }

    // Check for object/array state issues
    if (typeof newValue === 'object' && newValue !== null) {
      this.analyzeObjectStateUpdate(componentName, stateKey, newValue, oldValue);
    }
  }

  /**
   * Analyze component render pattern
   */
  private analyzeComponentRenderPattern(componentName: string): void {
    const renderCount = this.componentRenderCounts.get(componentName) || 0;
    const stateUpdates = this.stateUpdateTracking.get(componentName);
    
    if (renderCount > 50) {
      this.addIssue({
        type: 'excessive-renders',
        component: componentName,
        description: `Component has rendered ${renderCount} times`,
        severity: renderCount > 100 ? 'high' : 'medium',
        impact: 'High render frequency may indicate performance issues',
        suggestedFix: 'Consider React.memo or optimize dependencies',
        codeExample: this.generateMemoExample(componentName),
        metadata: { renderCount },
      });
    }

    // Check for state updates causing renders
    if (stateUpdates) {
      const totalStateUpdates = Array.from(stateUpdates.values())
        .reduce((sum, count) => sum + count, 0);
      
      if (renderCount > totalStateUpdates * 2) {
        this.addIssue({
          type: 'excessive-renders',
          component: componentName,
          description: `Component renders (${renderCount}) exceed state updates (${totalStateUpdates}) significantly`,
          severity: 'medium',
          impact: 'Component may be re-rendering due to parent updates or prop changes',
          suggestedFix: 'Investigate prop changes and consider React.memo',
          codeExample: this.generateMemoExample(componentName),
          metadata: { renderCount, stateUpdates: totalStateUpdates },
        });
      }
    }
  }

  /**
   * Analyze object/array state updates
   */
  private analyzeObjectStateUpdate(
    componentName: string,
    stateKey: string,
    newValue: any,
    oldValue?: any
  ): void {
    // Check for direct mutation
    if (oldValue && newValue === oldValue) {
      this.addIssue({
        type: 'state-normalization',
        component: componentName,
        description: `State ${stateKey} object/array may be mutated directly`,
        severity: 'high',
        impact: 'Direct mutations can cause stale state and missed updates',
        suggestedFix: 'Always create new object/array references',
        codeExample: this.generateImmutableUpdateExample(stateKey),
        metadata: { stateKey, type: Array.isArray(newValue) ? 'array' : 'object' },
      });
    }

    // Check for deeply nested objects (normalization issue)
    if (this.isDeepObject(newValue, 3)) {
      this.addIssue({
        type: 'state-normalization',
        component: componentName,
        description: `State ${stateKey} contains deeply nested objects`,
        severity: 'medium',
        impact: 'Deep nesting makes state updates complex and error-prone',
        suggestedFix: 'Consider normalizing state structure',
        codeExample: this.generateNormalizationExample(stateKey),
        metadata: { stateKey, depth: this.getObjectDepth(newValue) },
      });
    }
  }

  /**
   * Perform final analysis
   */
  private performFinalAnalysis(): void {
    // Analyze context patterns
    for (const [contextName, analysis] of this.trackedContexts) {
      this.contextAnalyses.push(analysis);
      
      // Check for contexts with many consumers
      if (analysis.consumers.length > 10) {
        this.addIssue({
          type: 'context-value-recreation',
          component: analysis.providerComponent,
          description: `Context ${contextName} has ${analysis.consumers.length} consumers`,
          severity: 'medium',
          impact: 'Many consumers increase the impact of context updates',
          suggestedFix: 'Consider splitting context or using state management library',
          codeExample: this.generateContextSplittingExample(contextName),
          metadata: { contextName, consumerCount: analysis.consumers.length },
        });
      }
    }

    // Generate component analyses
    for (const [componentName, renderCount] of this.componentRenderCounts) {
      const stateUpdates = this.stateUpdateTracking.get(componentName) || new Map();
      const stateVariables: StateVariable[] = Array.from(stateUpdates.entries()).map(([key, updateCount]) => ({
        name: key,
        type: 'primitive', // Simplified for this example
        updateFrequency: updateCount,
        causesRender: true,
        isNormalized: true, // Would analyze actual structure
      }));

      const analysis: ComponentStateAnalysis = {
        componentName,
        stateVariables,
        renderCount,
        unnecessaryRenders: Math.max(0, renderCount - stateVariables.reduce((sum, v) => sum + v.updateFrequency, 0)),
        issues: this.detectedIssues.filter(issue => issue.component === componentName),
      };

      this.componentAnalyses.set(componentName, analysis);
    }
  }

  /**
   * Add detected issue
   */
  private addIssue(issue: Omit<StateManagementIssue, 'id' | 'detectedAt'>): void {
    // Avoid duplicate issues
    const existingIssue = this.detectedIssues.find(
      existing => 
        existing.type === issue.type && 
        existing.component === issue.component &&
        existing.description === issue.description
    );

    if (!existingIssue) {
      const newIssue: StateManagementIssue = {
        ...issue,
        id: this.generateId(),
        detectedAt: Date.now(),
      };
      this.detectedIssues.push(newIssue);
    }
  }

  /**
   * Check if value was recreated (shallow comparison)
   */
  private isValueRecreated(current: any, previous: any): boolean {
    if (current === previous) return false;
    if (typeof current !== typeof previous) return true;
    
    if (typeof current === 'object' && current !== null && previous !== null) {
      // For objects, if they're not the same reference, consider it recreated
      // In a real implementation, you might do shallow comparison
      return current !== previous;
    }
    
    return current !== previous;
  }

  /**
   * Check if values are equal (for detecting unnecessary updates)
   */
  private isValueEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false;
      
      if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        return a.every((item, index) => this.isValueEqual(item, b[index]));
      }
      
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      
      return keysA.every(key => this.isValueEqual(a[key], b[key]));
    }
    
    return a === b;
  }

  /**
   * Check if object is deeply nested
   */
  private isDeepObject(obj: any, maxDepth: number): boolean {
    return this.getObjectDepth(obj) > maxDepth;
  }

  /**
   * Get object depth
   */
  private getObjectDepth(obj: any): number {
    if (typeof obj !== 'object' || obj === null) return 0;
    
    let maxDepth = 0;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const depth = this.getObjectDepth(obj[key]);
        maxDepth = Math.max(maxDepth, depth + 1);
      }
    }
    
    return maxDepth;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const criticalIssues = this.detectedIssues.filter(i => i.severity === 'critical').length;
    const highIssues = this.detectedIssues.filter(i => i.severity === 'high').length;
    
    if (criticalIssues > 0) {
      recommendations.push(`Address ${criticalIssues} critical state management issues immediately`);
    }
    
    if (highIssues > 0) {
      recommendations.push(`Review ${highIssues} high-impact state management patterns`);
    }
    
    const contextIssues = this.detectedIssues.filter(i => i.type.includes('context')).length;
    if (contextIssues > 3) {
      recommendations.push('Consider state management library (Redux, Zustand) for complex state');
    }
    
    const excessiveRenders = this.detectedIssues.filter(i => i.type === 'excessive-renders').length;
    if (excessiveRenders > 5) {
      recommendations.push('Implement React.memo and optimize component dependencies');
    }
    
    return recommendations;
  }

  /**
   * Start periodic analysis during audit
   */
  private startPeriodicAnalysis(): void {
    const analysisInterval = setInterval(() => {
      if (!this.isAuditing) {
        clearInterval(analysisInterval);
        return;
      }

      // Periodic analysis of current state
      console.log('[StateManagementAuditor] Periodic analysis - detected issues:', this.detectedIssues.length);
    }, 5000); // Every 5 seconds
  }

  /**
   * Generate code examples
   */
  private generateContextMemoizationExample(contextName: string): string {
    return `
// Before: Context value recreated on every render
const ${contextName}Provider = ({ children }) => {
  const [state, setState] = useState(initialState);
  
  return (
    <${contextName}.Provider value={{ state, setState }}>
      {children}
    </${contextName}.Provider>
  );
};

// After: Memoized context value
const ${contextName}Provider = ({ children }) => {
  const [state, setState] = useState(initialState);
  
  const value = useMemo(() => ({ state, setState }), [state]);
  
  return (
    <${contextName}.Provider value={value}>
      {children}
    </${contextName}.Provider>
  );
};`;
  }

  private generateStateUpdateExample(stateKey: string): string {
    return `
// Before: May cause unnecessary renders
const handleUpdate = (newValue) => {
  set${stateKey}(newValue);
};

// After: Check before updating
const handleUpdate = (newValue) => {
  set${stateKey}(prev => prev === newValue ? prev : newValue);
};

// Or use functional update when appropriate
const handleIncrement = () => {
  set${stateKey}(prev => prev + 1);
};`;
  }

  private generateMemoExample(componentName: string): string {
    return `
// Before: Component re-renders unnecessarily
const ${componentName} = ({ prop1, prop2 }) => {
  return <div>{/* component content */}</div>;
};

// After: Memoized component
const ${componentName} = React.memo(({ prop1, prop2 }) => {
  return <div>{/* component content */}</div>;
});

// With custom comparison if needed
const ${componentName} = React.memo(({ prop1, prop2 }) => {
  return <div>{/* component content */}</div>;
}, (prevProps, nextProps) => {
  return prevProps.prop1 === nextProps.prop1 && prevProps.prop2 === nextProps.prop2;
});`;
  }

  private generateImmutableUpdateExample(stateKey: string): string {
    return `
// Before: Direct mutation (bad)
const handleUpdate = () => {
  ${stateKey}.push(newItem); // Mutates directly
  set${stateKey}(${stateKey}); // Same reference, no re-render
};

// After: Immutable update (good)
const handleUpdate = () => {
  set${stateKey}(prev => [...prev, newItem]); // New array reference
};

// For objects:
const handleObjectUpdate = (key, value) => {
  set${stateKey}(prev => ({ ...prev, [key]: value })); // New object reference
};`;
  }

  private generateNormalizationExample(stateKey: string): string {
    return `
// Before: Nested structure (harder to update)
const [${stateKey}, set${stateKey}] = useState({
  users: {
    1: { id: 1, profile: { name: 'John', settings: { theme: 'dark' } } }
  }
});

// After: Normalized structure (easier to update)
const [users, setUsers] = useState({
  1: { id: 1, name: 'John', profileId: 'profile_1' }
});
const [profiles, setProfiles] = useState({
  profile_1: { id: 'profile_1', settingsId: 'settings_1' }
});
const [settings, setSettings] = useState({
  settings_1: { id: 'settings_1', theme: 'dark' }
});`;
  }

  private generateContextSplittingExample(contextName: string): string {
    return `
// Before: Single large context
const ${contextName} = createContext();

// After: Split into focused contexts
const ${contextName}State = createContext();
const ${contextName}Actions = createContext();

// Or separate by domain
const UserContext = createContext();
const SettingsContext = createContext();
const UIContext = createContext();`;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Singleton state management auditor
 */
export const stateManagementAuditor = new StateManagementAuditor();

/**
 * Hook for state management audit
 */
export function useStateManagementAudit() {
  return {
    auditor: stateManagementAuditor,
    startAudit: () => stateManagementAuditor.startAudit(),
    stopAudit: () => stateManagementAuditor.stopAudit(),
    trackContextUpdate: (name: string, value: any, component: string) =>
      stateManagementAuditor.trackContextUpdate(name, value, component),
    trackComponentRender: (name: string, reason: string) =>
      stateManagementAuditor.trackComponentRender(name, reason),
    trackStateUpdate: (component: string, key: string, newValue: any, oldValue?: any) =>
      stateManagementAuditor.trackStateUpdate(component, key, newValue, oldValue),
  };
}