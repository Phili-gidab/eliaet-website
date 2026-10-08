/* Build-time data: the member directory and the news posts live with the server (server/data/*.json) so the
   API and the pages share one source. The pages are built from them; the API serves the same files live. */
import fs from 'node:fs'
import path from 'node:path'

const dataDir = () => {
  const candidates = [path.resolve(process.cwd(), '../server/data'), path.resolve(process.cwd(), 'server/data')]
  return candidates.find((d) => fs.existsSync(d)) ?? candidates[0]
}
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(dataDir(), file), 'utf8')) as T

export type Member = {
  slug: string
  name: string
  sectors: string[]
  city?: string
  ehlCertified?: boolean
  logo?: string
  phones?: { label: string; value: string }[]
  emails?: string[]
  website?: string
  [k: string]: unknown
}
export type Post = {
  slug: string
  kind?: 'post' | 'event'
  category?: string
  title: string
  excerpt?: string
  date?: string | null
  image?: string
  to?: string
  href?: string
}

export const loadMembers = () => read<{ members: Member[] }>('members.json').members.slice().sort((a, b) => a.name.localeCompare(b.name))
export const loadNews = () => read<{ posts: Post[] }>('news.json').posts
