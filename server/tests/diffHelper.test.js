const { computeLineDiff } = require('../src/utils/diffUtils');

describe('Visual Diff Helper & Exponential Backoff Algorithms', () => {
  it('should identify added and removed lines between two versions', () => {
    const textA = 'Line 1: Common\nLine 2: Local addition\nLine 3: Shared footer';
    const textB = 'Line 1: Common\nLine 2: Server revision\nLine 3: Shared footer';

    const { diffA, diffB } = computeLineDiff(textA, textB);

    expect(diffA.length).toBe(3);
    expect(diffB.length).toBe(3);

    // Line 1 is unchanged on both sides
    expect(diffA[0].type).toBe('unchanged');
    expect(diffB[0].type).toBe('unchanged');

    // Line 2 was different on both sides
    expect(diffA[1].type).toBe('removed');
    expect(diffA[1].text).toBe('Line 2: Local addition');

    expect(diffB[1].type).toBe('added');
    expect(diffB[1].text).toBe('Line 2: Server revision');

    // Line 3 is unchanged
    expect(diffA[2].type).toBe('unchanged');
    expect(diffB[2].type).toBe('unchanged');
  });

  it('should handle empty or whitespace content gracefully', () => {
    const { diffA, diffB } = computeLineDiff('', 'New server line');
    expect(diffA.length).toBe(1);
    expect(diffB.length).toBe(1);
    expect(diffB[0].type).toBe('added');
  });

  it('should calculate exponential backoff capped at 30 seconds', () => {
    function computeBackoff(attempt) {
      return Math.min(30000, 1000 * Math.pow(2, attempt));
    }

    expect(computeBackoff(1)).toBe(2000);  // 2s
    expect(computeBackoff(2)).toBe(4000);  // 4s
    expect(computeBackoff(3)).toBe(8000);  // 8s
    expect(computeBackoff(4)).toBe(16000); // 16s
    expect(computeBackoff(5)).toBe(30000); // capped at 30s
    expect(computeBackoff(10)).toBe(30000); // capped at 30s
  });
});
