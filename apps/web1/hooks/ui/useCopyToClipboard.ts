import { useCallback, useRef, useState } from "react";

type CopyStatus = "idle" | "copied" | "error";

interface UseCopyToClipboardReturn {
  value: string;
  status: CopyStatus;
  copy: (text: string) => Promise<boolean>;
  reset: () => void;
}

/**
 * A hook for copying text to the clipboard with status feedback
 *
 * @example
 * ```tsx
 * // Copy button with feedback
 * const CopyButton = ({ textToCopy }) => {
 *   const { copy, status } = useCopyToClipboard();
 *
 *   return (
 *     <button
 *       onClick={() => copy(textToCopy)}
 *       className={status === 'copied' ? 'bg-green-500' : 'bg-blue-500'}
 *     >
 *       {status === 'idle' && 'Copy'}
 *       {status === 'copied' && 'Copied!'}
 *       {status === 'error' && 'Failed to copy'}
 *     </button>
 *   );
 * };
 * ```
 */
export function useCopyToClipboard(timeout = 2000): UseCopyToClipboardReturn {
  const [value, setValue] = useState<string>("");
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timeoutRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setValue("");

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          setValue(text);
          setStatus("copied");

          // Reset status after timeout
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }

          timeoutRef.current = window.setTimeout(() => {
            setStatus("idle");
            timeoutRef.current = null;
          }, timeout);

          return true;
        } else {
          // Fallback for browsers without clipboard API
          const textArea = document.createElement("textarea");
          textArea.value = text;
          textArea.style.position = "fixed";
          textArea.style.left = "-999999px";
          textArea.style.top = "-999999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();

          const success = document.execCommand("copy");
          document.body.removeChild(textArea);

          if (success) {
            setValue(text);
            setStatus("copied");

            // Reset status after timeout
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = window.setTimeout(() => {
              setStatus("idle");
              timeoutRef.current = null;
            }, timeout);

            return true;
          } else {
            setStatus("error");
            return false;
          }
        }
      } catch (err) {
        console.error("Failed to copy: ", err);
        setStatus("error");
        return false;
      }
    },
    [timeout],
  );

  return { value, status, copy, reset };
}
