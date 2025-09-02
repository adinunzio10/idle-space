# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Signal Garden is an idle/incremental mobile game built with React Native and Expo. Players control an AI consciousness spreading through a dying galaxy by launching probes to establish quantum communication beacons. The core gameplay involves creating geometric patterns of connected beacons to generate resources and save dying stars.

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
```

### Testing

No test framework is currently configured. When implementing tests, check if Jest, React Native Testing Library, or Detox should be added based on project needs.

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
