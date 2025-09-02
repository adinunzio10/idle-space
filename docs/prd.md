<context>
# Overview  
The Signal Garden is an idle/incremental mobile game where players control an AI consciousness spreading through a dying galaxy. The core concept involves launching probe networks to harvest energy from decaying stars while establishing quantum communication beacons that slow entropy in local regions. Each beacon creates a bubble of stability in the cosmic decay, and players work to create beautiful constellation patterns of connected systems that can reverse the galaxy's decline.

The game solves the idle game problem of meaningless progression by making every action contribute to saving the galaxy. Players feel like they're building something permanent and beautiful rather than just watching numbers increase. The target audience is idle game enthusiasts who appreciate meaningful progression and want to feel accomplished when they return to the game.

The unique element is the "quantum resonance" system where beacons connected in specific geometric patterns create resonance fields that dramatically boost efficiency and can spontaneously reignite dead stars. This creates a strategic puzzle element where players optimize network shapes rather than just expanding randomly. The game combines network expansion mechanics with stellar lifecycle management, creating a satisfying "garden tending" experience in space.

# Core Features

## Resource System

**Quantum Data** - Primary currency generated per second by active beacons. Used for most upgrades and actions.

**Stellar Essence** - Harvested from dying stars using Harvester probes. Required for beacon construction and major upgrades.

**Void Fragments** - Collected from completely dead systems. Used for advanced late-game upgrades and prestige mechanics.

**Resonance Crystals** - Special currency generated only when beacons form geometric patterns (triangles, squares, pentagons, hexagons). Used for unlocking pattern bonuses and quantum leap upgrades.

**Chronos Particles** - Premium currency earned through achievements, discoveries, and perfect geometric patterns. Cannot be purchased with real money. Used for instant timers and temporary network-wide boosts.

## Probe System

**Pioneer Probes** - Fast deployment, establish beacons quickly but generate fewer resources. Best for rapid expansion into new sectors.

**Harvester Probes** - Slow deployment, maximum resource extraction from dying stars. Essential for gathering Stellar Essence efficiently.

**Architect Probes** - Medium speed, beacons built by these have larger connection ranges enabling complex pattern formation.

Players can manually launch probes for 2x speed or let them auto-launch every 60 seconds. Each probe type serves a specific strategic purpose in network expansion.

## Beacon Network System

Beacons automatically level up based on time active and number of connections. Every 5 levels, players choose a specialization: Efficiency (more resources), Range (larger connection radius), or Stability (pattern bonus multiplier).

Geometric patterns provide multiplicative bonuses: Triangles (1.5x), Squares (2x), Pentagons (3x), Hexagons (5x). Overlapping patterns stack multiplicatively, creating exponential growth opportunities for skilled players.

## Progression Mechanics

**Consciousness Expansion** - Linear unlocks based on total active beacons. Each milestone offers choice between two permanent upgrades (probe speed vs launch capacity, resource generation vs offline earnings).

**Ancient Technologies** - Random permanent passive bonuses discovered when establishing beacons in dead systems. No complex quest chains, just satisfying discoveries that add permanent progress.

**Stellar Reignition Events** - When enough stars are saved in a sector, triggers cascade effect that auto-revives nearby dead stars with major visual spectacle and permanent resource bonuses.

## Idle Mechanics

**Offline Progression** - Earn 50% of active rate while offline, capped at 8 hours to respect player time. Active beacons continue generating resources, but no new expansion occurs.

**Active Benefits** - "Quantum Surge" button available every 30 minutes provides 10x resources for 60 seconds. Manual probe launches are 2x faster. Players can manually trigger resonance pattern detection.

**Quantum Leap Prestige** - Reset network but keep discovered patterns and unlock "Echo Beacons" that start at higher levels. Each leap makes decay spread slower, providing permanent meta-progression.

# User Experience

## Target User Personas

**Primary**: Idle game enthusiasts who want meaningful progression and permanent accomplishments
**Secondary**: Space theme fans who enjoy building and expansion mechanics
**Tertiary**: Casual mobile gamers seeking relaxing but engaging gameplay

## Core User Flow

1. Launch app → View galaxy map showing current network
2. Check resource generation and any overnight progress
3. Launch new probes to expand network (manual or auto)
4. Optimize beacon patterns for bonus multipliers
5. Spend resources on upgrades and new capabilities
6. Discover ancient technologies and trigger reignition events
7. Eventually perform Quantum Leap for meta-progression

## UI/UX Design Principles

**Mobile-First Portrait Orientation** - One-handed play is crucial for idle games. All interactions accessible with thumb.

**Minimalist HUD** - Galaxy map IS the main interface. Resource counters fixed at top, key actions at bottom via floating action button.

