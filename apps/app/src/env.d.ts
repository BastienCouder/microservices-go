interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_WEB_AUTH_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.svg" {
  const src: string;
  export default src;
}

declare module "bun:test" {
  export function afterEach(callback: () => void | Promise<void>): void;
  export function describe(name: string, callback: () => void): void;
  export function test(name: string, callback: () => void | Promise<void>): void;
  export function expect<T = unknown>(value: T): {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toHaveLength(expected: number): void;
    rejects: {
      toThrow(expected?: unknown): Promise<void>;
    };
  };
}
