import { describe, it, expect } from 'vitest';
import { barStyle } from '../src/ui/debug-panel.js';

describe('barStyle', () => {
  it('scores fill from the left, clamped to 0..100%', () => {
    expect(barStyle(0.81, 'score')).toEqual({ left: 0, width: 81 });
    expect(barStyle(1.5, 'score')).toEqual({ left: 0, width: 100 });
    expect(barStyle(-0.2, 'score')).toEqual({ left: 0, width: 0 });
  });

  it('angles grow from the centre', () => {
    expect(barStyle(0, 'angle')).toEqual({ left: 50, width: 0 });
    expect(barStyle(45, 'angle')).toEqual({ left: 50, width: 50 });
    expect(barStyle(-22.5, 'angle')).toEqual({ left: 25, width: 25 });
    expect(barStyle(90, 'angle')).toEqual({ left: 50, width: 50 }); // clamped
  });
});
