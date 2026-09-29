const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

environment.IS_REACT_ACT_ENVIRONMENT = true;

if (!window.matchMedia) {
  window.matchMedia = (media): MediaQueryList => ({
    matches: false,
    media,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false
  });
}

if (!globalThis.ResizeObserver) {
  class NoopResizeObserver implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = NoopResizeObserver;
}
