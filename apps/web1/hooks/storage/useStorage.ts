import { useState, useEffect, useRef } from "react";

type LocalStorageValue<T> = T | null;

/**
 * A hook for persisting state in localStorage with type safety
 *
 * @example
 * ```tsx
 * // Store and retrieve user preferences
 * const UserSettings = () => {
 *   const [theme, setTheme] = useLocalStorage('theme', 'light');
 *   const [fontSize, setFontSize] = useLocalStorage('fontSize', 16);
 *
 *   return (
 *     <div>
 *       <div>
 *         <label>Theme: </label>
 *         <select
 *           value={theme}
 *           onChange={(e) => setTheme(e.target.value)}
 *         >
 *           <option value="light">Light</option>
 *           <option value="dark">Dark</option>
 *         </select>
 *       </div>
 *
 *       <div>
 *         <label>Font Size: </label>
 *         <input
 *           type="number"
 *           value={fontSize}
 *           onChange={(e) => setFontSize(Number(e.target.value))}
 *         />
 *       </div>
 *     </div>
 *   );
 * };
 * ```
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((val: T) => T)) => void] {
  // Create a ref for the initial mount
  const initialMount = useRef(true);

  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      // Parse stored json or if none return initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // If error also return initialValue
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = (value: T | ((val: T) => T)): void => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;

      // Save state
      setStoredValue(valueToStore);

      // Save to local storage
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  // Listen for changes to this localStorage key in other tabs/windows
  useEffect(() => {
    // Skip this on the initial mount, since we already get the value in the useState initializer
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }

    const handleStorageChange = (e: StorageEvent): void => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
          console.error(`Error parsing localStorage value:`, error);
        }
      }
    };

    // Add event listener for 'storage' event
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [key]);

  return [storedValue, setValue];
}

/**
 * A hook for persisting state in sessionStorage with type safety
 */
export function useSessionStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((val: T) => T)) => void] {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      // Get from session storage by key
      const item = window.sessionStorage.getItem(key);
      // Parse stored json or if none return initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // If error also return initialValue
      console.error(`Error reading sessionStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that persists the new value to sessionStorage
  const setValue = (value: T | ((val: T) => T)): void => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;

      // Save state
      setStoredValue(valueToStore);

      // Save to session storage
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting sessionStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}
