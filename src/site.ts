// One place for links and copy that repeat across pages.
const BOOKING = 'https://savvycal.com/joetaylorjr/jt-hoagiestack-discovery-call';

/** Booking link tagged with where on the site it was clicked, so bookings can be traced back. */
export const bookingUrl = (placement: string) =>
  `${BOOKING}?utm_source=hoagiestack.com&utm_medium=website&utm_content=${encodeURIComponent(placement)}`;

export const CTA_LABEL = 'Book a no-pitch call';
/** Shorter label for the header button, where space is tight on phones. */
export const CTA_SHORT = 'Book a call';
export const EMAIL = 'inquiries@johnsandtaylor.com';

export const NAV = [
  { href: '/about', label: 'Why Hoagiestack?' },
  { href: '/alternatives', label: 'Compare' },
  { href: '/blog', label: 'Blog' },
];
