/* Projects and Programs. From ELIA's website content document (October 2026). */

export const PROGRAMS_HEAD = {
  title: 'Projects and Programs',
  subtitle: 'ELIA’s initiatives to grow markets, build capability and add value to Ethiopian leather.',
}

/** the page's own menu */
export const PROGRAM_MENU = [
  { id: 'aalf', label: 'All Africa Leather Fair', short: 'AALF' },
  { id: 'ehl', label: 'Ethiopian Highland Leather', short: 'EHL' },
  { id: 'eldsc', label: 'ELDSC', short: 'ELDSC' },
  { id: 'market-development', label: 'Market Development', short: 'Markets' },
  { id: 'capacity-building', label: 'Capacity Building', short: 'Skills' },
  { id: 'sustainability', label: 'Sustainability', short: 'Green' },
]

export const AALF_PROGRAM = {
  title: 'Africa’s Leather Trade Show, Organized by ELIA Since 2008',
  text: 'The All Africa Leather Fair brings together tanners, footwear and leather goods manufacturers, buyers, investors, designers, machinery and chemical suppliers, training institutions and government representatives from Africa and beyond. ELIA owns the AALF brand, which is registered in Ethiopia, and organizes the fair through a Central Organizing Committee.',
  glance: [
    { k: 'Dates', v: '12 to 15 November 2026' },
    { k: 'Venue', v: 'Addis International Convention Center, Addis Ababa' },
    { k: 'Organizer', v: 'Ethiopian Leather Industries Association (ELIA)' },
    { k: 'Partner', v: 'Messe Frankfurt, held alongside Africa Sourcing and Fashion Week (ASFW Addis 2026)' },
    { k: 'Closing Event', v: 'ELIA Award and Gala Night, 15 November 2026, Sheraton Addis' },
  ],
  includes: [
    { title: 'Exhibition', text: 'Leather, finished products, inputs, chemicals and machinery.' },
    { title: 'B2B Meetings', text: 'Structured matchmaking between producers, buyers and suppliers.' },
    { title: 'Leather Fashion Zone and Fashion Show', text: 'Designers present their latest collections.' },
    { title: 'Innovation Zone', text: 'Selected innovators show new products and solutions.' },
    { title: 'Panel Discussions', text: 'Experts and policymakers address the sector’s key issues.' },
    { title: 'African Leather Journal', text: 'A publication on current research in the leather sector.' },
  ],
  recent: 'AALF 2025 was held at Millennium Hall from 23 to 25 May 2025, with more than 70 exhibitors and participants supported by ALLPI from nine African countries.',
}

export const EHL_PROGRAM = {
  title: 'A National Brand of Premium Sheepskin',
  text: [
    'Ethiopian Highland Leather is the national brand of Ethiopian sheep leather, produced from sheep raised in the Ethiopian highlands. Developed in 2015 with support from the Ethiopia Industrial Promotion Project, the brand is owned and managed by ELIA and is registered in Ethiopia, the United States, Japan, the European Union and the United Kingdom.',
    'Research by the national leather institute confirms that Ethiopian highland sheepskin is light, thin and soft, yet strong and durable. EHL leather is inspected by an internationally accredited national laboratory.',
  ],
  producers: ['Davimpex Bahir Dar Tannery', 'Ethio-Leather Industry PLC (ELICO)', 'New Wing Shoe Manufacturer', 'Pitards Ethiopia Tannery'],
  why: [
    { title: 'By-Product', text: 'A 100% by-product of the Ethiopian food culture.' },
    { title: 'Environment', text: 'Produced with extra care for the environment.' },
    { title: 'Jobs', text: 'Employment for many women and young people.' },
    { title: 'Fair Value', text: 'A premium price that helps reduce inequality in international trade.' },
  ],
}

export const ELDSC_PROGRAM = {
  title: 'Building Africa’s Most Capable Leather Manufacturing Sector',
  text: 'ELDSC works with ELIA to strengthen manufacturing capability and add value to Ethiopian leather. Its focus areas are the Ethiopian Highland Leather project, positioning the industry to benefit from the AfCFTA, supporting the Modjo leather industrial cluster, and promoting cleaner production, efficient resource use and waste reduction.',
}

export const MARKET_DEVELOPMENT = [
  { title: 'International Trade Fairs', text: 'Coordinating Ethiopian participation at international leather and fashion fairs, including the CBI “Leather Products from Ethiopia” program in Europe.' },
  { title: 'Made in Ethiopia', text: 'Presenting member companies to international buyers with partners such as GIZ and the Ministry of Industry.' },
  { title: 'Buyer Missions', text: 'Arranging factory visits and meetings for visiting buyers.' },
]

export const CAPACITY_BUILDING = [
  { title: 'Training', text: 'Workshops on production technology, quality management, design and export readiness.' },
  { title: 'Technical Assistance', text: 'Expert support with partners including UNIDO and ALLPI.' },
  { title: 'Policy Dialogue', text: 'Workshops such as the 2023 AfCFTA forum with UNECA and ECCSA.' },
]

export const SUSTAINABILITY = [
  { title: 'Cleaner Production', text: 'Promoting effluent treatment, water efficiency and reduced chemical use.' },
  { title: 'Certification Support', text: 'Guiding members toward Leather Working Group and ISO 14001 certification.' },
  { title: 'By-Product Value', text: 'Encouraging use of leather waste in products such as gelatin.' },
  { title: 'Industrial Clustering', text: 'Supporting relocation to serviced industrial parks with shared treatment plants.' },
]
