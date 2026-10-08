/* Sustainable Development Goals and partners. Legacy content from the eliaet.com home page, word for word.
   SDG colours are the UN's official ones. */

export const SDG_INTRO = {
  eyebrow: 'SDGs & manufacturing leather products',
  title: 'Incorporates leather manufacturing affiliate companies.',
  text: 'Promoting export of leather, shoes and leather goods and garment, protecting the rights of members, and assisting businesses to improve.',
}

export const SDGS = [
  {
    goal: 3,
    name: 'Good health & well-being',
    color: '#4C9F38',
    text: 'We aim to make sure leather manufacturers are able to understand, manage and implement chemical management systems, to ensure restricted substance lists are adhered to.',
    icon: '/media/mdgs/MD-Goal-03.svg',
  },
  {
    goal: 6,
    name: 'Clean water & sanitation',
    color: '#26BDE2',
    text: 'We assess leather manufacturers on their water consumption and treatment and disposal of wastewater, with the aim of increasing water usage efficiency and reducing pollution.',
    icon: '/media/mdgs/MD-Goal-06.svg',
  },
  {
    goal: 12,
    name: 'Responsible production',
    color: '#BF8B2E',
    text: 'Leather manufacturers are encouraged to efficiently manage their chemical, water and energy usage. Brands and retailers are also encouraged to source their materials responsibly.',
    icon: '/media/mdgs/MD-Goal-12.svg',
  },
  {
    goal: 14,
    name: 'Life below water',
    color: '#0A97D9',
    text: 'We assess leather manufacturers on their use of hazardous chemicals and endorse the ZDHC Manufacturing Restricted Substance List (MRSL) for leather. We also monitor the volume, composition, and final discharge location of a facility’s wastewater.',
    icon: '/media/mdgs/MD-Goal-14.svg',
  },
  {
    goal: 15,
    name: 'Life on land',
    color: '#56C02B',
    text: 'ELIA is working collaboratively with NGO partners to find a solution to deforestation exposure within the global value chain.',
    icon: '/media/mdgs/MD-Goal-15.svg',
  },
  {
    goal: 17,
    name: 'Partnerships for the goals',
    color: '#19486A',
    text: 'ELIA itself is a collaboration of many stakeholders across different sectors of the leather industry. We also collaborate with a range of organizations on different issues with relevance to the purpose of the group and the needs of its members.',
    icon: '/media/mdgs/MD-Goal-17.svg',
  },
]

export const PARTNERS_INTRO = {
  eyebrow: 'Development partners & government offices',
  title: 'We collaborate and work with organizations.',
  text: 'We collaborate and work with a range of organizations on different issues with relevance to the purpose of the group and the needs of its members.',
}

export type Partner = { short: string; name: string; kind: 'Development partner' | 'Government office' | 'Brand'; text: string; logo?: string }

export const PARTNERS: Partner[] = [
  { short: 'UNIDO', name: 'United Nations Industrial Development Organization', kind: 'Development partner', logo: '/media/partners/unido.webp', text: 'The United Nations Industrial Development Organization is a specialized agency of the United Nations that assists countries in economic and industrial development.' },
  { short: 'UNDP', name: 'United Nations Development Programme', kind: 'Development partner', text: 'The United Nations Development Programme is a United Nations agency tasked with helping countries eliminate poverty and achieve sustainable economic growth and human development.' },
  { short: 'JICA', name: 'Japan International Cooperation Agency', kind: 'Development partner', logo: '/media/partners/jica.webp', text: 'The Japan International Cooperation Agency (JICA) is an independent governmental agency that plays a crucial role in coordinating Official Development Assistance (ODA) for the government of Japan.' },
  { short: 'CVM', name: 'Comunità Volontari per il Mondo', kind: 'Development partner', logo: '/media/partners/cvm.webp', text: '“Community Volunteers for the World” is an Italian non-profit organization that deals with international cooperation projects in Africa and Asia, mainly for the promotion of human rights, global citizenship education and the training of teachers and educators.' },
  { short: 'First Consult', name: 'First Consult', kind: 'Development partner', logo: '/media/partners/first-consult.webp', text: 'First Consult is a leading economic development consulting firm implementing projects in Ethiopia. Founded in 2006.' },
  { short: 'Solidaridad', name: 'Solidaridad Network', kind: 'Development partner', logo: '/media/partners/solidaridad.webp', text: 'The Solidaridad Network is an international civil society organisation founded in 1969. Its main objective is facilitating the development of socially responsible, ecologically sound and profitable supply chains.' },
  { short: 'MOI', name: 'Ministry of Industry', kind: 'Government office', logo: '/media/gov-partners/moi.webp', text: 'The Ethiopian Ministry of Industry.' },
  { short: 'MOTRI', name: 'Ministry of Trade and Regional Integration', kind: 'Government office', logo: '/media/gov-partners/motri.webp', text: 'The Ethiopian Ministry of Trade and Regional Integration.' },
  { short: 'LLPIRDC', name: 'Leather and Leather Products Research and Development Center', kind: 'Government office', logo: '/media/gov-partners/llpirdc.webp', text: 'The Ethiopian Manufacturing Industry Development Institute Leather and Leather Products Research and Development Center.' },
  { short: 'MOA', name: 'Ministry of Agriculture', kind: 'Government office', logo: '/media/gov-partners/moa.webp', text: 'The Ethiopian Ministry of Agriculture.' },
  { short: 'MIDI', name: 'Manufacturing Industry Development Institute', kind: 'Government office', logo: '/media/gov-partners/midi.webp', text: 'The Ethiopian Manufacturing Industry Development Institute.' },
  { short: 'ECCSA', name: 'Ethiopian Chamber of Commerce and Sectoral Associations', kind: 'Government office', logo: '/media/gov-partners/eccsa.webp', text: 'Ethiopian Chamber of Commerce and Sectoral Associations.' },
  { short: 'AACCSA', name: 'Addis Ababa Chamber of Commerce and Sectoral Associations', kind: 'Government office', logo: '/media/gov-partners/aaccsa.webp', text: 'Addis Ababa Chamber of Commerce and Sectoral Associations.' },
]

/* The two ELIA brands shown in the same carousel on the current site */
export const BRANDS: Partner[] = [
  { short: 'EHL', name: 'Ethiopian Highland Leather', kind: 'Brand', logo: '/media/partners/ehl.webp', text: 'The Ethiopian Highland Leather Project is an industrial project to promote exports from Ethiopia by adding value to Ethiopian sheep leather.' },
  { short: 'AALF', name: 'All African Leather Fair', kind: 'Brand', logo: '/media/partners/aalf.webp', text: 'The trade show organised by the Ethiopian Leather Industries Association (ELIA) since its first edition in 2008.' },
]
