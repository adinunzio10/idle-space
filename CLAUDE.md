# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Signal Garden is an idle/incremental mobile game built with React Native and Expo. Players control an AI consciousness spreading through a dying galaxy by launching probes to establish quantum communication beacons. The core gameplay involves creating geometric patterns of connected beacons to generate resources and save dying stars.

## Test-Driven Development (TDD) Requirements

**MANDATORY**: All code changes must follow Test-Driven Development practices. No code should be written without corresponding tests following the appropriate Red-Green-Refactor cycle.

### For NEW CODE and REFACTORING

Follow the strict Red-Green-Refactor cycle:

1. **RED Phase**: Write a failing test first
   - Test should describe the desired behavior/API
   - Run test to confirm it fails for the right reason
   - Test failure validates the test is properly connected

2. **GREEN Phase**: Write minimal code to make the test pass
   - Implement only what's needed to pass the current test
   - Avoid over-engineering or adding extra features
   - Focus on making the test pass as simply as possible

3. **REFACTOR Phase**: Improve code while keeping tests green
   - Clean up implementation without changing behavior
   - Run tests continuously to ensure they remain green
   - Improve design, remove duplication, enhance readability

### For EXISTING CODE BUGS

Follow the characterization-then-fix approach:

1. **Characterize Current Behavior**: Write a test that passes by documenting the current buggy behavior
   - This test captures what the code currently does (even if wrong)
   - Serves as a safety net during refactoring
   - Documents the bug for future reference

2. **Define Correct Behavior**: Write a test that fails because it expects the correct behavior
   - This test specifies what the code should do
   - Initially fails because bug still exists
   - Guides the fix implementation

3. **Fix the Code**: Modify implementation to make the correct behavior test pass
   - Make minimal changes to address the specific bug
   - Ensure the correct behavior test now passes
   - May cause the characterization test to fail (expected)

4. **Clean Up**: Remove or update the bug-documenting test
   - Remove characterization test if no longer needed
   - Or update it to test a different edge case
   - Ensure final test suite represents desired behavior

### Testing Framework Requirements

Before implementing any feature or fix:

1. **Verify Test Framework**: Ensure Jest and React Native Testing Library are configured
   - Check `package.json` for test dependencies
   - Verify test scripts are available
   - Set up testing framework if not present

2. **Test File Organization**: Follow React Native testing conventions
   - Component tests: `__tests__/ComponentName.test.tsx`
   - Utility tests: `__tests__/utilityName.test.ts`
   - Integration tests: `__tests__/integration/`
   - E2E tests: Use Detox for critical user flows

3. **Test Coverage Requirements**:
   - All new functions/components must have tests
   - Bug fixes must include regression tests
   - Critical game systems require integration tests
   - Performance-sensitive code needs benchmark tests

### TDD Integration with Project Workflow

1. **Before Writing Code**: Always write the test first
2. **During Implementation**: Run tests frequently to stay in Green phase
3. **Before Commits**: Ensure all tests pass (`npm run test`)
4. **Code Quality**: Run `npm run lint` and `npm run type-check` after test pass
5. **Task Master Integration**: Update task status only after tests are green

### Game-Specific Testing Patterns

- **Game State**: Test state transitions and persistence
- **Animations**: Mock React Native Reanimated for unit tests
- **Performance**: Benchmark spatial algorithms and rendering
- **Touch Interactions**: Test gesture handling with React Native Testing Library
- **Offline Behavior**: Test resource generation during app backgrounding

## Development Commands

### Essential Commands

```bash
# Development
npm start                    # Start Expo development server
npm run android             # Run on Android device/emulator
npm run ios                 # Run on iOS device/simulator
npm run web                 # Run in web browser

# Code Quality
npm run lint                # Run ESLint on all TypeScript/JavaScript files
npm run lint:fix            # Auto-fix ESLint issues
npm run format              # Format code with Prettier
npm run format:check        # Check if code is properly formatted
npm run type-check          # Run TypeScript compiler without emitting files

# Testing (Required for all code changes - see TDD Requirements above)
npm test                    # Run all tests - MUST pass before commits
npm run test:watch          # Run tests in watch mode during development
npm run test:coverage       # Generate test coverage report

# Specific Test Categories (use these predefined scripts)
npm run test:galaxy         # Run galaxy map tests only
npm run test:worklet        # Run worklet tests only
npm run test:performance    # Run performance tests only
npm run test:gesture        # Run gesture-related tests only
npm run test:spatial        # Run spatial/geometric tests only
npm run test:component      # Run component tests only
npm run test:util           # Run utility tests only

# Custom Test Patterns (when predefined scripts don't exist)
npm test -- --testPathPattern=YourTestName    # Run specific test pattern
npm test -- --testNamePattern="describe name" # Run tests matching describe block

# IMPORTANT: Common Test Running Mistakes to AVOID
# ❌ WRONG: npm test --testPathPattern=Pattern    (missing the --)
# ❌ WRONG: jest --testPathPatterns=Pattern       (deprecated syntax)
# ❌ WRONG: npm run test Pattern                  (incorrect syntax)
# ✅ CORRECT: npm test -- --testPathPattern=Pattern
# ✅ CORRECT: Use predefined scripts: npm run test:galaxy
```

