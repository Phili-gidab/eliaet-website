/* Site-wide facts: from ELIA's website content document (October 2026); what it leaves open (the street address)
   is carried over from the current eliaet.com. */

export const ORG = {
  name: 'Ethiopian Leather Industries Association',
  short: 'ELIA',
  amharic: 'የኢትዮጵያ ቆዳ ኢንዱስትሪዎች ማህበር', // as spelled in the brand guide's lockup
  founded: 1994,
  members: 194,
  tagline: 'Promoting export of leather, shoes and leather goods and garment, protecting the rights of members, and assisting businesses to improve.',
} as const

export const CONTACT = {
  address: {
    // the content document leaves the street address to be filled in; this is the current site's
    lines: ['Lion Building, 6th floor', 'Ras Mekonen St., Meskel Square', 'Kirikos Sub-city, Wereda 19', 'Addis Ababa, Ethiopia'],
    full: 'Kirikos Sub-city; Wereda 19, Meskel Square, Ras Mekonen St., Lion Building 6th floor, Addis Ababa, Ethiopia',
  },
  phones: [
    { label: 'Phone', value: '+251 911 635 644', href: 'tel:+251911635644' },
    { label: 'Phone', value: '+251 902 224 728', href: 'tel:+251902224728' },
  ],
  poBox: '12898',
  emails: [
    { label: 'General inquiries', value: 'info@eliaet.com' },
    { label: 'AALF inquiries', value: 'elia.aalf2@gmail.com' },
  ],
  website: 'www.eliaet.com',
  hours: 'Monday to Friday, 8:30 AM to 5:30 PM',
  map: {
    // the pin used by the current site's Google Map
    lat: 9.011928,
    lng: 38.759486,
    embed:
      'https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d691.5889953110379!2d38.759485572320756!3d9.011928027646668!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2set!4v1703089682165!5m2!1sen!2set',
    link: 'https://www.google.com/maps/search/?api=1&query=9.011928,38.759486',
  },
} as const

/* "Follow ELIA" (the content document): add each address here and it appears in the footer, the menu and on the
   Contact page; empty ones stay hidden. */
export const SOCIAL: { label: string; short: string; href: string }[] = [
  { label: 'Facebook', short: 'Fb', href: '' },
  { label: 'LinkedIn', short: 'In', href: '' },
  { label: 'Telegram', short: 'Tg', href: '' },
  { label: 'YouTube', short: 'Yt', href: '' },
]

export type NavItem = { label: string; to: string; amharic?: string; note?: string }

export const NAV: NavItem[] = [
  { label: 'About', to: '/about', amharic: 'ስለ እኛ' },
  { label: 'Members', to: '/members', amharic: 'አባላት', note: '194' },
  { label: 'The Industry', to: '/industry', amharic: 'ኢንዱስትሪው' },
  { label: 'Programs', to: '/programs', amharic: 'ፕሮግራሞች' },
  { label: 'Invest & Source', to: '/invest', amharic: 'ኢንቨስትመንት' },
  { label: 'Leather Fair', to: '/aalf', note: 'AALF' },
  { label: 'Highland Leather', to: '/ehl', note: 'EHL' },
  { label: 'ELDSC', to: '/eldsc' },
  { label: 'News & Events', to: '/news', amharic: 'ዜና' },
  { label: 'Contact', to: '/contact', amharic: 'አድራሻ' },
]

/** the header's own links (the rest are in the menu) */
export const PRIMARY_NAV = ['/about', '/members', '/industry', '/programs', '/invest', '/news', '/contact']
/** ELIA's own initiatives, set beside its mark in the header (the old site had them in its bar too) */
export const FAMILY = [
  { short: 'EHL', to: '/ehl', name: 'Ethiopian Highland Leather' },
  { short: 'AALF', to: '/aalf', name: 'All Africa Leather & Textile Fair' },
  { short: 'ELDSC', to: '/eldsc', name: 'Ethiopian Leather Development S.C.' },
]
/** shorter names for the header */
export const SHORT_LABEL: Record<string, string> = { '/industry': 'Industry', '/invest': 'Invest', '/news': 'News' }

export const FOOTER_LINKS = {
  'Quick links': [
    { label: 'About ELIA', to: '/about' },
    { label: 'Ethiopia’s leather industry', to: '/industry' },
    { label: 'Invest and source', to: '/invest' },
    { label: 'Projects and programs', to: '/programs' },
    { label: 'News, events and publications', to: '/news' },
    { label: 'Contact us', to: '/contact' },
  ],
  Members: [
    { label: 'Members directory', to: '/members' },
    { label: 'Member login', to: '/members/login' },
    { label: 'Become a member', to: '/members#apply' },
    { label: 'All Africa Leather Fair', to: '/aalf' },
    { label: 'Ethiopian Highland Leather', to: '/ehl' },
  ],
} as const

export const EXTERNAL = {
  shop: 'https://leathersofethiopia.com/',
  companyProfiles: 'https://www.leathersofethiopia.com/company-profile.php',
  aalfSite: 'https://allafricanleatherfair.org/',
  aalfRegister: 'https://www.asfw-addis.com',
  aalfLink: 'https://aalflink.com/',
} as const
