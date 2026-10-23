/* Home page copy. Text marked "legacy" is carried over word for word from the current eliaet.com home page
   (obvious typos corrected). New copy written for the redesign is marked "new". */
import { AALF_2026 } from './aalf'

export const HERO = {
  // new
  eyebrow: 'Ethiopian Leather Industries Association',
  title: ['From the highlands,', 'to the world.'],
  lede: 'The national association of Ethiopia’s tanneries, shoe manufacturers and leather goods makers. 194 companies, one voice, since 1994.',
}

/* new: the home film's chapters. Times are the film's own (seconds; see blender/scripts/cam6.py BEATS):
   each chapter's copy comes in with its moment in the film and leaves before the next. */
export const STORY = {
  end: 20,
  chapters: [
    {
      id: 'drums', t0: 0, t1: 3.4, in: 0.15, out: 3.3, label: 'The drum house', amharic: 'ዌት ብሉ',
      title: 'Hides become <em>leather</em> here.',
      line: 'In tanneries across Ethiopia, hides from the largest herd in Africa are tanned in drums like these.',
    },
    {
      id: 'process', t0: 3.4, t1: 7.4, in: 3.5, out: 7.3, label: 'Under one roof', amharic: 'ክረስት',
      title: 'Every stage, <em>one</em> craft.',
      line: 'Wringing, splitting, shaving, drying, finishing: the know-how to carry a hide all the way to finished leather.',
    },
    {
      id: 'craft', t0: 7.4, t1: 12, in: 7.6, out: 11.9, label: 'Made in Ethiopia', amharic: 'ያለቀ ቆዳ',
      title: 'Leather the <em>world</em> wears.',
      line: 'Shoes, bags, garments and gloves, cut and sewn by Ethiopian manufacturers.',
    },
    {
      id: 'world', t0: 12, t1: 16, in: 12.1, out: 15.9, label: 'Out of the door', amharic: '',
      title: 'Out to <em>market</em>.',
      line: 'Finished leather and leather goods leave the tannery for buyers in Europe, Asia, North America and Africa.',
    },
  ],
  final: { id: 'elia', t0: 16, in: 16.1, label: 'ELIA' },
}

/* new: small labels that ride on the film, pinned to what they name (the stages of the work, the finished goods,
   the export crate). Where each one is, frame by frame, comes from the film's cameras (public/film/pins.json,
   made by blender/scripts/track6.py and pins6.py); a pin shows only while its thing is in view and in the open. */
export const PINS: { id: string; label: string; n?: string }[] = [
  { id: 'wringing', label: 'Wringing' },
  { id: 'splitting', label: 'Splitting' },
  { id: 'drying', label: 'Hang drying' },
  { id: 'finishing', label: 'Finishing' },
  { id: 'garments', label: 'Garments' },
  { id: 'bags', label: 'Bags' },
  { id: 'leather', label: 'Finished leather' },
]

/* the four cards under "Programmes that open markets": the old home page's carousel (the fair, ELDSC, EHL, the
   styles), its words now from ELIA's website content document (October 2026) */
export const HIGHLIGHTS = [
  {
    title: `${AALF_2026.edition.replace(' edition', '')} All Africa Leather Fair`,
    text: `${AALF_2026.dates}, ${AALF_2026.venue}. Africa’s leather trade show, organized by ELIA since 2008: tanners, manufacturers, buyers, investors and suppliers from Africa and beyond.`,
    to: '/aalf',
    image: '/media/fair/aalf-film.jpg',
    /** the fair's own film (from the AALF site's hero): the hides come together as Africa, then the fair's mark */
    video: { av1: '/media/fair/aalf-film-av1.mp4', mp4: '/media/fair/aalf-film.mp4' },
  },
  {
    title: 'Building manufacturing capability',
    text: 'With the Ethiopian Leather Development S.C.: the Highland Leather project, the AfCFTA, the Modjo leather cluster and cleaner production.',
    to: '/eldsc',
    image: '/media/eldsc/eldsc.webp',
    /** hands cutting leather at the bench: keep the knife and the hide in */
    focus: '50% 62%',
  },
  {
    title: 'Ethiopian Highland Leather',
    text: 'The national brand of premium sheepskin, developed in 2015 and owned and managed by ELIA, with four certified producers.',
    to: '/ehl',
    image: '/media/EHL01.webp',
  },
  {
    title: 'Source from Ethiopia',
    text: 'Leather, footwear, gloves, bags and garments from ELIA’s members. Tell us what you need and we make the introductions.',
    to: '/invest#buyers',
    image: '/media/studio/goods-styles.webp',
    /** the card is wider than the picture on large screens: keep the handles in */
    focus: '58% 28%',
  },
]