**Visual Design** - Dark space theme with deep purples/blacks, bright cyan/white beacons connected by subtle pulsing lines. Parallax star layers create depth without complexity.

**Gesture Controls** - Smooth pinch/pan zoom navigation. Tap for all actions. No complex gesture combinations.

**Modal Overlays** - Upgrades and statistics appear as overlays rather than separate screens to maintain immersion in the galaxy view.

## Accessibility Considerations

- High contrast beacon colors for visibility
- Large touch targets for all interactive elements
- Optional haptic feedback for important actions
- Text size respects system accessibility settings

# Technical Architecture

## Platform Strategy

**Expo with TypeScript** - Managed React Native development for rapid iteration and simplified deployment. Single codebase for iOS and Android with automatic native module management. Web support through Expo Web for broader platform reach.

**NativeWind** - Tailwind CSS for React Native, providing utility-first styling optimized for mobile performance and Expo compatibility.

## Data Management

**Local-First Architecture** - IndexedDB for complex game state, localStorage for settings. Auto-save every 30 seconds and on significant actions.

**Cloud Saves** - Post-launch feature. Local storage provides immediate functionality without server dependencies.

**State Management** - React Context for global game state, optimized for frequent updates without performance issues.

## Performance Targets

**Beacon Rendering** - Smooth performance up to 500 visible beacons. Beyond 500, cluster distant beacons into "sectors" showing combined glow effects.

**Animation Strategy** - CSS transforms for smooth animations rather than canvas redraws. Particle effects only for major events.

**Memory Management** - Efficient culling of off-screen elements, lazy loading of distant galaxy sectors.

## Technical Requirements

- 60fps animation on mid-range mobile devices
- <3 second app launch time
- <100MB total app size
- Offline functionality for core gameplay
- Battery efficiency for background processing

# Development Roadmap

## MVP Phase (6-8 weeks)

**Core Resource Loop** - Quantum Data and Stellar Essence as primary currencies. Single auto-launching probe type every 60 seconds.

**Basic Network Building** - Beacons generate resources based on simple connection count (no patterns yet). Manual beacon placement on galaxy map.

**Fundamental Progression** - Unlock new galaxy sectors as network expands. Basic upgrade system for beacon efficiency.

**Offline Mechanics** - Simple offline progression calculation. Resource accumulation while away from game.

**Visual Foundation** - Dark space theme, beacon connections, smooth zoom/pan controls. No complex effects yet.

**Essential UI** - Resource display, probe launch button, basic upgrade menu. Core interaction patterns established.

## Phase 2: Pattern System (4-6 weeks)

**Three Probe Types** - Pioneer, Harvester, and Architect with distinct roles and strategic purposes.

**Geometric Pattern Bonuses** - Triangle through hexagon pattern detection with multiplicative bonuses. Visual feedback for pattern completion.

**Beacon Upgrades** - Individual beacon leveling with specialization choices every 5 levels.

**Void Fragments** - Third resource currency from dead systems. Advanced upgrade paths requiring strategic resource management.

**Pattern Discovery** - Permanent collection system for found patterns. Visual pattern library accessible from main screen.

## Phase 3: Advanced Systems (4-6 weeks)

**Quantum Leap Prestige** - Meta-progression system with Echo Beacons and decay rate improvements.

**Ancient Technologies** - Random discovery system providing permanent passive bonuses.

**Stellar Reignition Events** - Major cascade events with spectacular visual effects and permanent sector bonuses.

**Chronos Particles** - Premium currency system with boost mechanics and instant completion options.

**Consciousness Expansion** - Choice-based permanent upgrades tied to network size milestones.

## Post-Launch Features

**Weekly Galaxy Heat Map** - Anonymous visualization of global player progress. Community engagement without direct competition.

**Pattern Collection Gallery** - Visual showcase of discovered patterns with rarity indicators and completion tracking.

**Achievement System** - Milestone tracking with Chronos Particle rewards for major accomplishments.

**Enhanced Audio/Visual** - Particle effects, ambient music, sound design for major events and interactions.

**Seasonal Events** - Limited-time anomalies offering unique rewards and temporary gameplay variations.

# Logical Dependency Chain

## Foundation Phase Requirements

1. **Galaxy Map Engine** - Core rendering system with zoom/pan/tap interaction must work perfectly before any other features
2. **Resource Generation** - Basic Quantum Data accumulation system provides the fundamental progression loop
3. **Beacon Placement** - Manual beacon placement with visual connections establishes core gameplay mechanic
4. **Save System** - Local data persistence prevents player progress loss and enables offline calculation

