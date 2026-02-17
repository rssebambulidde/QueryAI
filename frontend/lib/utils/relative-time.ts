/**
 * Format a Date as a relative time string.
 * Returns "Just now", "2m ago", "1 hour ago", "Yesterday at 3:14 PM", etc.
 */
export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();

  if (diff < 0) return 'Just now';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes === 1) return '1m ago';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;

  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (days === 1) return `Yesterday at ${time}`;
  if (days < 7) {
    const dayName = date.toLocaleDateString([], { weekday: 'long' });
    return `${dayName} at ${time}`;
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` at ${time}`;
}