### Testing Framework Setup

**REQUIRED**: Jest and React Native Testing Library must be configured before any code implementation. If not present, add these dependencies:

```bash
npm install --save-dev jest @types/jest react-native-testing-library
npm install --save-dev @testing-library/jest-native @testing-library/react-native
npm install --save-dev detox # For E2E testing of critical user flows
```

## Architecture

### Technology Stack

- **Expo SDK 53**: Managed React Native development with simplified deployment
- **React Native 0.79**: Cross-platform mobile framework
- **TypeScript**: Type-safe JavaScript with strict mode enabled
- **NativeWind**: Tailwind CSS for React Native styling
- **React Native Reanimated**: High-performance animations
- **React Native Gesture Handler**: Touch gesture recognition

### Project Structure

```
/
├── App.tsx                 # Main application component and entry point
├── index.ts               # Expo app registration
├── global.css             # Tailwind CSS imports
├── assets/                # App icons, splash screens, images
├── scripts/prd.txt        # Product Requirements Document
└── .taskmaster/           # Task Master AI workflow files
```

### Styling System

- **NativeWind**: Use Tailwind utility classes in `className` props
- **Custom Theme**: Dark space theme with predefined colors:
  - `bg-background` (#111827) - Main background
  - `bg-surface` (#1F2937) - UI surfaces
  - `text-text` (#F9FAFB) - Primary text
  - `text-primary` (#4F46E5) - Primary accent
  - `text-secondary` (#7C3AED) - Secondary accent
  - `text-accent` (#F59E0B) - Highlight accent

### State Management

- **React Context**: Global game state management
- **Local Storage**: Save system using IndexedDB for complex game state
- **Auto-save**: Every 30 seconds and on significant actions

## Key Game Systems (Implementation Priorities)

### Phase 1: MVP Core Loop

1. **Galaxy Map Engine**: Infinite zoom/pan with beacon rendering
2. **Resource System**: Quantum Data generation and accumulation
3. **Beacon Network**: Manual placement with visual connections
4. **Save System**: Local persistence preventing progress loss
5. **Basic UI**: Resource display, controls, upgrade menus

### Phase 2: Strategic Depth

1. **Probe Types**: Pioneer, Harvester, and Architect with distinct roles
2. **Pattern Detection**: Geometric pattern bonuses (triangles through hexagons)
3. **Beacon Upgrades**: Individual leveling with specialization choices
4. **Resource Expansion**: Stellar Essence and Void Fragments currencies

### Phase 3: Meta-Progression

1. **Prestige System**: Quantum Leap resets with permanent benefits
2. **Discovery System**: Ancient Technologies with random bonuses
3. **Events**: Stellar Reignition cascade effects
4. **Premium Currency**: Chronos Particles for boosts

## Performance Requirements

### Target Metrics

- **60fps** animation on mid-range mobile devices
- **<3 seconds** app launch time
- **<100MB** total app size
- **Smooth performance** up to 500 visible beacons
- **Battery efficient** background processing

### Optimization Strategies

- Use CSS transforms for animations, not canvas redraws
- Implement beacon clustering beyond 500 visible beacons
- Efficient culling of off-screen elements
- Lazy loading of distant galaxy sectors
- Spatial indexing for pattern detection algorithms

## Development Guidelines

### Code Conventions

- **TypeScript**: Strict mode enabled, prefer type safety
- **Components**: Functional components with hooks
- **Styling**: NativeWind utility classes over custom CSS
- **File Organization**: Flat structure initially, organize by feature as needed
- **Imports**: Absolute imports from project root

### Mobile-First Design

- **Portrait Orientation**: One-handed thumb navigation
- **Touch Targets**: Minimum 44px for accessibility
- **Gestures**: Pinch/pan zoom, tap interactions only
- **Visual Design**: Dark space theme with high contrast beacons
- **Accessibility**: Respect system text size, haptic feedback

### Game Design Principles

- **Meaningful Progression**: Every action contributes to saving the galaxy
- **Visual Feedback**: Permanent progress visible on galaxy map
- **Offline Respect**: 50% resource generation while away (8 hour cap)
- **No Pay-to-Win**: Chronos Particles earned through gameplay only

## Task Master AI Instructions

**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

- dont start a new server overtop mine
