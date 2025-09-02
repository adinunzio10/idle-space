/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './screens/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5',
        secondary: '#7C3AED',
        accent: '#F59E0B',
        background: '#111827',
        surface: '#1F2937',
        text: '#F9FAFB',
      },
      // Web-optimized animations and transitions
      transitionTimingFunction: {
        'bounce-custom': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        0: '0ms',
        50: '50ms',
        100: '100ms',
        200: '200ms',
        300: '300ms',
        500: '500ms',
      },
      // Touch-optimized spacing
      spacing: {
        18: '4.5rem', // 72px - good touch target
        22: '5.5rem', // 88px - larger touch target
      },
      // Web gesture container utilities
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [
    // Custom plugin for web gesture optimizations
    function ({ addUtilities }) {
      const newUtilities = {
        '.touch-manipulation': {
          'touch-action': 'manipulation',
        },
        '.touch-pan-x': {
          'touch-action': 'pan-x',
        },
        '.touch-pan-y': {
          'touch-action': 'pan-y',
        },
        '.touch-pan-xy': {
          'touch-action': 'pan-x pan-y',
        },
        '.touch-none': {
          'touch-action': 'none',
        },
        '.select-none-important': {
          'user-select': 'none !important',
          '-webkit-user-select': 'none !important',
          '-moz-user-select': 'none !important',
          '-ms-user-select': 'none !important',
        },
        '.drag-none': {
          '-webkit-user-drag': 'none',
          '-moz-user-drag': 'none',
          'user-drag': 'none',
        },
        '.tap-highlight-none': {
          '-webkit-tap-highlight-color': 'transparent',
        },
        '.gpu-accelerated': {
          transform: 'translateZ(0)',
          '-webkit-transform': 'translateZ(0)',
          'will-change': 'transform',
        },
        '.gesture-container': {
          'touch-action': 'none',
          'user-select': 'none',
          '-webkit-user-select': 'none',
          '-moz-user-select': 'none',
          '-ms-user-select': 'none',
          '-webkit-tap-highlight-color': 'transparent',
          '-webkit-user-drag': 'none',
          'user-drag': 'none',
          transform: 'translateZ(0)',
          'will-change': 'transform',
        },
        '.scrollable-area': {
          'touch-action': 'pan-x pan-y',
          overflow: 'auto',
          '-webkit-overflow-scrolling': 'touch',
        },
        // Hide scrollbars while keeping functionality
        '.hide-scrollbar': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
        },
        '.hide-scrollbar::-webkit-scrollbar': {
          display: 'none',
        },
      };

      addUtilities(newUtilities, ['responsive', 'hover']);
    },
  ],
};
