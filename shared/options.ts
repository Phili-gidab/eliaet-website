/* The fixed lists the pages and the server share: member categories, sizes, regions, filters, the kinds of form,
   post and document. Keys are what the database keeps; values are what people read. */

export const CATEGORIES = {
  tannery: 'Tannery',
  footwear: 'Footwear',
  leather_goods: 'Leather goods and garments',
  associate: 'Associate member',
} as const
export type Category = keyof typeof CATEGORIES
/** what each category covers (the content document's "Membership categories") */
export const CATEGORY_NOTES: Record<Category, string> = {
  tannery: 'Producers of wet-blue, crust and finished leather.',
  footwear: 'Manufacturers of casual, formal, safety and sports footwear.',
  leather_goods: 'Producers of garments, bags, belts, wallets, gloves, upholstery and artisanal products.',
  associate: 'Suppliers of chemicals, machinery, technical services and logistics to the industry.',
}
/** the public members' listing on the members page: each category's heading, and its address on the page (the old
    site's: members.html#tannery, #shoe-manufacturer, #leather-product) */
export const LISTING: Record<Category, { title: string; anchor: string }> = {
  tannery: { title: 'Tanneries', anchor: 'tannery' },
  footwear: { title: 'Shoe manufacturers', anchor: 'shoe-manufacturer' },
  leather_goods: { title: 'Leather product manufacturers', anchor: 'leather-product' },
  associate: { title: 'Associate members', anchor: 'associate' },
}

export const SIZES ={ large: 'Large', medium: 'Medium', small: 'Small' } as const
export type Size = keyof typeof SIZES

/** Ethiopia's regions and chartered cities */
export const REGIONS = {
  addis_ababa: 'Addis Ababa',
  oromia: 'Oromia',
  amhara: 'Amhara',
  tigray: 'Tigray',
  afar: 'Afar',
  somali: 'Somali',
  sidama: 'Sidama',
  central_ethiopia: 'Central Ethiopia',
  south_ethiopia: 'South Ethiopia',
  south_west: 'South West Ethiopia Peoples',
  benishangul_gumuz: 'Benishangul-Gumuz',
  gambela: 'Gambela',
  harari: 'Harari',
  dire_dawa: 'Dire Dawa',
} as const
export type Region = keyof typeof REGIONS
/** the directory's region filter (as in the content document) */
export const REGION_FILTERS = {
  addis_ababa: 'Addis Ababa',
  oromia: 'Oromia (Modjo and others)',
  amhara: 'Amhara (Bahir Dar and others)',
  other: 'Other regions',
} as const

export const EXPORT_STATUS = {
  exporting: 'Currently exporting',
  ready: 'Export ready',
  domestic: 'Domestic market only',
} as const
export type ExportStatus = keyof typeof EXPORT_STATUS

export const CERTIFICATIONS = { EHL: 'EHL certified', LWG: 'LWG certified', ISO: 'ISO certified' } as const
export type Certification = keyof typeof CERTIFICATIONS

/** the inquiry forms, and the Secretariat team each goes to */
export const INQUIRIES = {
  general: { label: 'General inquiry', team: 'secretariat' },
  buyer: { label: 'Buyer inquiry', team: 'programs' },
  investor: { label: 'Investor inquiry', team: 'secretariat' },
  aalf: { label: 'AALF exhibitor and sponsor inquiry', team: 'aalf' },
  media: { label: 'Media inquiry', team: 'comms' },
  appointment: { label: 'Appointment request', team: 'secretariat' },
} as const
export type InquiryKind = keyof typeof INQUIRIES
export const TEAMS = {
  secretariat: 'Secretariat',
  members: 'Member Services',
  programs: 'Programs and Projects',
  aalf: 'AALF Organizing Team',
  comms: 'Communications',
} as const

export const POST_CATEGORIES = {
  'industry-news': 'Industry News',
  announcements: 'Association Announcements',
  advocacy: 'Advocacy and Policy',
  'member-spotlights': 'Member Spotlights',
  insights: 'Insights and Analysis',
  sustainability: 'Sustainability',
} as const
export type PostCategory = keyof typeof POST_CATEGORIES

export const PUBLICATION_TYPES = ['Profile', 'Report', 'Brochure', 'Journal', 'Guide', 'Presentation'] as const

export const NOTICE_KINDS = { circular: 'Circular', policy: 'Policy update', meeting: 'Meeting invitation', general: 'Notice' } as const
export const OPPORTUNITY_KINDS = { buyer: 'Buyer inquiry', fair: 'Trade fair call', training: 'Training', tender: 'Tender', other: 'Opportunity' } as const

/** what a newsletter subscriber is interested in */
export const INTERESTS = ['Member', 'Buyer', 'Investor', 'Partner', 'Media'] as const

/** the company sizes, as the membership form offers them */
export const SIZE_NOTES: Record<Size, string> = { large: 'Large', medium: 'Medium', small: 'Small' }
