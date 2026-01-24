/**
 * Utilities for inspecting the React Fiber tree from DOM elements.
 * Useful for DevTools to identify which Component created a DOM node.
 */

export interface ComponentDebugInfo {
  name: string;
  filePath?: string;
  lineNumber?: number;
  props?: any;
}

export function getFiberFromElement(domElement: HTMLElement): any {
  const key = Object.keys(domElement).find((key) =>
    key.startsWith("__reactFiber$") ||
    key.startsWith("__reactInternalInstance$")
  );
  // @ts-ignore
  return key ? domElement[key] : null;
}

export function getComponentInfo(
  element: HTMLElement,
): ComponentDebugInfo | null {
  let fiber = getFiberFromElement(element);
  if (!fiber) return null;

  // Traverse up to find the nearest component with a source or name
  // We want to skip generic "host" components like <div> unless that's all there is
  // But usually we want the React Component (Function/Class)

  let current = fiber;
  while (current) {
    // Check for debug source (development mode)
    const source = current._debugSource;
    const type = current.type;

    // We look for a user-defined component (function or class), not just a string tag like 'div'
    if (
      typeof type === "function" || (typeof type === "object" && type !== null)
    ) {
      const name = type.displayName || type.name || "Anonymous";

      // If we found a source, this is likely the component code we want
      if (source) {
        return {
          name,
          filePath: source.fileName,
          lineNumber: source.lineNumber,
          props: current.memoizedProps,
        };
      }
    }

    current = current.return;
  }

  return {
    name: "Unknown",
    props: fiber.memoizedProps,
  };
}
