import { useEffect } from "react";

const REQUIRED_LABEL_CLASS = "required-asterisk-label";

const hasManualRequiredMarker = (label: HTMLLabelElement): boolean => {
  const text = (label.textContent || "").trim();
  if (text.endsWith("*")) return true;
  return Boolean(label.querySelector(".text-destructive, [data-required-marker='true']"));
};

const getLinkedLabel = (control: Element): HTMLLabelElement | null => {
  const asElement = control as HTMLElement;
  const id = asElement.id;

  if (id && typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    const byFor = document.querySelector(`label[for='${CSS.escape(id)}']`);
    if (byFor instanceof HTMLLabelElement) return byFor;
  }

  const wrapped = asElement.closest("label");
  if (wrapped instanceof HTMLLabelElement) return wrapped;

  return null;
};

const syncRequiredMarkers = () => {
  document.querySelectorAll(`label.${REQUIRED_LABEL_CLASS}`).forEach((node) => {
    node.classList.remove(REQUIRED_LABEL_CLASS);
  });

  const requiredControls = document.querySelectorAll(
    "input[required], select[required], textarea[required], input[aria-required='true'], select[aria-required='true'], textarea[aria-required='true']"
  );

  requiredControls.forEach((control) => {
    const label = getLinkedLabel(control);
    if (!label) return;
    if (hasManualRequiredMarker(label)) return;

    label.classList.add(REQUIRED_LABEL_CLASS);
  });
};

export default function RequiredFieldAsteriskProvider() {
  useEffect(() => {
    syncRequiredMarkers();

    const observer = new MutationObserver(() => {
      syncRequiredMarkers();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["required", "aria-required", "id", "for"],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
