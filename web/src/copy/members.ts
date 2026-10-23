/* Members: the membership at a glance (category by size), the directory's public page and what membership brings.
   From ELIA's website content document (October 2026); the sector texts are legacy (eliaet.com/members.html).
   The directory itself is for signed-in members (the API, server/src/routes/member.ts). */

export type SectorKey = 'tannery' | 'footwear' | 'leather-goods'
export type SizeKey = 'large' | 'medium' | 'small'

export const SECTORS: Record<SectorKey, { label: string; plural: string; intro: string; scale: string }> = {
  tannery: {
    label: 'Tannery',
    plural: 'Tanneries',
    intro: 'Tanneries are fascinating places where the magic of transforming animal hides into luxurious leather unfolds.',
    scale: 'Mainly large-scale',
  },
  footwear: {
    label: 'Shoe manufacturer',
    plural: 'Shoe manufacturers',
    intro: 'Ethiopia has a vibrant shoe manufacturing industry, and several companies contribute to this sector.',
    scale: 'Medium and small-scale',
  },
  'leather-goods': {
    label: 'Leather products',
    plural: 'Leather product manufacturers',
    intro: 'Leather products encompass a wide range of items made from durable and versatile material, which includes bags and purses, wallets, belts, jackets and outerwear, gloves, shoes and boots, and accessories.',
    scale: 'Mainly small-scale',
  },
}

export const SIZE_NOTE =
  'Tanneries are mainly large-scale enterprises. Shoe manufacturers are mostly medium and small-scale, and other leather product manufacturers are mainly small-scale.'

/* "Ethiopian Leather Industry by Size" — the table on the current members page. Rows: size; columns: sector. */
export const BY_SIZE: Record<SizeKey, Record<SectorKey, number>> = {
  large: { tannery: 24, footwear: 5, 'leather-goods': 1 },
  medium: { tannery: 4, footwear: 7, 'leather-goods': 7 },
  small: { tannery: 0, footwear: 25, 'leather-goods': 121 },
}

export const SECTOR_TOTALS: Record<SectorKey, number> = { tannery: 28, footwear: 37, 'leather-goods': 129 }
export const SIZE_TOTALS: Record<SizeKey, number> = { large: 30, medium: 18, small: 146 }
export const TOTAL_MEMBERS = 194

export const MEMBERS_HEAD = {
  title: 'Members Directory',
  subtitle: 'A private network of Ethiopia’s leather manufacturers.',
  intro: 'The ELIA Members Directory is a secure database of our member enterprises, available only to registered members. It helps members find suppliers, partners and subcontractors across the leather value chain.',
  buyers: 'Not a member? ELIA connects international buyers and investors with suitable manufacturers. Visit Investor and Buyer Information or send us an inquiry.',
}

export const LOGIN_NOTE = 'Each member company may register up to three users. Access is approved by the ELIA Secretariat.'

export const BENEFITS = [
  { title: 'Representation', text: 'A voice in policy decisions on raw hide supply, finance, taxation and environmental compliance.' },
  { title: 'Market Access', text: 'Priority places at the All Africa Leather Fair and Ethiopian pavilions at international fairs.' },
  { title: 'Buyer Linkages', text: 'Referrals from buyer and investor inquiries received by ELIA.' },
  { title: 'Training and Technical Support', text: 'Workshops, expert advice and technical assistance.' },
  { title: 'Information', text: 'Market intelligence, regulatory updates and members-only reports.' },
  { title: 'Collective Branding', text: 'Eligibility for Ethiopian Highland Leather certification.' },
  { title: 'Networking', text: 'Access to this directory and to member meetings.' },
]

export const JOIN = {
  title: 'Join ELIA',
  text: 'Membership is open to leather manufacturers and industry service providers operating in Ethiopia. Submit the form and the Secretariat will contact you within ten working days.',
}
