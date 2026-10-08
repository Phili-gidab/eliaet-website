/* Members: the industry-by-size table and the section texts from eliaet.com/members.html (legacy).
   The directory entries themselves are served by the API (server/data/members.json). */

export type SectorKey = 'tannery' | 'footwear' | 'leather-goods'
export type SizeKey = 'large' | 'medium' | 'small'

export const SECTORS: Record<SectorKey, { label: string; plural: string; amharic: string; intro: string; scale: string }> = {
  tannery: {
    label: 'Tannery',
    plural: 'Tanneries',
    amharic: 'ቆዳ ፋብሪካ',
    intro: 'Tanneries are fascinating places where the magic of transforming animal hides into luxurious leather unfolds.',
    scale: 'Large scale',
  },
  footwear: {
    label: 'Shoe manufacturer',
    plural: 'Shoe manufacturers',
    amharic: 'ጫማ',
    intro: 'Ethiopia has a vibrant shoe manufacturing industry, and several companies contribute to this sector.',
    scale: 'Medium scale',
  },
  'leather-goods': {
    label: 'Leather products',
    plural: 'Leather product manufacturers',
    amharic: 'የቆዳ ውጤቶች',
    intro: 'Leather products encompass a wide range of items made from durable and versatile material, which includes bags and purses, wallets, belts, jackets and outerwear, gloves, shoes and boots, and accessories.',
    scale: 'Small scale',
  },
}

export const SIZE_NOTE =
  'In the Ethiopian leather industry, the tanneries are in the large scale category, shoe manufacturers are in medium and other leather product manufacturers are in the small category.'

/* "Ethiopian Leather Industry by Size" — the table on the current members page. Rows: size; columns: sector. */
export const BY_SIZE: Record<SizeKey, Record<SectorKey, number>> = {
  large: { tannery: 24, footwear: 5, 'leather-goods': 1 },
  medium: { tannery: 4, footwear: 7, 'leather-goods': 7 },
  small: { tannery: 0, footwear: 25, 'leather-goods': 121 },
}

export const SECTOR_TOTALS: Record<SectorKey, number> = { tannery: 28, footwear: 37, 'leather-goods': 129 }
export const SIZE_TOTALS: Record<SizeKey, number> = { large: 30, medium: 18, small: 146 }
export const TOTAL_MEMBERS = 194
