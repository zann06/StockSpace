import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/dom'

// The dashboard mounts the 3D scene and several charts; on slow machines the
// first data render can take longer than the 1s default of findBy*/waitFor.
configure({ asyncUtilTimeout: 5_000 })

// jsdom lacks matchMedia (used by usePrefersReducedMotion)
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// jsdom lacks ResizeObserver (used by recharts ResponsiveContainer)
class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub
}
