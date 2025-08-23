# Galaxy Map Gestures Guide

## Overview
The Galaxy Map in Signal Garden supports intuitive touch gestures for navigation and interaction. All gestures are optimized for smooth performance and include momentum physics for natural feel.

## Navigation Gestures

### Pan/Drag
**Gesture**: Single finger drag  
**Function**: Navigate around the galaxy  
**Features**:
- Smooth panning with momentum decay
- Elastic boundaries that provide resistance at galaxy edges
- Automatic spring-back to valid bounds when released
- Momentum continues after release for natural feel

### Pinch to Zoom
**Gesture**: Two-finger pinch/spread  
**Function**: Zoom in and out of the galaxy view  
**Features**:
- Focal point zooming - zooms toward/away from pinch center
- Scale range: 0.1x to 10x zoom
- Smooth spring animations when gesture ends
- Automatic translation adjustment to keep focal point centered
- Elastic constraints prevent over-zooming

### Double Tap to Zoom
**Gesture**: Quick double tap anywhere on screen  
**Function**: Smart zoom toggle  
**Behavior**:
- If zoomed out (scale < 2x): Zooms to 3x at tap location
- If zoomed in (scale ≥ 2x): Zooms out to 1x centered view
- Smooth spring animation to new zoom level
- Centers on the tapped point when zooming in

## Interaction Gestures

### Single Tap
**Gesture**: Single finger tap  
**Function**: Select beacons, clusters, or interact with map  
**Priority Order** (first match wins):
1. **Cluster Selection**: Taps on beacon clusters select the first beacon in the cluster
2. **Connection Selection**: Taps near connection lines select the source beacon
3. **Beacon Selection**: Taps on individual beacons select that beacon
4. **Map Interaction**: Taps on empty space trigger map press events (for placing new beacons)

**Features**:
- Dynamic hit radius that adjusts based on zoom level
- Larger hit areas when zoomed out for easier targeting
- Visual feedback for selected elements

## Technical Features

### Performance Optimizations
- **60 FPS target** on mid-range devices
- Efficient hit testing with spatial indexing
- Level-of-detail (LOD) rendering based on zoom level
- Gesture handling runs on UI thread for responsiveness
- Automatic clustering of beacons at low zoom levels

### Physics System
- **Momentum Decay**: Pan gestures continue with realistic momentum after release
- **Elastic Boundaries**: Gentle resistance when panning beyond galaxy edges
- **Spring Animations**: Smooth transitions for zoom and constraint corrections
- **Velocity Damping**: Natural slowdown when hitting boundaries

### Gesture Composition
- **Race Condition Handling**: Double tap takes priority over single tap
- **Simultaneous Gestures**: Pan and pinch work together seamlessly
- **Gesture Prevention**: Active gestures prevent conflicting interactions

## Zoom-Dependent Behavior

### High Zoom (Close View)
- Individual beacons are fully visible with details
- Precise selection of specific beacons and connections
- All connection lines rendered
- Smaller hit radius for accurate targeting

### Medium Zoom (Overview)
- Beacon clustering begins to group nearby beacons
- Connection filtering to prevent visual clutter
- Balanced detail and performance

### Low Zoom (Galaxy View)
- Heavy clustering of beacons into larger groups
- Major connections only
- Larger hit radius for easier interaction with clusters
- Star field background with parallax effect

## Accessibility Features
- **Minimum Touch Targets**: 44px minimum for accessibility compliance
- **Haptic Feedback**: Tactile confirmation for selections (when supported)
- **High Contrast**: Dark space theme with bright beacon colors
- **Zoom Accommodation**: Respects system text size preferences

## Performance Tips
- Galaxy remains responsive up to 500+ visible beacons
- Automatic performance scaling reduces effects on older devices
- Battery-efficient background processing
- Smooth performance maintained during active gestures

## Troubleshooting

### Gesture Not Responding
- Ensure device supports multi-touch for pinch gestures
- Check if other UI elements are intercepting touches
- Try single-finger gestures first to verify basic functionality

### Performance Issues
- Performance automatically scales based on device capabilities
- Complex patterns detection may be disabled on slower devices
- Beacon clustering increases automatically to maintain 60fps

---

*This gesture system is built with React Native Reanimated v3 and React Native Gesture Handler for optimal performance and smooth animations.*