/* "Our vision / Our mission / What we do": vision and mission as ELIA's website content document words them, what
   ELIA does in a line from its six parts (advocacy, market development, capacity building, sustainability,
   partnerships, information) */
export const PILLARS = [
  {
    key: 'vision',
    label: 'Our vision',
    text: 'To be the leading association driving the Ethiopian leather industry to become a key global player, representing members who produce and export first-choice leather and leather products.',
  },
  {
    key: 'mission',
    label: 'Our mission',
    text: 'To build an enabling business environment for the sustainable development of the Ethiopian leather sector, through advocacy, trade facilitation and technology transfer services for our members.',
  },
  {
    key: 'what',
    label: 'What we do',
    text: 'We speak for the industry in policy, open markets through the All Africa Leather Fair and buyer linkages, and bring members training, technology and cleaner production.',
  },
]

/* "About us" on the home page: "Who we are", from the content document */
export const ABOUT = {
  eyebrow: 'About us',
  title: 'Ethiopian Leather Industries Association',
  body: [
    'The sectoral association of Ethiopia’s leather manufacturers: tanneries, footwear manufacturers, and leather goods and garment producers, covering the whole value chain from hide processing to finished products.',
    'ELIA represents the industry before the government, connects members with buyers and partners, and helps them improve quality, meet international standards and grow exports. It owns and organizes the All Africa Leather Fair and manages the Ethiopian Highland Leather national brand.',
  ],
  count: { value: 194, label: ['Leather', 'manufacturing', 'industries'] },
}

/* "Why Ethiopia. Why now.": from ELIA's 2026 profile and the content document's "Why Ethiopia" */
export const WHY = {
  eyebrow: 'Why Ethiopia',
  title: 'Why Ethiopia. Why now.',
  intro:
    'Ethiopia has the largest livestock population in Africa and a leather industry dating back to the early 20th century. Today it is moving from exporting raw and semi-processed leather to making finished footwear, garments and leather goods for markets at home and abroad.',
  points: [
    {
      title: 'Africa’s largest herd',
      text: 'The largest livestock population in Africa, and highland hides and skins preferred by international buyers.',
      figure: { value: '1st', unit: '', label: 'livestock population in Africa' },
    },
    {
      title: 'A material no one can copy',
      text: 'Ethiopian Highland Leather: sheepskin thinned to under 0.35 mm, light and soft yet strong, and a registered national brand.',
      figure: { value: '0.35', unit: 'mm', label: 'highland leather' },
    },
    {
      title: 'A continental market',
      text: 'The African Continental Free Trade Area opens a market of 1.4 billion people, and Ethiopian Airlines cargo links Addis Ababa to more than 130 destinations.',
      figure: { value: '1.4', unit: 'bn', label: 'people in the AfCFTA' },
    },
    {
      title: 'A priority sector',
      text: 'Investors in leather get income tax holidays and duty-free import of capital goods and construction materials.',
      figure: { value: '0', unit: '%', label: 'duty on capital goods' },
    },
  ],
}

/* legacy: "Make An Appointment To Discuss About A Project" */
export const APPOINTMENT = {
  eyebrow: 'Appointments · ELIA Secretariat',
  title: ['Make an appointment', 'to discuss a project.'],
  text: 'Sourcing from Ethiopian manufacturers, planning an investment, exhibiting at the All Africa Leather Fair or joining ELIA: meet the Secretariat in Addis Ababa.',
  steps: [
    ['Choose a day', 'and, if you like, a time of day.'],
    ['We call you', 'to confirm the time.'],
    ['Meet the Secretariat', 'at the ELIA office, Meskel Square.'],
  ],
  // the server accepts these and no others (server/src/routes/forms.ts)
  sectors: ['Tannery', 'Shoe manufacturing', 'Leather products', 'Other'],
  times: ['Morning', 'Afternoon'],
}

/* legacy: the "Subscribe for New Updates" band */
export const SUBSCRIBE = {
  title: 'Subscribe for new updates',
  text: 'News from Ethiopia’s leather sector, the All Africa Leather Fair and ELIA’s programs, now and then. No noise.',
}
