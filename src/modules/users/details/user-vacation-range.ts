import { VacationSettings } from "../types";

/**
 * WebAdmin stores an enabled vacation whose end is not after its start, although such a vacation can never be active.
 * Only enabled vacations with both bounds set are checked, so that an inconsistent vacation can still be disabled.
 */
export const isVacationRangeInvalid = (vacation: VacationSettings): boolean =>
  vacation.enabled &&
  !!vacation.fromDate &&
  !!vacation.toDate &&
  new Date(vacation.toDate).getTime() <= new Date(vacation.fromDate).getTime();
