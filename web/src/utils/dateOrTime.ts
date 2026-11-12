import { DateTime } from 'luxon';

// Returns localized time (if today) otherwise localized date, replacing prior Moment.js logic.
export const dateOrTime = (val: string | Date, locale: string): string => {
  let dt: DateTime;
  if (typeof val === 'string') {
    const iso = val.endsWith('Z') ? val : val + 'Z';
    dt = DateTime.fromISO(iso, { setZone: true }).toLocal();
  } else {
    dt = DateTime.fromJSDate(val).toLocal();
  }

  if (!dt.isValid) return '';

  const today = DateTime.now().toFormat('yyyy-LL-dd');
  const date = dt.toFormat('yyyy-LL-dd');

  const localized = dt.setLocale(locale);
  const displayDate = localized.toLocaleString(DateTime.DATE_SHORT);
  const displayTime = localized.toLocaleString(DateTime.TIME_SIMPLE);

  return date === today ? displayTime : displayDate;
};

export default dateOrTime;
