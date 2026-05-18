import { useEffect } from "react";

const FOCUSABLE_SELECTOR = [
  'input:not([type="hidden"]):not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  '[role="combobox"]:not([disabled]):not([tabindex="-1"])',
  'button[type="submit"]:not([disabled]):not([tabindex="-1"])',
  '[data-enter-nav="include"]:not([disabled]):not([tabindex="-1"])',
].join(", ");

const IGNORE_SELECTOR = [
  '[data-enter-nav="ignore"]',
  '[cmdk-root]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="listbox"]',
  '[role="option"]',
].join(", ");

const isFocusableAndVisible = (element: HTMLElement): boolean => {
  if (element.tabIndex === -1) return false;

  if (element instanceof HTMLInputElement && element.type === "hidden") {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }

  return true;
};

export const useGlobalEnterNavigation = (enabled: boolean = true) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key !== "Enter") return;
      if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (target.closest(IGNORE_SELECTOR)) return;
      if (target instanceof HTMLTextAreaElement || target.isContentEditable) return;

      if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return;

      const scope =
        target.closest("form") ||
        target.closest('[role="dialog"]') ||
        document.body;

      const focusableElements = Array.from(
        scope.querySelectorAll(FOCUSABLE_SELECTOR)
      ).filter((element): element is HTMLElement => element instanceof HTMLElement && isFocusableAndVisible(element));

      const currentIndex = focusableElements.indexOf(target);
      if (currentIndex === -1) return;

      event.preventDefault();

      const nextElement = focusableElements[currentIndex + 1];
      if (nextElement) {
        nextElement.focus();

        if (nextElement instanceof HTMLInputElement || nextElement instanceof HTMLTextAreaElement) {
          nextElement.select();
        }
        return;
      }

      const scopeForm = target.closest("form");
      const submitButton = scopeForm?.querySelector('button[type="submit"]') as HTMLButtonElement | null;
      if (submitButton && !submitButton.disabled) {
        submitButton.click();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled]);
};
