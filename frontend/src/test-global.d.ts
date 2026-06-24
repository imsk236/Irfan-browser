// In Vitest's Node/jsdom environment, `global` is the global object.
// This declaration makes TypeScript aware of it in test files.
declare const global: typeof globalThis;
