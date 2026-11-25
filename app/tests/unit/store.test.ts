import { describe, expect, it } from 'vitest';
import { readStored, sameShape, writeStored } from '../../src/lib/store';

describe('damaged values', () => {
  it('a value of the wrong shape is ignored: the default comes instead', () => {
    writeStored('zz.list', { pas: 'une liste' });
    writeStored('zz.num', '92');
    expect(readStored('zz.list', [1, 2])).toEqual([1, 2]);
    expect(readStored('zz.num', 80)).toBe(80);
    writeStored('zz.ok', [3]);
    expect(readStored('zz.ok', [1, 2])).toEqual([3]);
  });
  it('shapes', () => {
    expect(sameShape([], [])).toBe(true);
    expect(sameShape({}, [])).toBe(false);
    expect(sameShape([], {})).toBe(false);
    expect(sameShape(null, {})).toBe(false);
    expect(sameShape('x', null)).toBe(true);
    expect(sameShape(3, 4)).toBe(true);
    expect(sameShape('3', 4)).toBe(false);
  });
});
