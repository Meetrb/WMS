import { useEffect } from 'react';

/**
 * Hook to enable Enter-key navigation between form fields.
 * Moves focus to the next editable form field on Enter press.
 * By default, non-submit action buttons are skipped to keep data-entry flow smooth.
 * On the last field, optionally triggers submission.
 *
 * Usage:
 * const formRef = useRef<HTMLFormElement>(null);
 * useEnterNavigation(formRef, { submitOnLast: true });
 */
export const useEnterNavigation = (
  formRef: React.RefObject<HTMLFormElement | null>,
  options: {
    submitOnLast?: boolean;
    excludeSelectors?: string[];
    focusFirstOnMount?: boolean;
    enabled?: boolean;
    focusDelayMs?: number;
  } = {}
) => {
  const {
    submitOnLast = false,
    excludeSelectors,
    focusFirstOnMount = true,
    enabled = true,
    focusDelayMs = 0,
  } = options;

  useEffect(() => {
    if (!enabled || !formRef.current) return;

    const form = formRef.current;
    let timeoutId: number | null = null;
    let rafId: number | null = null;

    const getFocusableElements = () => {
      return Array.from(
        form.querySelectorAll(
          [
            'input:not([type="hidden"]):not([disabled]):not([tabindex="-1"])',
            'textarea:not([disabled]):not([tabindex="-1"])',
            'select:not([disabled]):not([tabindex="-1"])',
            '[role="combobox"]:not([disabled]):not([tabindex="-1"])',
            'button:not([disabled]):not([tabindex="-1"])',
            '[data-enter-nav="include"]:not([disabled]):not([tabindex="-1"])',
          ].join(', ')
        )
      ) as HTMLElement[];
    };

    // Focus first field when the form appears, unless focus is already inside the form.
    if (focusFirstOnMount) {
      const focusFirst = () => {
        if (!formRef.current) return;
        const activeElement = document.activeElement as HTMLElement | null;
        if (activeElement && form.contains(activeElement)) return;

        const firstElement = getFocusableElements().find(
          (element) => element.tabIndex !== -1
        );

        if (firstElement) {
          firstElement.focus();
          if (firstElement instanceof HTMLInputElement || firstElement instanceof HTMLTextAreaElement) {
            firstElement.select();
          }
        }
      };

      if (focusDelayMs > 0) {
        timeoutId = window.setTimeout(focusFirst, focusDelayMs);
      } else {
        rafId = window.requestAnimationFrame(focusFirst);
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle Enter key, not Shift+Enter
      if (event.key !== 'Enter' || event.shiftKey) return;

      const target = event.target as HTMLElement;
      
      // Check if the event happened inside our form
      if (!form.contains(target)) return;

      // Skip if target is a textarea (allow newlines in textarea)
      if (target instanceof HTMLTextAreaElement) return;

      // Skip excluded selectors
      if (
        excludeSelectors?.some((selector) =>
          target.closest(selector)
        )
      ) {
        return;
      }
      
      // If we're on a Select or similar component that is currently OPEN,
      // let the component handle the Enter key for selection.
      const trigger = target.closest('[role="combobox"], [data-enter-nav="include"]');
      if (trigger && trigger.getAttribute('aria-expanded') === 'true') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      // Increased timeout to 50ms to allow cascading field state updates (e.g., Country -> State) to propagate to the DOM
      setTimeout(() => {
        // Get all focusable elements in the form (AFTER the state update from potential selection)
        const focusableElements = getFocusableElements();

        // Find which focusable element contains the target (or is the target)
        const currentElement = focusableElements.find(el => el.contains(target));
        const currentIndex = currentElement ? focusableElements.indexOf(currentElement) : -1;

        if (currentIndex === -1) return;

        const nextIndex = currentIndex + 1;

        if (nextIndex < focusableElements.length) {
          const nextElement = focusableElements[nextIndex];
          nextElement.focus();
          // For input/textarea, select all text
          if (
            nextElement instanceof HTMLInputElement ||
            nextElement instanceof HTMLTextAreaElement
          ) {
            nextElement.select();
          }
        } else if (submitOnLast) {
          // On last field, submit the form
          const submitButton = form.querySelector(
            'button[type="submit"]'
          ) as HTMLButtonElement;
          if (submitButton) {
            submitButton.click();
          }
        }
      }, 50);
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [formRef, enabled, excludeSelectors, focusDelayMs, focusFirstOnMount, submitOnLast]);
};
