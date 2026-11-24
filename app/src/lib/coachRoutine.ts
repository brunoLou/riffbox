/** Using the coach's routine: kept fresh every day, and a way back to the player's own routine. */
import { OWN_ROUTINE_KEY, PROFILE_KEY, coachRoutine, dayNumber, type Profile } from './coach';
import { routine, routineSteps, type RoutineStep } from './routine';
import { PROGRESS_KEY, type Progress } from './coachProgress';
import { readStored, writeStored } from './store';

const ACTIVE_KEY = 'coach.active';
const DAY_KEY = 'coach.day';

export const coachActive = () => readStored<boolean>(ACTIVE_KEY, false) && !!readStored<Profile | null>(PROFILE_KEY, null);
export const ownRoutine = () => readStored<RoutineStep[] | null>(OWN_ROUTINE_KEY, null);

/** Today's coach routine becomes the routine (the player's own one is kept aside the first time). */
export function applyCoachRoutine(p: Profile) {
  if (!coachActive() && !routineSteps().every(s => s.id.startsWith('coach-'))) writeStored(OWN_ROUTINE_KEY, routineSteps());
  writeStored(ACTIVE_KEY, true);
  writeStored(DAY_KEY, dayNumber());
  routine.setSteps(coachRoutine(p, dayNumber(), readStored<Progress>(PROGRESS_KEY, {})));
}

/** A new day: a new coach routine (only when the coach is in use and today's is not set yet). */
export function refreshCoachRoutine() {
  const p = readStored<Profile | null>(PROFILE_KEY, null);
  if (!p || !coachActive() || readStored<number>(DAY_KEY, 0) === dayNumber()) return;
  writeStored(DAY_KEY, dayNumber());
  routine.setSteps(coachRoutine(p, dayNumber(), readStored<Progress>(PROGRESS_KEY, {})));
}

/** Back to the player's own routine. */
export function leaveCoach() {
  writeStored(ACTIVE_KEY, false);
  const own = ownRoutine();
  if (own?.length) routine.setSteps(own);
}
