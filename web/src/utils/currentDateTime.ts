import { DateTime } from 'luxon';

export const currentDateTime = (): string => DateTime.now().toUTC().toISO();
