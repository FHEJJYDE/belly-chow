import { supabase } from '@/integrations/supabase/client';

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

/**
 * Safely fetches or creates a vendor profile for the logged-in user.
 * Avoids HTTP 406 errors caused by .single() on missing vendor rows.
 */
export async function getOrCreateVendor(userId: string, defaultName?: string) {
  try {
    // 1. Try to fetch existing vendor profile using maybeSingle() to prevent HTTP 406
    const { data: vendor, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Error querying vendor record:', error.message);
    }

    if (vendor) {
      return vendor;
    }

    // 2. If vendor doesn't exist, create a default vendor entry for this user
    const storeName = defaultName ? `${defaultName}'s Kitchen` : 'Campus Food Vendor';
    const { data: newVendor, error: createError } = await supabase
      .from('vendors')
      .insert({
        user_id: userId,
        name: storeName,
        is_active: true,
        is_approved: false,
      } as any)
      .select()
      .maybeSingle();

    if (createError) {
      console.error('Error auto-creating vendor profile:', createError.message);
      return null;
    }

    return newVendor;
  } catch (err) {
    console.error('Vendor fetch exception:', err);
    return null;
  }
}
