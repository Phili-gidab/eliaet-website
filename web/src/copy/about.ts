/* About page. Legacy content from eliaet.com/about.html and the home page, word for word (typos corrected). */

export const ABOUT_INTRO = {
  title: 'Ethiopian Leather Industries Association',
  body: [
    'As of January 2007, the name was changed to the Ethiopian Leather Industries Association (ELIA). ELIA incorporates footwear, leather garments & goods and tanners operating in the country as affiliate companies.',
    'ELIA is promoting the export of leather, shoes and leather goods and garments, protecting the rights of members and assisting them to improve their business.',
  ],
  nonprofit:
    'Ethiopian Leather Industries Association (ELIA) is a nonprofit trade association of the leather industries businesses. ELIA works to enhance and improve the leather industries business climate by promoting export of leather, shoes and leather goods and garment, protecting the rights of members, and assisting businesses to improve.',
}

/* Dates and events from the current site (home, about, AALF and EHL pages). */
export const TIMELINE = [
  { year: '1994', title: 'Ethiopian Tanners Association', text: 'ELIA is first established as the association of Ethiopia’s tanneries.' },
  { year: '2004', title: 'Footwear and goods join', text: 'Renamed the Ethiopian Tanners, Footwear and Leather Products Manufacturing Association, to allow footwear and leather garments and goods full participation.' },
  { year: '2007', title: 'ELIA', text: 'As of January 2007 the name becomes the Ethiopian Leather Industries Association.' },
  { year: '2008', title: 'First All African Leather Fair', text: 'ELIA launches AALF, the continental trade show it has organised ever since.' },
  { year: '2012', title: 'AfCFTA decision', text: 'The January 2012 decision to establish an African Continental Free Trade Area, and the action plan for boosting intra-African trade.' },
  { year: '2013', title: 'Export promotion with JICA', text: 'JICA supports Ethiopian export promotion; sheep leather is selected as the Ethiopian Champion Product.' },
  { year: '2017', title: 'Japanese experts arrive', text: 'JICA dispatches tanning experts, a designer, a bag craftsman and a shoe craftsman to Ethiopian tanneries and manufacturers.' },
  { year: '2021', title: 'EHL certification', text: 'As of October 2021, four tanneries have obtained the Ethiopian Highland Leather certificate.' },
  { year: '2026', title: 'AALF, 15th edition', text: '12–15 November 2026 at the Addis International Convention Center.' },
]

export type Person = { name: string; role: string; company?: string; email?: string[]; phone?: string[] }

export const BOARD: Person[] = [
  { name: 'Mr. Redman Bedada', role: 'Board Chairman and ELIA President', company: 'Owner & General Manager of Modjo Tannery' },
  { name: 'Mr. Tatek Yirga', role: 'Vice Board Chairman', company: 'Owner & General Manager of Batu Tannery' },
  { name: 'Mr. Ahmed Nuru', role: 'Board Member and Chief Accountant', company: 'Owner & General Manager of Gelan Tannery' },
  { name: 'Mr. Gashaw', role: 'Board Member', company: 'General Manager of Anbessa Shoe Manufacturer' },
  { name: 'Mr. Yared Gizachew', role: 'Board Member', company: 'Owner & General Manager of Ras Dashen Shoe' },
  { name: 'Mr. Zelalem Merawi', role: 'Board Member', company: 'Owner & General Manager of Ker Ezhi Leather' },
  { name: 'Ms. Amor Zemen', role: 'Board Member', company: 'Owner & General Manager of Amour Leather' },
]

export const STAFF: Person[] = [
  {
    name: 'Mr. Dagnachew Abebe',
    role: 'Secretary General',
    email: ['elia.aalf2@gmail.com', 'dagnaus@gmail.com'],
    phone: ['Tel. +251 011 515 61 44', 'Mob. +251 09 02224728', 'WhatsApp +251 09 02 22 47 28'],
  },
  {
    name: 'Mr. Tadesse Alemayehu',
    role: 'Finance and Admin',
    email: ['tadessealemayehu@ymail.com'],
    phone: ['Tel. +251 011 515 50 60 43', 'Mob. +251 09 11 02 26 06'],
  },
  {
    name: 'Mr. Tekele Gebremariam',
    role: 'Project Coordinator',
    email: ['tekleelia178@gmail.com'],
    phone: ['Tel. +251 011 515 50 60 43', 'Mob. +251 09 11 67 45 68'],
  },
  {
    name: 'Mr. Amsalu Kifelew',
    role: 'Shoe Expert',
    email: ['amsaluelia@gmail.com'],
    phone: ['Tel. +251 011 515 50 60 43', 'Mob. +251 09 11 31 39 30'],
  },
  {
    name: 'Mrs. Alemitu Lebeta',
    role: 'General Service',
    phone: ['Mob. +251 900723743'],
  },
]

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
