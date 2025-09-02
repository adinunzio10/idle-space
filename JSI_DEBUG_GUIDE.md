# JSI Crash Debugging Guide for Signal Garden

## Overview

This guide helps you systematically reproduce and analyze JSI crashes in React Native Reanimated, specifically the `facebook::jsi::Function::getHostFunction` errors occurring in the Galaxy Map gesture handling.

## Setup Complete ✅

- ✅ Expo Dev Tools plugins installed
- ✅ Hermes debugger configuration ready
- ✅ JSI Crash Tester component created
- ✅ Debug menu added to main app

## Debugging Workflow

### 1. Start Debugging Session

```bash
# Run the debug setup script
node debug-setup.js

# Start the development server
npm start
```

### 2. Enable Hermes Debugger

1. Open your app in development mode
2. In the Metro console, press **`j`** to open Hermes debugger
3. This opens Chrome DevTools connected to Hermes JSI engine
4. Go to **Sources** tab to set breakpoints in worklet code

### 3. Use the JSI Crash Tester

1. Open the app → tap **"🐛 Debug JSI Crashes"**
2. The tester provides:
   - Manual gesture testing area (pan/pinch box)
   - Automated crash reproduction test
   - Real-time crash logging

### 4. Reproduce Crashes Systematically

#### Method A: Manual Testing

1. Use rapid gesture combinations on the test box:
   - Fast pinch-to-zoom while panning
   - Multiple simultaneous touches
   - Rapid zoom in/out cycles
   - Interrupt gestures mid-animation

#### Method B: Automated Testing

1. Tap **"Start JSI Crash Test"**
2. This triggers 100 rapid SharedValue mutations
3. Includes complex object updates that may cause serialization errors
4. Monitor console and crash logs

### 5. Monitor for Crash Patterns

Watch for these specific error patterns:

#### JSI Function Errors

```
facebook::jsi::Function::getHostFunction
facebook::jsi::Function::call
RCTFatal: Unhandled JS Exception
```

#### Worklet Context Violations

```
Tried to access Reanimated value from not-worklet context
SharedValue accessed from main thread
Worklet thread context boundary violation
```

#### Memory/Serialization Issues

```
Cannot serialize object to SharedValue
JSON serialization failed in worklet
Memory access violation during gesture handling
```

### 6. Memory Profiling

#### Enable Memory Profiling

1. In Chrome DevTools (Hermes debugger):
   - Go to **Performance** tab
   - Click **Memory** checkbox
   - Start recording before reproducing crashes

#### React Native Memory Tools

```bash
# Enable JS heap profiling
adb shell setprop debug.jscheapdump.file /data/data/com.yourapp/cache/

# For iOS Simulator
xcrun simctl spawn booted log show --predicate 'process == "YourApp"' --info
```

### 7. Log Analysis

#### Metro Logs

- Watch for JSI-related errors in Metro console
- Look for call stack traces pointing to worklet boundaries
- Note timing of crashes relative to gesture events

#### Device Logs

```bash
# Android
adb logcat | grep -i "jsi\|worklet\|reanimated"

# iOS
xcrun simctl spawn booted log stream --predicate 'subsystem contains "Reanimated"'
```

## Common Crash Triggers

### 1. Complex SharedValue Objects

❌ **Problematic:**

```javascript
const complexValue = useSharedValue({
  nested: { data: 'test' },
  array: [1, 2, 3],
});
```

✅ **Better:**

```javascript
const data = useSharedValue('test');
const arrayItem = useSharedValue(1);
```

### 2. Rapid Value Mutations

❌ **Problematic:**

```javascript
// Rapid-fire updates in tight loop
for (let i = 0; i < 100; i++) {
  translateX.value = Math.random() * 200;
}
```

✅ **Better:**

```javascript
// Throttled updates
translateX.value = withTiming(newValue, { duration: 16 });
```

### 3. Cross-Context Access

❌ **Problematic:**

```javascript
// Accessing SharedValue from main thread during gesture
console.log('Value:', sharedValue.value); // Main thread
```

✅ **Better:**

```javascript
'worklet';
console.log('Value:', sharedValue.value); // Worklet thread
```

## Next Steps After Crash Reproduction

Once you've successfully reproduced JSI crashes:

1. **Document the exact steps** that trigger crashes
2. **Capture full error logs** with stack traces
3. **Note device/simulator differences** in crash behavior
4. **Test with different gesture speeds** and patterns
5. **Identify the specific SharedValue operations** causing issues

## Integration with Galaxy Map

After identifying crash patterns, apply findings to your Galaxy Map:

1. Check `src/components/galaxy/GalaxyMapView.tsx` for similar patterns
2. Look for complex SharedValue objects in gesture handlers
3. Identify rapid mutation scenarios during zoom/pan
4. Apply fixes based on crash reproduction insights

## Reporting Issues

When reporting to React Native Reanimated team:

1. Include full error logs from Hermes debugger
2. Provide minimal reproduction case
3. Specify React Native, Reanimated, and Expo versions
4. Include device/simulator information
5. Document gesture sequences that trigger crashes

---

**Ready to debug!** Start with `npm start` and follow the workflow above.
