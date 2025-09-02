// Debug Setup for JSI Crash Investigation
// Run this file to enable detailed debugging for React Native Reanimated JSI crashes

console.log('🔍 Setting up debugging environment for JSI crash analysis...\n');

// 1. Check current React Native and Reanimated versions
console.log('📋 Current Environment:');
const packageJson = require('./package.json');
console.log(`  - React Native: ${packageJson.dependencies['react-native']}`);
console.log(
  `  - Reanimated: ${packageJson.dependencies['react-native-reanimated']}`
);
console.log(`  - Expo: ${packageJson.dependencies['expo']}\n`);

// 2. Instructions for Hermes debugger setup
console.log('🚀 Hermes Debugger Setup Instructions:');
console.log('  1. Start your app with: npm start');
console.log('  2. Open the app in development mode');
console.log('  3. In the Metro console, press "j" to open debugger');
console.log('  4. This will open Chrome DevTools connected to Hermes\n');

// 3. Instructions for crash reproduction
console.log('⚠️  JSI Crash Reproduction Steps:');
console.log('  1. Open Galaxy Map in the app');
console.log('  2. Perform rapid gesture combinations:');
console.log('     - Fast pinch-to-zoom while panning');
console.log('     - Multiple simultaneous touches');
console.log('     - Rapid zoom in/out cycles');
console.log('  3. Watch Metro logs for JSI-related errors\n');

// 4. Log analysis instructions
console.log('📊 What to look for in crash logs:');
console.log('  - facebook::jsi::Function::getHostFunction errors');
console.log('  - Worklet execution context violations');
console.log('  - SharedValue serialization errors');
console.log('  - Memory access violations during gesture handling\n');

console.log('✅ Debug environment ready! Start debugging with "npm start"');