## Core Loop Dependencies

1. **Probe Launch System** - Automated expansion mechanism builds on beacon placement foundation
2. **Basic Upgrades** - Resource spending creates progression motivation using established resource generation
3. **Offline Progression** - Builds on save system and resource generation to respect player time
4. **Visual Polish** - Enhances established mechanics without changing core functionality

## Advanced Feature Dependencies

1. **Pattern System** - Requires stable beacon network and visual connection system as foundation
2. **Multiple Probe Types** - Builds on established launch system with strategic complexity
3. **Prestige Mechanics** - Requires stable core progression loop to provide meaningful reset incentive
4. **Special Events** - Builds on all previous systems to provide advanced gameplay variations

## Technical Dependencies

1. **Performance Optimization** - Must happen alongside feature development, not as afterthought
2. **Platform Compatibility** - React Native setup enables simultaneous multi-platform development
3. **Data Migration** - Save system must support future feature additions without breaking existing saves

# Risks and Mitigations

## Technical Challenges

**Risk**: Performance degradation with large beacon networks
**Mitigation**: Implement clustering and LOD system early, performance testing at each milestone

**Risk**: Complex geometric pattern detection causing lag
**Mitigation**: Efficient algorithms with spatial indexing, limit pattern complexity in initial release

**Risk**: Save data corruption or loss
**Mitigation**: Multiple backup slots, incremental saves, extensive testing of edge cases

## Game Design Challenges

**Risk**: Idle progression feels meaningless or repetitive
**Mitigation**: Meaningful visual feedback for every action, permanent progress that survives resets

**Risk**: Pattern optimization becomes too complex for casual players
**Mitigation**: Automatic pattern suggestions, visual hints, optional complexity layers

**Risk**: Resource inflation making numbers meaningless
**Mitigation**: Prestige system resets scale, scientific notation, focus on percentage improvements

## Development Challenges

**Risk**: Feature creep delaying MVP launch
**Mitigation**: Strict MVP scope definition, post-launch roadmap for advanced features

**Risk**: Balancing difficulty across different play styles
**Mitigation**: Extensive analytics, gradual difficulty scaling, multiple progression paths

**Risk**: Monetization pressure conflicting with player-friendly design
**Mitigation**: No purchasable premium currency, focus on engagement over extraction

# Appendix

## Competitive Analysis

**AdVenture Capitalist** - Excellent progression clarity but lacks thematic coherence
**Universal Paperclips** - Great narrative integration but too complex for casual play  
**Kittens Game** - Deep mechanics but overwhelming UI for mobile
**Antimatter Dimensions** - Strong prestige system but abstract theme

**Differentiation**: Signal Garden combines meaningful theme with elegant mechanics, avoiding complexity overwhelm while maintaining strategic depth.

## Technical Specifications

**Minimum Requirements**: iOS 12+, Android 7+, 2GB RAM, 500MB storage
**Development Stack**: Expo SDK 49+, TypeScript 5+, NativeWind 2+
**Testing Strategy**: Unit tests for game logic, integration tests for save/load, performance testing on target devices

## Success Metrics

**Engagement**: 7-day retention >40%, 30-day retention >15%
**Progression**: 80% of players reach first prestige within 2 weeks
**Satisfaction**: App store rating >4.2, positive feedback on progression pacing
**Technical**: <5% crash rate, 95% of sessions complete successfully

## Future Expansion Possibilities

**Multiplayer Elements**: Guild networks, shared galaxy sectors, cooperative events
**Narrative Expansion**: AI consciousness backstory, ancient civilization discoveries
**Platform Extensions**: Desktop version, browser implementation, smartwatch companion
**Merchandising**: Galaxy map prints, pattern collection cards, soundtrack release
</context>
<PRD>

# Technical Architecture

**Core Technology Stack**

- Expo with TypeScript for managed cross-platform mobile development
- NativeWind for Tailwind CSS styling optimized for React Native
- IndexedDB for complex game state persistence
- React Context for global state management
- CSS transforms for smooth 60fps animations

**System Components**

- Galaxy map rendering engine with infinite zoom/pan capabilities
- Beacon network calculation system with pattern detection algorithms
- Resource generation engine with offline progression calculations
- Save/load system with automatic backup and corruption recovery
- Performance monitoring with automatic LOD switching

**Data Models**

- Beacon entities with position, level, connections, specialization
- Probe objects with type, destination, launch time, completion status
- Player state including resources, unlocks, discoveries, settings
- Galaxy sectors with star data, death rates, reignition status
- Pattern library with discovered configurations and bonus multipliers

**APIs and Integrations**

