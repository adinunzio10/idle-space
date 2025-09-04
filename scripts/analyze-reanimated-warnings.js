#!/usr/bin/env node

/**
 * Reanimated Warning Analyzer
 * 
 * Analyzes logs to extract unique Reanimated object mutation warnings
 * Usage: 
 *   node scripts/analyze-reanimated-warnings.js < logfile.txt
 *   npx metro --reset-cache | node scripts/analyze-reanimated-warnings.js
 *   npm start 2>&1 | node scripts/analyze-reanimated-warnings.js
 */

const readline = require('readline');
const path = require('path');

class ReanimatedWarningAnalyzer {
  constructor() {
    this.warnings = new Map(); // key -> { count, firstSeen, lastSeen, contexts }
    this.totalWarnings = 0;
    this.contexts = new Set(); // Track different contexts where warnings occur
  }

  extractKeyFromWarning(line) {
    // Match: "Tried to modify key `keyname` of an object"
    // Handle both single line and multi-line formats
    const match = line.match(/Tried to modify key `([^`]+)` of an object/);
    return match ? match[1] : null;
  }

  isReanimatedWarningLine(line) {
    return line.includes('Reanimated] Tried to modify key') || 
           line.includes('[Reanimated] Tried to modify key');
  }

  extractContext(line, previousLines = []) {
    // Try to extract context from surrounding lines
    const contexts = [];
    
    // Look for component/module names in previous lines (more patterns)
    for (const prevLine of previousLines.slice(-8)) {
      const patterns = [
        /\[([\w]+(?:Module|Component|Renderer|Manager))\]/,
        /LOG\s+\[(DEBUG:)?([\w]+)\]/,
        /\[DEBUG:([\w]+)\]/,
        /\[([\w]+RenderingModule)\]/,
        /\[([\w]+System(?:Module)?)\]/
      ];
      
      for (const pattern of patterns) {
        const match = prevLine.match(pattern);
        if (match) {
          const context = match[2] || match[1];
          if (context && context !== 'DEBUG') {
            contexts.push(context);
            break;
          }
        }
      }
    }
    
    // Look for file paths
    const fileMatch = line.match(/at .*[/\\]([^/\\]+\.[jt]sx?)/);
    if (fileMatch) {
      contexts.push(fileMatch[1]);
    }
    
    return contexts.length > 0 ? contexts[0] : 'unknown';
  }

  analyzeWarning(line, context = 'unknown') {
    const key = this.extractKeyFromWarning(line);
    if (!key) return false;

    this.totalWarnings++;
    
    if (!this.warnings.has(key)) {
      this.warnings.set(key, {
        count: 0,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        contexts: new Set()
      });
    }

    const warning = this.warnings.get(key);
    warning.count++;
    warning.lastSeen = new Date().toISOString();
    warning.contexts.add(context);
    
    this.contexts.add(context);
    return true;
  }

  generateReport() {
    const report = {
      summary: {
        uniqueKeys: this.warnings.size,
        totalWarnings: this.totalWarnings,
        contexts: Array.from(this.contexts).sort(),
        analyzedAt: new Date().toISOString()
      },
      warnings: []
    };

    // Sort warnings by frequency (most common first)
    const sortedWarnings = Array.from(this.warnings.entries())
      .sort((a, b) => b[1].count - a[1].count);

    for (const [key, data] of sortedWarnings) {
      report.warnings.push({
        key,
        count: data.count,
        percentage: ((data.count / this.totalWarnings) * 100).toFixed(1),
        contexts: Array.from(data.contexts).sort(),
        firstSeen: data.firstSeen,
        lastSeen: data.lastSeen
      });
    }

    return report;
  }

  printColoredReport() {
    const report = this.generateReport();
    
    console.log('\n🔍 REANIMATED OBJECT MUTATION ANALYSIS');
    console.log('=====================================\n');
    
    console.log(`📊 Summary:`);
    console.log(`   • Total warnings: ${report.summary.totalWarnings}`);
    console.log(`   • Unique keys: ${report.summary.uniqueKeys}`);
    console.log(`   • Contexts: ${report.summary.contexts.join(', ')}\n`);

    if (report.warnings.length === 0) {
      console.log('✅ No Reanimated mutation warnings found!\n');
      return;
    }

    console.log('🚨 Most Problematic Keys:\n');
    
    for (const warning of report.warnings.slice(0, 10)) { // Top 10
      const severity = warning.count > 100 ? '🔴' : warning.count > 50 ? '🟡' : '🟢';
      console.log(`${severity} Key: \`${warning.key}\``);
      console.log(`   Count: ${warning.count} (${warning.percentage}%)`);
      console.log(`   Contexts: ${warning.contexts.join(', ')}`);
      console.log(`   Duration: ${new Date(warning.firstSeen).toLocaleTimeString()} - ${new Date(warning.lastSeen).toLocaleTimeString()}`);
      console.log('');
    }

    // Show recommendations
    console.log('💡 Recommendations:\n');
    
    const topKeys = report.warnings.slice(0, 3).map(w => w.key);
    console.log(`1. Priority fix: Keys [${topKeys.join(', ')}] - these cause ${
      report.warnings.slice(0, 3).reduce((sum, w) => sum + w.count, 0)
    } warnings`);
    
    const moduleContexts = report.summary.contexts.filter(c => c.includes('Module'));
    if (moduleContexts.length > 0) {
      console.log(`2. Focus on modules: ${moduleContexts.join(', ')}`);
    }
    
    console.log(`3. Clone these object properties before passing to Reanimated worklets`);
    console.log(`4. Consider using Object.freeze() for immutable data\n`);

    // Generate fix template
    if (report.warnings.length > 0) {
      console.log('🔧 Quick Fix Template:\n');
      console.log('```javascript');
      console.log('// Clone object before passing to Reanimated');
      console.log('const clonedObject = {');
      for (const warning of report.warnings.slice(0, 5)) {
        console.log(`  ${warning.key}: originalObject.${warning.key}, // Fixed: ${warning.count} warnings`);
      }
      console.log('};');
      console.log('```\n');
    }
  }

  saveJsonReport(filename = 'reanimated-warnings-report.json') {
    const report = this.generateReport();
    const fs = require('fs');
    
    const outputPath = path.resolve(process.cwd(), filename);
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`📄 Detailed report saved to: ${outputPath}\n`);
  }
}

