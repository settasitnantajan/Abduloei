import { formatDistanceToNow as fnsFormatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

export function formatDistanceToNow(date: Date | string | number) {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  return fnsFormatDistanceToNow(dateObj, {
    addSuffix: true,
    locale: th,
  });
}

export function formatDate(date: Date | string | number, format?: string) {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  return dateObj.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
