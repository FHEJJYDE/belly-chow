/**
 * Check if a vendor is currently open based on their operating hours and is_active flag.
 * Times are in HH:MM:SS or HH:MM format.
 */
export function isVendorOpen(
  openingTime: string | null,
  closingTime: string | null,
  isActive: boolean | null
): boolean {
  if (!isActive) return false;
  if (!openingTime || !closingTime) return !!isActive;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [openH, openM] = openingTime.split(':').map(Number);
  const [closeH, closeM] = closingTime.split(':').map(Number);

  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  // Handle overnight hours (e.g. 22:00 - 02:00)
  if (closeMinutes <= openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  }

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

export function formatTime(time: string | null): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}
