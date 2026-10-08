/* Site-wide facts. Everything here is carried over from the current eliaet.com (October 2026). */

export const ORG = {
  name: 'Ethiopian Leather Industries Association',
  short: 'ELIA',
  amharic: 'የኢትዮጵያ ቆዳ ኢንዱስትሪዎች ማኅበር',
  founded: 1994,
  members: 194,
  tagline: 'Promoting export of leather, shoes and leather goods and garment, protecting the rights of members, and assisting businesses to improve.',
} as const

export const CONTACT = {
  address: {
    lines: ['Lion Building, 6th floor', 'Ras Mekonen St., Meskel Square', 'Kirikos Sub-city, Wereda 19', 'Addis Ababa, Ethiopia'],
    full: 'Kirikos Sub-city; Wereda 19, Meskel Square, Ras Mekonen St., Lion Building 6th floor, Addis Ababa, Ethiopia',
  },
  phones: [
    { label: 'Tel 1', value: '+251-115-156144', href: 'tel:+251115156144' },
    { label: 'Tel 2', value: '+251-115-506043', href: 'tel:+251115506043' },
    { label: 'Mobile', value: '+251 902 224728', href: 'tel:+251902224728' },
  ],
  fax: '+251-11-5508935',
  poBox: '25039',
  emails: [
    { label: 'General', value: 'info@eliaet.com' },
    { label: 'AALF & secretariat', value: 'elia.aalf2@gmail.com' },
  ],
  map: {
    // the pin used by the current site's Google Map
    lat: 9.011928,
    lng: 38.759486,
    embed:
      'https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d691.5889953110379!2d38.759485572320756!3d9.011928027646668!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2set!4v1703089682165!5m2!1sen!2set',
    link: 'https://www.google.com/maps/search/?api=1&query=9.011928,38.759486',
  },
} as const

/* The current site shows Facebook, X, LinkedIn, Instagram and YouTube icons but none of them link anywhere.
   Add the real addresses here and they appear in the footer and menu; empty ones stay hidden. */
export const SOCIAL: { label: string; short: string; href: string }[] = [
  { label: 'Facebook', short: 'Fb', href: '' },
  { label: 'X', short: 'X', href: '' },
  { label: 'LinkedIn', short: 'In', href: '' },
  { label: 'Instagram', short: 'Ig', href: '' },
  { label: 'YouTube', short: 'Yt', href: '' },
]

export type NavItem = { label: string; to: string; amharic?: string; note?: string }

export const NAV: NavItem[] = [
  { label: 'About', to: '/about', amharic: 'ስለ እኛ' },
  { label: 'Services', to: '/services', amharic: 'አገልግሎቶች' },
  { label: 'Members', to: '/members', amharic: 'አባላት', note: '194' },
  { label: 'Programs', to: '/programs', amharic: 'ፕሮግራሞች' },
  { label: 'Highland Leather', to: '/ehl', note: 'EHL' },
  { label: 'Leather Fair', to: '/aalf', note: 'AALF' },
  { label: 'ELDSC', to: '/eldsc' },
  { label: 'News', to: '/news', amharic: 'ዜና' },
  { label: 'Contact', to: '/contact', amharic: 'አድራሻ' },
]

export const PRIMARY_NAV = ['/about', '/members', '/programs', '/news', '/contact']

export const FOOTER_LINKS = {
  'Quick links': [
    { label: 'About us', to: '/about' },
    { label: 'Our services', to: '/services' },
    { label: 'All African Leather Fair', to: '/aalf' },
    { label: 'Apply for membership', to: '/membership' },
    { label: 'Blog & news', to: '/news' },
    { label: 'Contact us', to: '/contact' },
  ],
  Members: [
    { label: 'Ethiopian Leather Development', to: '/eldsc' },
    { label: 'Leather product manufacturers', to: '/members?sector=leather-goods' },
    { label: 'Shoe manufacturers', to: '/members?sector=footwear' },
    { label: 'Tanneries', to: '/members?sector=tannery' },
  ],
} as const

export const EXTERNAL = {
  shop: 'https://leathersofethiopia.com/',
  companyProfiles: 'https://www.leathersofethiopia.com/company-profile.php',
  aalfSite: 'https://allafricanleatherfair.org/',
  aalfRegister: 'https://www.asfw-addis.com',
  aalfLink: 'https://aalflink.com/',
} as const
