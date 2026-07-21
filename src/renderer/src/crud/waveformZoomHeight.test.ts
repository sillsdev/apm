import { waveformHeightForZoom } from './waveformZoomHeight';

describe('waveformHeightForZoom', () => {
  it('keeps base height at fit-to-width', () => {
    expect(waveformHeightForZoom(40, 100, 100)).toBe(40);
    expect(waveformHeightForZoom(80, 50, 100)).toBe(80);
  });

  it('shrinks for scrollbar only when zoomed in and tall enough', () => {
    expect(waveformHeightForZoom(80, 200, 100)).toBe(40);
    expect(waveformHeightForZoom(40, 200, 100)).toBe(40);
  });

  it('restores base height when zoom returns to fill', () => {
    expect(waveformHeightForZoom(80, 100, 100)).toBe(80);
  });
});
