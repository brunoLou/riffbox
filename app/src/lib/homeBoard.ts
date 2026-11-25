/**
 * The home board: pedals in one ordered list (`home.layout`), each one optionally placed in a
 * compartment the player named (`home.sections`). The order inside a compartment is the order of
 * the list, so older boards (no compartments) keep working as they are.
 */
import type { Slot } from './data';

export interface Section { id: string; name: string; folded?: boolean }
export interface Group { id: string; name: string | null; folded: boolean; slots: Slot[] }

/** Names offered when creating a compartment (the player can type any other). */
export const SECTION_IDEAS = ['Outils', 'Entraînement', 'Organisation', 'Scène', 'Composition', 'Voix'];

/** The compartment a pedal is in ('' : not sorted yet, or its compartment was deleted elsewhere). */
export const groupOf = (s: Slot, sections: Section[]) => (s.sec && sections.some(x => x.id === s.sec) ? s.sec : '');

/** The pedals not sorted yet come first, then each compartment in its order. */
export function groupSlots(slots: Slot[], sections: Section[]): Group[] {
  const groups: Group[] = [{ id: '', name: null, folded: false, slots: [] }, ...sections.map(s => ({ id: s.id, name: s.name, folded: !!s.folded, slots: [] as Slot[] }))];
  const at = new Map(groups.map(g => [g.id, g]));
  for (const s of slots) at.get(groupOf(s, sections))!.slots.push(s);
  return groups;
}

/** Moves a pedal next to another one (before, or after it), into that pedal's compartment. */
export function placeNear(layout: Slot[], id: string, targetId: string, after: boolean, sections: Section[]): Slot[] {
  const it = layout.find(s => s.id === id), target = layout.find(s => s.id === targetId);
  if (!it || !target || id === targetId) return layout;
  const sec = groupOf(target, sections) || undefined;
  const next = layout.filter(s => s.id !== id);
  const i = next.indexOf(target) + (after ? 1 : 0);
  next.splice(i, 0, withSec(it, sec));
  return same(layout, next) ? layout : next;
}

/** Puts a pedal at the end of a compartment ('' : back with the unsorted pedals). */
export function moveToSection(layout: Slot[], id: string, sec: string): Slot[] {
  const it = layout.find(s => s.id === id);
  if (!it) return layout;
  return [...layout.filter(s => s.id !== id), withSec(it, sec || undefined)];
}

/** A deleted compartment gives its pedals back to the unsorted ones (none is lost). */
export function deleteSection(layout: Slot[], sections: Section[], secId: string) {
  return {
    layout: layout.map(s => (s.sec === secId ? withSec(s, undefined) : s)),
    sections: sections.filter(s => s.id !== secId),
  };
}

/** A new compartment; the name is trimmed and kept short. */
export function newSection(name: string): Section {
  return { id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: cleanName(name) };
}
export const cleanName = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, 40);

/** Moves a compartment up (-1) or down (+1). */
export function shiftSection(sections: Section[], id: string, d: number): Section[] {
  const i = sections.findIndex(s => s.id === id), j = i + d;
  if (i < 0 || j < 0 || j >= sections.length) return sections;
  const next = sections.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function withSec(s: Slot, sec: string | undefined): Slot {
  const { sec: _old, ...rest } = s;
  return sec ? { ...rest, sec } : rest;
}
const same = (a: Slot[], b: Slot[]) => JSON.stringify(a) === JSON.stringify(b);
