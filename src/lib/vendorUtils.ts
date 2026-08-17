/**
 * Check if a vendor is currently open based on their operating hours and is_active flag.
 * Times are in HH:MM:SS or HH:MM format.
 */
export function isVendorOpen(
  openingTime: string | null,
  closingTime: string | null,
  isActive: boolean | null
): boolean {
  return !!isActive;
}

export function formatTime(time: string | null): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}
