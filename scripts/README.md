# Reanimated Warning Analyzer

A Node.js script to analyze and extract unique Reanimated object mutation warnings from your React Native logs.

## Quick Usage

### Option 1: Analyze saved log file
```bash
# Save your logs first
npm start > app.log 2>&1

# Then analyze
cat app.log | npm run analyze:reanimated
```

### Option 2: Live analysis while developing  
```bash
# This will start your iOS app AND analyze warnings in real-time
npm run dev:analyze
```

### Option 3: Analyze specific log file
```bash
node scripts/analyze-reanimated-warnings.js < your-logfile.txt
```

## Example Output

```
🔍 REANIMATED OBJECT MUTATION ANALYSIS
=====================================

📊 Summary:
   • Total warnings: 847
   • Unique keys: 9
   • Contexts: BeaconRenderingModule, StarSystemModule

🚨 Most Problematic Keys:

🔴 Key: `x`
   Count: 234 (27.6%)
   Contexts: BeaconRenderingModule
   Duration: 10:15:23 - 10:18:45

🔴 Key: `y`
   Count: 234 (27.6%)
   Contexts: BeaconRenderingModule
   Duration: 10:15:23 - 10:18:45

🟡 Key: `size`
   Count: 89 (10.5%)
   Contexts: StarSystemModule
   Duration: 10:16:12 - 10:18:45

💡 Recommendations:

1. Priority fix: Keys [x, y, size] - these cause 557 warnings
2. Focus on modules: BeaconRenderingModule, StarSystemModule  
3. Clone these object properties before passing to Reanimated worklets
4. Consider using Object.freeze() for immutable data

🔧 Quick Fix Template:

```javascript
// Clone object before passing to Reanimated
const clonedObject = {
  x: originalObject.x, // Fixed: 234 warnings
  y: originalObject.y, // Fixed: 234 warnings
  size: originalObject.size, // Fixed: 89 warnings
  color: originalObject.color, // Fixed: 67 warnings
  glowSize: originalObject.glowSize, // Fixed: 45 warnings
};
```

📄 Detailed report saved to: /path/to/reanimated-warnings-report.json
```

## What It Does

1. **Extracts unique keys** being mutated (x, y, size, color, etc.)
2. **Counts frequency** - shows which keys cause the most warnings
3. **Identifies context** - which modules/components are problematic  
4. **Provides fix templates** - ready-to-use code snippets
5. **Saves detailed JSON report** for further analysis

## Interpreting Results

- 🔴 **Red (>100 warnings)**: High priority - fix immediately
- 🟡 **Yellow (50-100 warnings)**: Medium priority - fix this sprint  
- 🟢 **Green (<50 warnings)**: Low priority - technical debt

## Files Generated

- `reanimated-warnings-report.json` - Detailed analysis with timestamps
- Console output with prioritized fix recommendations

This helps you focus your fixes on the most impactful mutations first!