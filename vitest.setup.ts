import '@testing-library/jest-dom'

// Polyfill IntersectionObserver for framer-motion whileInView in tests
if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver
}
