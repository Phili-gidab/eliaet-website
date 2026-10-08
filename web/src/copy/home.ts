/* Home page copy. Text marked "legacy" is carried over word for word from the current eliaet.com home page
   (obvious typos corrected). New copy written for the redesign is marked "new". */

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
      id: 'drums', t0: 0, t1: 3.4, in: 0.4, out: 3.1, label: 'The drum house', amharic: 'ዌት ብሉ',
      title: 'Hides become <em>leather</em> here.',
      line: 'In tanneries across Ethiopia, hides from the largest herd in Africa are tanned in drums like these.',
    },
    {
      id: 'process', t0: 3.4, t1: 7.4, in: 3.7, out: 7.1, label: 'Under one roof', amharic: 'ክረስት',
      title: 'Every stage, <em>one</em> craft.',
      line: 'Wringing, splitting, shaving, drying, finishing: the know-how to carry a hide all the way to finished leather.',
    },
    {
      id: 'craft', t0: 7.4, t1: 12, in: 8.0, out: 11.8, label: 'Made in Ethiopia', amharic: 'ያለቀ ቆዳ',
      title: 'Leather the <em>world</em> wears.',
      line: 'Shoes, bags, garments and gloves, cut and sewn by Ethiopian manufacturers.',
    },
    {
      id: 'world', t0: 12, t1: 16, in: 12.4, out: 15.7, label: 'Out of the door', amharic: '',
      title: 'Shipped from the <em>highlands</em>.',
      line: 'Finished leather and leather goods leave the tannery for buyers around the world.',
    },
  ],
  final: { id: 'elia', t0: 16, in: 16.4, label: 'ELIA' },
}

/* legacy: the four slides of the current home-page carousel */
export const HIGHLIGHTS = [
  {
    title: '14th All African Leather Fair',
    text: 'At Millennium Hall: brings together leather goods manufacturers and technology suppliers, chemical and inputs suppliers, training institutions, trade promotion organizations, etc. from all over the world.',
    to: '/aalf',
    image: '/media/carousel-5.webp',
  },
  {
    title: 'Enhancing Ethiopian leather industries',
    text: 'Building up the leather industrial sector with the highest manufacturing capability in Africa.',
    to: '/eldsc',
    image: '/media/carousel-3.webp',
  },
  {
    title: 'Ethiopian Highland Leather',
    text: 'The Ethiopian Highland Leather Project is an industrial project to promote exports from Ethiopia by adding value to Ethiopian sheep leather.',
    to: '/ehl',
    image: '/media/EHL01.webp',
  },
  {
    title: 'Styles you have to see',
    text: 'A modern classic style that lasts a lifetime.',
    to: '/members?sector=leather-goods',
    image: '/media/carousel-0.webp',
  },
]

/* legacy: "Our Vision / Our Mission / What We Do" */
export const PILLARS = [
  {
    key: 'vision',
    label: 'Our vision',
    text: 'To be the premier association spearheading the emergence of the Ethiopian leather industry as a key global player representative of its members who are producing and exporting first choice leather and leather products.',
  },
  {
    key: 'mission',
    label: 'Our mission',
    text: 'Contribute to the development of an enabling business environment and service provision such as advocacy, trade and technology transfer facilitation to its members for the sustainable development of the Ethiopian leather sector.',
  },
  {
    key: 'what',
    label: 'What we do',
    text: 'Promoting export of leather, shoes and leather goods and garment, protecting the rights of members, and assisting businesses to improve.',
  },
]

/* legacy: "About Us" block on the home page */
export const ABOUT = {
  eyebrow: 'About us',
  title: 'Ethiopian Leather Industries Association',
  body: [
    'A sectoral trade association of 194 leather manufacturing industries in Ethiopia. ELIA is working to enhance (build up) the capacity of the leather industries with the highest manufacturing capacity and the entire business climate, so that the leather industries produce diversified, globally competitive, environmentally friendly products and contribute significantly to improving the living standard of the people.',
    'ELIA was first established in 1994 as the Ethiopian Tanners Association. In 2004 the name was changed to the Ethiopian Tanners, Footwear and Leather Products Manufacturing Association to allow footwear and leather garments and goods full participation in the Association.',
  ],
  count: { value: 194, label: ['Leather', 'manufacturing', 'industries'] },
}

/* new: the tanning story told by the 3D hide. The facts are general leather-making knowledge. */
export const PROCESS = [
  {
    key: 'raw',
    amharic: 'ጥሬ ቆዳ',
    name: 'Raw hide',
    title: 'It starts at the table.',
    text: 'Every Ethiopian hide and skin is a by-product of the country’s food culture. Nothing is raised for leather alone; what would be waste becomes a material.',
  },
  {
    key: 'wetblue',
    amharic: 'ዌት ብሉ',
    name: 'Wet-blue',
    title: 'Tanned, and made to last.',
    text: 'Soaked, limed and tanned, the hide turns a pale blue and will no longer rot. In this stable state it can be stored, graded and traded across the world.',
  },
  {
    key: 'crust',
    amharic: 'ክረስት',
    name: 'Crust',
    title: 'Given its character.',
    text: 'Re-tanned, dyed and dried, the leather finds its softness, its colour and its strength. Most of a tannery’s craft goes into this stage.',
  },
  {
    key: 'finished',
    amharic: 'ያለቀ ቆዳ',
    name: 'Finished leather',
    title: 'Ready for the maker.',
    text: 'Finished, graded and measured, it leaves the tannery for the shoe and leather goods factories of Ethiopia, and for buyers around the world.',
  },
]

/* legacy: "Why You Should Choose Ethiopian Leather" */
export const WHY = {
  eyebrow: 'Why choose us',
  title: 'Why you should choose Ethiopian leather.',
  intro:
    'Ethiopia’s leather and leather product sector already produces a range of products, from semi-processed leather in various forms to processed leathers including shoe uppers, leather garments, stitched upholstery, backpacks, purses, industrial gloves and finished leather.',
  points: [
    {
      title: 'Livestock potential',
      text: 'Ethiopia is home to the largest population of cattle in Africa and the 10th largest in the world.',
      figure: { value: '1st', label: 'cattle population in Africa' },
    },
    {
      title: 'Livestock Master Plan',
      text: 'A national Livestock Master Plan is prepared by the Ministry of Agriculture and implemented by the Agricultural Transformation Agency (ATA).',
      figure: { value: 'MoA', label: 'with the ATA' },
    },
    {
      title: 'Opportunity for investors',
      text: 'As one of the government’s priority sectors, investors in leather enjoy incentives including duty exemptions on capital goods and construction materials, and five-plus years of an income tax holiday.',
      figure: { value: '5+', label: 'years income tax holiday' },
    },
  ],
  images: ['/media/home/leather1.webp', '/media/home/leather2.webp'],
}

/* legacy: "Make An Appointment To Discuss About A Project" */
export const APPOINTMENT = {
  eyebrow: 'Appointment',
  title: 'Make an appointment to discuss a project.',
  text: 'Shop our collection of fine leather bags, wallets and other leather goods from manufacturers. In addition, make contact with equipment and technology suppliers, chemical and inputs suppliers, manpower training institutions, trade promotion organizations, etc. from all over the world.',
  sectors: ['Tannery', 'Shoe manufacturing', 'Leather products'],
}

/* legacy: the "Subscribe for New Updates" band */
export const SUBSCRIBE = {
  title: 'Subscribe for new updates',
  text: 'News from Ethiopia’s leather sector, the All African Leather Fair and ELIA’s programs, now and then. No noise.',
}