- Local device storage APIs for immediate save/load functionality
- Future cloud save integration for cross-device synchronization
- Analytics SDK for player behavior tracking and balance optimization
- Platform-specific APIs for haptic feedback and system integration

**Infrastructure Requirements**

- Client-side only for MVP, no server dependencies
- Efficient memory management for large beacon networks
- Background processing for resource generation and offline calculation
- Platform stores for distribution (App Store, Google Play)

# Development Roadmap

**MVP Phase (Target: 6-8 weeks)**
Core idle game loop with single probe type, basic resource generation, manual beacon placement, simple upgrades, and offline progression. Galaxy map with smooth navigation and beacon connection visualization. Essential UI with resource display and upgrade menu. Local save system preventing progress loss.

**Phase 2: Strategic Depth (Target: 4-6 weeks)**  
Three distinct probe types with unique strategic purposes. Geometric pattern detection system with multiplicative bonuses for triangles through hexagons. Individual beacon upgrading with specialization choices. Void Fragments resource from dead systems. Visual pattern discovery and collection system.

**Phase 3: Meta-Progression (Target: 4-6 weeks)**
Quantum Leap prestige system with Echo Beacons and permanent meta-progression. Ancient technology discovery system with random permanent bonuses. Stellar reignition cascade events with spectacular visual effects. Chronos Particles premium currency with boost mechanics. Consciousness expansion milestones with choice-based upgrades.

**Post-Launch Enhancements**
Weekly global galaxy heat map showing anonymous player progress. Enhanced visual effects and particle systems for major events. Achievement system with milestone tracking. Seasonal anomaly events with unique rewards. Audio design and ambient soundtrack implementation.

# Logical Dependency Chain

**Foundation Requirements (Must be built first)**
Galaxy map rendering engine → Resource generation system → Beacon placement mechanics → Local save system → Basic UI framework

**Core Loop Development (Built on foundation)**  
Probe launch automation → Basic upgrade system → Offline progression calculations → Visual connection system → Performance optimization

**Strategic Layer Addition (Requires stable core)**
Pattern detection algorithms → Multiple probe types → Beacon specialization system → Advanced resource management → Pattern collection interface

**Meta-Progression Systems (Requires complete core gameplay)**
Prestige reset mechanics → Ancient technology system → Cascade event triggers → Premium currency systems → Achievement tracking

**Polish and Enhancement (Final layer)**
Advanced visual effects → Audio implementation → Social features → Seasonal content → Platform-specific optimizations

# Risks and Mitigations

**Technical Challenges**
Performance scaling with large beacon networks - Implement clustering and level-of-detail systems early in development with continuous performance monitoring on target devices.

Complex pattern detection algorithms causing frame drops - Use spatial indexing and limit real-time calculations, cache pattern results and update incrementally.

Save data corruption or device storage limitations - Multiple backup slots with incremental saves, extensive testing of edge cases and recovery scenarios.

**Product Design Risks**
Idle progression becoming meaningless over time - Focus on permanent visual progress, meaningful milestone rewards, and prestige systems that preserve player accomplishment.

Pattern optimization overwhelming casual players - Provide automatic suggestions, visual hints for beneficial patterns, and optional complexity layers for advanced players.

Resource inflation making numbers incomprehensible - Implement prestige resets before numbers become unwieldy, use scientific notation, focus on percentage-based improvements.

**Development and Business Risks**  
Feature creep delaying core loop validation - Maintain strict MVP scope, defer advanced features to post-launch roadmap with clear prioritization criteria.

Balancing difficulty across different engagement levels - Implement comprehensive analytics, gradual difficulty scaling, and multiple progression paths for different play styles.

Platform approval and policy compliance - Research platform requirements early, implement appropriate content ratings, ensure compliance with mobile platform guidelines.

# Appendix

**Research Findings**
Analysis of successful idle games shows that meaningful visual progress and permanent advancement are key retention drivers. Games with abstract themes struggle with long-term engagement compared to those with coherent narratives. Mobile idle games must respect player time with generous offline progression and avoid punishment mechanics.

**Technical Specifications**
Minimum device requirements: iOS 13+ (Expo SDK 49+), Android API 24+, 2GB RAM, 500MB storage space. Target 60fps performance on mid-range devices. Maximum 3-second launch time, sub-second response to user interactions. Battery-efficient background processing for resource calculation.

**Success Metrics and KPIs**
Player retention: 7-day >40%, 30-day >15%. Progression milestones: 80% reach first prestige within 14 days. Technical performance: <5% crash rate, 95% session completion. User satisfaction: App store rating >4.2, positive progression pacing feedback. Engagement depth: Average session >5 minutes, daily active users >60% of weekly active.
</PRD>
