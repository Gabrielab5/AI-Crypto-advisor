import '@testing-library/jest-dom';

// localStorage mock
const store: Record<string, string> = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem:    (k: string) => store[k] ?? null,
    setItem:    (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear:      () => { Object.keys(store).forEach(k => delete store[k]); },
  },
  writable: true,
});
