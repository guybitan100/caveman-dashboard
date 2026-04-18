import { describe, it, expect } from 'vitest';
import { shimmer, pulse, subtlePulse, spin } from '../../theme/animations';

describe('theme animations', () => {
  it('shimmer is defined', () => {
    expect(shimmer).toBeDefined();
  });

  it('pulse is defined', () => {
    expect(pulse).toBeDefined();
  });

  it('subtlePulse is defined', () => {
    expect(subtlePulse).toBeDefined();
  });

  it('spin is defined', () => {
    expect(spin).toBeDefined();
  });
});
