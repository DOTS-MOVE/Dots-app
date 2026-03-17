import { afterEach, vi } from 'vitest';

// Keep global mocks isolated between tests.
afterEach(() => {
  vi.clearAllMocks();
});
