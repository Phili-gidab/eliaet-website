/* The six initiatives from the "What We Do / Visit Our Latest Projects And Our Innovative Works" tabs on the
   current home and about pages. Text is legacy, word for word (typos corrected). */

export type Program = {
  slug: string
  short: string
  name: string
  title: string
  text: string
  points: string[]
  image: string
  to?: string
  href?: string
  cta: string
}

export const PROGRAMS_INTRO = {
  eyebrow: 'What we do',
  title: 'Our latest projects and innovative works.',
}

export const PROGRAMS: Program[] = [
  {
    slug: 'ehl',
    short: 'EHL',
    name: 'Ethiopian Highland Leather',
    title: 'Opening new possibilities of leather.',
    text: 'The Ethiopian Highland Leather Project is an industrial project to promote exports from Ethiopia by adding value to Ethiopian sheep leather. The world’s highest quality sheep leather, from the mystical highlands of Ethiopia: made from a special type of hair sheep bred in the Ethiopian highlands, and neatly finished by the experienced craftsmanship of Ethiopian tanners.',
    points: ['Light, thin and soft leather', 'Strong and durable leather', 'Superior quality leather'],
    image: '/media/home/ehl.webp',
    to: '/ehl',
    cta: 'Discover EHL',
  },
  {
    slug: 'aalf',
    short: 'AALF',
    name: 'All African Leather Fair',
    title: 'Africa’s biggest and most important international leather exhibition.',
    text: 'The trade show organised by the Ethiopian Leather Industries Association (ELIA) since its first edition in 2008. AALF brings together tanners, footwear and other leather goods manufacturers, in addition to equipment and technology suppliers, chemical and inputs suppliers, manpower training institutions, trade promotion organizations, etc. from all over the world.',
    points: ['Your gateway to introduce your products', 'Meet international industry players', 'Build long-term partnerships'],
    image: '/media/fair/hall.webp',
    to: '/aalf',
    cta: 'About the fair',
  },
  {
    slug: 'eldsc',
    short: 'ELDSC',
    name: 'Ethiopian Leather Development S.C.',
    title: 'A significant player in the Ethiopian leather industry.',
    text: 'ELDSC aims to enhance the Ethiopian leather industry by building up the leather industrial sector with the highest manufacturing capability in Africa. Its vision is to create a diversified, globally competitive, environmentally friendly industry capable of significantly improving the living standards of the Ethiopian people by the year 2025.',
    points: ['Eco-friendly practices', 'Resource management', 'Collaboration and awareness'],
    image: '/media/home/eldsc.webp',
    to: '/eldsc',
    cta: 'About ELDSC',
  },
  {
    slug: 'afcfta',
    short: 'AfCFTA',
    name: 'African Continental Free Trade Area',
    title: 'The world’s largest free trade area, and a change for African economies.',
    text: 'In January 2012, Ethiopia adopted the decision to establish an African Continental Free Trade Area and the Action Plan for Boosting Intra-African Trade as key initiatives whose implementation would promote socio-economic growth and development, bring transformative change and tremendous opportunity to African economies.',
    points: ['Increase employment', 'Increase incomes', 'Expand opportunities'],
    image: '/media/home/acfta.webp',
    cta: 'AfCFTA',
  },
  {
    slug: 'shop',
    short: 'Shop',
    name: 'Shopping Ethiopian leather products',
    title: 'Buy quality products here.',
    text: 'Building up the leather industrial sector with the highest manufacturing capability in Africa, which is diversified, globally competitive, environmentally friendly, and capable of significantly improving the living standards of the Ethiopian people. We’ve come a long way, so we know exactly which direction to take when supplying you with high quality yet budget-friendly products. We offer all of this while providing excellent customer service and friendly support.',
    points: ['Selling authentic leather products', 'Own quality handmade leather goods', 'The premier e-commerce destination'],
    image: '/media/home/leather1.webp',
    href: 'https://leathersofethiopia.com/',
    cta: 'Buy products',
  },
  {
    slug: 'members',
    short: '194',
    name: 'ELIA members',
    title: '194 leather manufacturing companies.',
    text: 'Ethiopian Leather Industries Association (ELIA) is a nonprofit trade association of the leather industries businesses. ELIA works to enhance and improve the leather industries business climate by promoting export of leather, shoes and leather goods and garment, protecting the rights of members, and assisting businesses to improve.',
    points: ['Natural qualities of clarity', 'Flexibility & strength', 'Thickness & compact texture'],
    image: '/media/home/aalia.webp',
    to: '/members',
    cta: 'Members directory',
  },
]
