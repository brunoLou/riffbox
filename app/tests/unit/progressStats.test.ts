import { describe, expect, it } from 'vitest';
import { dateOfDay, tempoSeries, weeklyMinutes } from '../../src/lib/progressStats';
import { dayNumber } from '../../src/lib/coach';

describe('progress over time', () => {
  it('minutes per week, Monday to Sunday, today from the routine', () => {
    const today = new Date(2026, 10, 25); // Wednesday 25 Nov
    const log = { '2026-11-23': 20, '2026-11-24': 30, '2026-11-25': 999, '2026-11-22': 15, '2026-11-16': 40, '2026-9-1': 60 };
    const w = weeklyMinutes(log, today, 12, 3);
    expect(w.map(x => [x.start.getDate(), x.min, x.current])).toEqual([[9, 0, false], [16, 55, false], [23, 62, true]]);
  });

  it('tempos session after session, ending with the next one planned', () => {
    const s = tempoSeries({ rhythm: { bpm: 98, history: [{ day: 10, bpm: 90, feel: 'easy' }, { day: 12, bpm: 94, feel: 'easy' }] }, warm: { bpm: 60, history: [] } });
    expect(s).toHaveLength(1);
    expect(s[0].points.map(p => p.bpm)).toEqual([90, 94, 98]);
    expect(s[0].points[2].next).toBe(true);
  });

  it('day numbers back to dates', () => {
    const d = new Date(2026, 10, 25);
    expect(dateOfDay(dayNumber(d)).getDate()).toBe(25);
  });
});
