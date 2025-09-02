/**
 * Web Accessibility Utilities
 *
 * Handles web-specific accessibility issues like the aria-hidden focus conflict.
 */

import { Platform } from 'react-native';

export const IS_WEB = Platform.OS === 'web';

/**
 * Manages focus and inert state for screen containers to prevent
 * aria-hidden accessibility violations on web.
 */
export class WebAccessibilityManager {
  private screenContainers = new Map<string, HTMLElement>();
  private observer: MutationObserver | null = null;

  constructor() {
    if (IS_WEB) {
      this.initializeObserver();
    }
  }

  private initializeObserver() {
    if (typeof document === 'undefined') return;

    this.observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'aria-hidden'
        ) {
          const target = mutation.target as HTMLElement;
          this.handleAriaHiddenChange(target);
        }
      });
    });

    // Start observing once DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.startObserving();
      });
    } else {
      this.startObserving();
    }
  }

  private startObserving() {
    if (!this.observer || typeof document === 'undefined') return;

    this.observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['aria-hidden'],
      subtree: true,
    });
  }

  private handleAriaHiddenChange(element: HTMLElement) {
    const isHidden = element.getAttribute('aria-hidden') === 'true';

    if (isHidden) {
      // When aria-hidden is set to true, also set inert to prevent focus
      this.setInert(element, true);
    } else {
      // When aria-hidden is removed, remove inert as well
      this.setInert(element, false);
    }
  }

  private setInert(element: HTMLElement, inert: boolean) {
    try {
      if (inert) {
        element.setAttribute('inert', '');
        // For browsers that don't support inert, manually disable focusable elements
        this.disableFocusableElements(element);
      } else {
        element.removeAttribute('inert');
        // Re-enable focusable elements
        this.enableFocusableElements(element);
      }
    } catch (error) {
      console.warn(
        '[WebAccessibilityManager] Error setting inert state:',
        error
      );
    }
  }

  private disableFocusableElements(container: HTMLElement) {
    const focusableSelectors = [
      'button',
      'input',
      'textarea',
      'select',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(', ');

    const focusableElements = container.querySelectorAll(focusableSelectors);

    focusableElements.forEach(element => {
      const htmlElement = element as HTMLElement;

      // Store original tabindex
      const originalTabIndex = htmlElement.getAttribute('tabindex');
      if (originalTabIndex !== null) {
        htmlElement.setAttribute('data-original-tabindex', originalTabIndex);
      }

      // Set tabindex to -1 to remove from tab order
      htmlElement.setAttribute('tabindex', '-1');

      // Store disabled state for form elements
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLButtonElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      ) {
        if (!element.disabled) {
          htmlElement.setAttribute('data-was-enabled', 'true');
          element.disabled = true;
        }
      }
    });
  }

  private enableFocusableElements(container: HTMLElement) {
    const focusableSelectors = [
      'button',
      'input',
      'textarea',
      'select',
      'a[href]',
      '[tabindex="-1"][data-original-tabindex]',
      '[contenteditable="true"]',
    ].join(', ');

    const focusableElements = container.querySelectorAll(focusableSelectors);

    focusableElements.forEach(element => {
      const htmlElement = element as HTMLElement;

      // Restore original tabindex
      const originalTabIndex = htmlElement.getAttribute(
        'data-original-tabindex'
      );
      if (originalTabIndex !== null) {
        htmlElement.setAttribute('tabindex', originalTabIndex);
        htmlElement.removeAttribute('data-original-tabindex');
      } else if (htmlElement.getAttribute('tabindex') === '-1') {
        htmlElement.removeAttribute('tabindex');
      }

      // Restore disabled state for form elements
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLButtonElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      ) {
        if (htmlElement.getAttribute('data-was-enabled') === 'true') {
          element.disabled = false;
          htmlElement.removeAttribute('data-was-enabled');
        }
      }
    });
  }

  /**
   * Register a screen container for accessibility management
   */
  registerScreenContainer(screenId: string, element: HTMLElement) {
    if (!IS_WEB) return;

    this.screenContainers.set(screenId, element);

    // Check current aria-hidden state
    const isHidden = element.getAttribute('aria-hidden') === 'true';
    if (isHidden) {
      this.setInert(element, true);
    }
  }

  /**
   * Unregister a screen container
   */
  unregisterScreenContainer(screenId: string) {
    if (!IS_WEB) return;

    const element = this.screenContainers.get(screenId);
    if (element) {
      this.setInert(element, false);
      this.screenContainers.delete(screenId);
    }
  }

  /**
   * Manually set a container as active/inactive
   */
  setScreenActive(screenId: string, active: boolean) {
    if (!IS_WEB) return;

    const element = this.screenContainers.get(screenId);
    if (element) {
      this.setInert(element, !active);
    }
  }

  /**
   * Clean up observer and resources
   */
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Re-enable all elements
    this.screenContainers.forEach(element => {
      this.setInert(element, false);
    });

    this.screenContainers.clear();
  }
}

// Global instance
export const webAccessibilityManager = new WebAccessibilityManager();

/**
 * Hook to register screen containers for accessibility management
 */
export const useWebAccessibility = (screenId: string) => {
  if (!IS_WEB) return {};

  const registerContainer = (element: HTMLElement | null) => {
    if (element) {
      webAccessibilityManager.registerScreenContainer(screenId, element);
    }
  };

  const unregisterContainer = () => {
    webAccessibilityManager.unregisterScreenContainer(screenId);
  };

  return {
    registerContainer,
    unregisterContainer,
    setActive: (active: boolean) =>
      webAccessibilityManager.setScreenActive(screenId, active),
  };
};
