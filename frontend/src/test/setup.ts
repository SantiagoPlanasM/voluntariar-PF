import '@testing-library/jest-dom/vitest';

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value.toString(); },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k in store) delete store[k]; },
  key: (index: number) => Object.keys(store)[index] || null,
  get length() { return Object.keys(store).length; },
};

Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
}
