/* About page. From ELIA's website content document (October 2026), word for word where it gives the words. */

export const ABOUT_HEAD = {
  title: 'About ELIA',
  subtitle: 'The national voice of Ethiopia’s leather industry since 1994.',
}

export const WHO = {
  title: 'Who we are',
  body: [
    'The Ethiopian Leather Industries Association (ELIA) is the sectoral association of Ethiopia’s leather manufacturers. Our members include tanneries, footwear manufacturers, and leather goods and garment producers, covering the full leather value chain from hide processing to finished products.',
    'ELIA represents the industry before the government, connects members with buyers and partners, and supports businesses to improve quality, meet international standards and grow exports. We also own and organize the All Africa Leather Fair (AALF) and manage the Ethiopian Highland Leather (EHL) national brand.',
  ],
}

export const HISTORY: { year: string; text: string }[] = [
  { year: '1994', text: 'Founded as the Ethiopian Tanners Association to represent the country’s tanneries.' },
  { year: '2004', text: 'Renamed the Ethiopian Tanners, Footwear and Leather Products Manufacturing Association, opening full membership to footwear, garment and leather goods producers.' },
  { year: 'January 2007', text: 'Adopted its current name, the Ethiopian Leather Industries Association (ELIA).' },
  { year: '2008', text: 'Launched the first All Africa Leather Fair in Addis Ababa.' },
  { year: '2015', text: 'Developed the Ethiopian Highland Leather national brand.' },
  { year: '2023', text: 'Co-organized the first workshop on the Ethiopian leather industry and the AfCFTA with UNECA and ECCSA.' },
  { year: '2026', text: 'Partnered with Messe Frankfurt to host AALF 2026 alongside Africa Sourcing and Fashion Week.' },
]

export const VISION =
  'To be the leading association driving the Ethiopian leather industry to become a key global player, representing members who produce and export first-choice leather and leather products.'
export const MISSION =
  'To build an enabling business environment for the sustainable development of the Ethiopian leather sector, through advocacy, trade facilitation and technology transfer services for our members.'

export const WHAT_WE_DO = [
  { title: 'Advocacy', text: 'We represent the industry in policy, regulatory and investment decisions, including raw hide supply, finance and environmental compliance.' },
  { title: 'Market Development', text: 'We open markets through the All Africa Leather Fair, international trade fairs and buyer linkages.' },
  { title: 'Capacity Building', text: 'We coordinate training, technical assistance and technology transfer for members.' },
  { title: 'Sustainability', text: 'We promote cleaner production and responsible practices across the sector.' },
  { title: 'Partnerships', text: 'We work with government, development partners and international organizations on sector programs.' },
  { title: 'Information', text: 'We share market intelligence, regulatory updates and industry data with members.' },
]

export const VALUES = [
  { title: 'Quality', text: 'Commitment to manufacturing excellence and consistent products.' },
  { title: 'Sustainability', text: 'Growth that protects the environment and communities.' },
  { title: 'Collaboration', text: 'A stronger sector through collective action.' },
  { title: 'Integrity', text: 'Honest, accountable and transparent governance.' },
  { title: 'Inclusion', text: 'Opportunities for women, youth and enterprises of every size.' },
]

export const PRESIDENT = {
  name: 'Zelalem Merawi',
  role: 'President, Ethiopian Leather Industries Association',
  /** a portrait, when ELIA sends one (web/public/media/people/) */
  photo: '' as string,
  message:
    'Ethiopia’s leather industry was for many years the country’s second-largest source of foreign currency after coffee. With the largest livestock population in Africa and highland hides valued by buyers worldwide, our potential is far greater than our current share of the global leather market. ELIA’s task is to help our members add value at home, reach international markets and build an industry that creates jobs and earns foreign exchange for Ethiopia.',
}

export const GOVERNANCE = {
  board:
    'ELIA is governed by a Board of Directors elected by its members. The Board sets strategy, approves partnerships, oversees finances and represents the industry in high-level policy dialogue. Board members come from tanneries, footwear manufacturers and leather goods producers.',
  secretariat: 'The Secretariat runs ELIA’s daily operations under the direction of the Board.',
  /** the Secretariat's teams (names to follow from ELIA) */
  teams: ['Secretary General', 'Finance and Administration', 'Programs and Projects (including AALF)', 'Member Services', 'Communications'],
}

export const PARTNERS_INTRO = {
  title: 'Working Together for the Sector',
  text: 'ELIA works with national institutions and international organizations to develop Ethiopia’s leather industry.',
}
export const PARTNER_GROUPS: { group: string; items: string[] }[] = [
  {
    group: 'Government',
    items: ['Ministry of Industry', 'Ministry of Trade and Regional Integration', 'Ministry of Agriculture', 'Ethiopian Investment Commission', 'Leather and Leather Products Industry Research and Development Center'],
  },
  { group: 'Business Bodies', items: ['Ethiopian Chamber of Commerce and Sectoral Associations (ECCSA)'] },
  {
    group: 'Regional and International',
    items: ['Africa Leather and Leather Products Institute (ALLPI)', 'United Nations Industrial Development Organization (UNIDO)', 'UN Economic Commission for Africa (UNECA)'],
  },
  { group: 'Development Partners', items: ['GIZ', 'CBI (Netherlands)', 'JICA', 'Solidaridad Network'] },
  { group: 'Trade Fair Partner', items: ['Messe Frankfurt'] },
]

/* ELDSC page: its people, from the current eliaet.com (legacy). */
export type Person = { name: string; role: string; company?: string; email?: string[]; phone?: string[] }
export const ELDSC_STAFF: Person[] = [
  {
    name: 'Mr. Mesfin Lemma',
    role: 'General Manager of ELDSC',
    email: ['lemmamesfin38@gmail.com'],
    phone: ['Tel. +251 011 554 81 22', 'Mob. +251 09 12 50 30 85', 'Mob. +251 09 11 48 28 03', 'P.O. Box 12898, Addis Ababa'],
  },
  { name: 'Fantanesh Ayalew', role: 'Finance Manager', email: ['mimid9498@gmail.com'], phone: ['Mob. +251 913034518'] },
  { name: 'Semhar Habitom', role: 'Banking and Transit Officer', email: ['semi_eria@yahoo.com'], phone: ['Mob. +251 954876829'] },
]
