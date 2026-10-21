/* The database's tables, one migration at a time. A migration never changes once it has shipped: add a new one.
   Dates are ISO strings (UTC times, or YYYY-MM-DD days); lists are JSON text. */
export const MIGRATIONS: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: 'members, people, content, forms',
    sql: `
CREATE TABLE files (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,                 -- random; the stored file is named after it
  name TEXT NOT NULL,                       -- the name it was uploaded with (cleaned)
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  access TEXT NOT NULL CHECK (access IN ('public', 'members', 'private')),
  owner_user_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE companies (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('tannery', 'footwear', 'leather_goods', 'associate')),
  size TEXT CHECK (size IN ('large', 'medium', 'small')),
  year_established INTEGER,
  city TEXT,
  region TEXT,                              -- addis_ababa, oromia, amhara, ... (see shared/options.ts)
  address TEXT,
  lat REAL,
  lng REAL,
  products TEXT,
  leather_types TEXT,
  capacity TEXT,
  employees INTEGER,
  export_status TEXT CHECK (export_status IN ('exporting', 'ready', 'domestic')),
  export_markets TEXT,
  certifications TEXT NOT NULL DEFAULT '[]', -- ["EHL", "LWG", "ISO"]
  contact_name TEXT,
  contact_position TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  about TEXT,
  logo_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
  photos TEXT NOT NULL DEFAULT '[]',        -- file ids
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  listed INTEGER NOT NULL DEFAULT 1,        -- shown to other members in the directory
  member_since INTEGER,
  dues_paid_until TEXT,                     -- YYYY-MM-DD
  dues_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX companies_name ON companies (name COLLATE NOCASE);

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  position TEXT,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('member', 'secretariat')),
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  password_hash TEXT,                       -- empty until they set it from the e-mailed link
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX users_company ON users (company_id);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                      -- sha256 of the cookie's token
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  created_at TEXT NOT NULL,
  seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip TEXT,
  ua TEXT
);
CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE tokens (
  id TEXT PRIMARY KEY,                      -- sha256 of the token in the e-mailed link
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('set_password', 'reset_password')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE access_requests (
  id INTEGER PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  name TEXT NOT NULL,
  position TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  note TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE applications (
  id INTEGER PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  category TEXT NOT NULL,
  data TEXT NOT NULL,                       -- every field as sent
  licence_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'accepted', 'declined')),
  note TEXT,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE profile_changes (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  data TEXT NOT NULL,                       -- only the fields that change, with their new values
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  note TEXT,
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  date TEXT NOT NULL,                       -- YYYY-MM-DD, or YYYY-MM when only the month is known
  category TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',            -- a little Markdown (shared/markdown.ts)
  image_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
  image_url TEXT,                           -- a picture that ships with the site (/media/...)
  link_url TEXT,                            -- a post that is a link to an article elsewhere
  featured INTEGER NOT NULL DEFAULT 0,      -- shown under "Featured articles"
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX posts_date ON posts (status, date DESC);

CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  starts_on TEXT,                           -- YYYY-MM-DD; empty while the date is to be announced
  ends_on TEXT,
  time_text TEXT,                           -- "18:30" or "9:00 to 17:00"
  venue TEXT,
  address TEXT,
  map_url TEXT,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  register_url TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE publications (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE,                          -- a short name for its own address, /downloads/<key> (profile, ehl-brochure)
  title TEXT NOT NULL,
  type TEXT NOT NULL,                       -- Profile, Report, Brochure, Journal, Guide, Presentation
  year INTEGER,
  access TEXT NOT NULL DEFAULT 'public' CHECK (access IN ('public', 'members')),
  summary TEXT NOT NULL DEFAULT '',
  file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
  link_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE notices (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'general' CHECK (kind IN ('circular', 'policy', 'meeting', 'general')),
  body TEXT NOT NULL DEFAULT '',
  file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
  published_on TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE opportunities (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('buyer', 'fair', 'training', 'tender', 'other')),
  body TEXT NOT NULL DEFAULT '',
  deadline TEXT,
  link_url TEXT,
  file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
  published_on TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE inquiries (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,                 -- the reference the sender is given
  kind TEXT NOT NULL,                       -- general, buyer, investor, aalf, media, appointment
  team TEXT NOT NULL,
  name TEXT,
  email TEXT,
  organization TEXT,
  subject TEXT,
  data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'open', 'done', 'spam')),
  note TEXT,
  handled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  handled_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX inquiries_status ON inquiries (status, created_at DESC);

CREATE TABLE subscribers (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  interests TEXT NOT NULL DEFAULT '[]',
  token TEXT NOT NULL,                      -- for the unsubscribe link
  created_at TEXT NOT NULL,
  unsubscribed_at TEXT
);

CREATE TABLE audit (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  subject TEXT,
  subject_id INTEGER,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE throttle (
  key TEXT NOT NULL,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (key, window)
);

CREATE TABLE pow_used (
  id TEXT PRIMARY KEY,
  expires INTEGER NOT NULL
);

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`,
  },
]
