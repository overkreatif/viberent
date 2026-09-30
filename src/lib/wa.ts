/** Build a WhatsApp deep link with a prefilled message (no API, client-side only). */
export function waLink(phone: string, message: string): string {
  const clean = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}