// Main execution
async function main() {
  const analyzer = new ReanimatedWarningAnalyzer();
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity
  });

  const recentLines = [];
  let lineCount = 0;

  rl.on('line', (line) => {
    lineCount++;
    recentLines.push(line);
    
    // Keep only last 10 lines for context
    if (recentLines.length > 10) {
      recentLines.shift();
    }

    // Check if this is a Reanimated warning
    if (analyzer.isReanimatedWarningLine(line)) {
      const context = analyzer.extractContext(line, recentLines);
      analyzer.analyzeWarning(line, context);
    }
  });

  rl.on('close', () => {
    console.log(`\n📖 Processed ${lineCount} lines\n`);
    analyzer.printColoredReport();
    
    // Save JSON report if we found warnings
    if (analyzer.totalWarnings > 0) {
      analyzer.saveJsonReport();
    }
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n⏹️  Analysis interrupted by user\n');
    analyzer.printColoredReport();
    process.exit(0);
  });
}

// Help text
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🔍 Reanimated Warning Analyzer

This script analyzes logs to find unique Reanimated object mutation warnings.

Usage:
  # Analyze log file
  node scripts/analyze-reanimated-warnings.js < logfile.txt

  # Analyze live Metro output  
  npm start 2>&1 | node scripts/analyze-reanimated-warnings.js

  # Analyze specific component logs
  npx react-native log-android | grep -A5 -B5 "Reanimated" | node scripts/analyze-reanimated-warnings.js

Options:
  --help, -h    Show this help message

Output:
  - Console: Colored summary with top problematic keys
  - File: reanimated-warnings-report.json with detailed analysis
`);
  process.exit(0);
}

main().catch(console.error);