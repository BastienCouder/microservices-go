export function useShallow<T, U>(selector: (state: T) => U): (state: T) => U {
  return selector;
}
