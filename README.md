# ELIA · Ethiopian Leather Industries Association — website

The redesign of [eliaet.com](https://www.eliaet.com). Static pages built with Astro, served by a small Node (Express)
server that also runs the forms API. Films rendered in Blender.

## The idea

- **Page loader**: the logo draws itself (the amber e sweeps in, its dot drops, the wordmark slides out) in about a
  second, once per visit, on whichever page the visit starts, while the page loads. Drawn from the logo's vectors
  (`components/Loader.astro`); none for people who ask for less motion.
- **The logo film** (Blender): the outline of Ethiopia is drawn and becomes the "e", the sun rises, the wordmark
  follows. It plays at the top of the About page; people who ask for less motion see its last frame.
- **Home: the story film**: one continuous shot of a tannery at work, rendered in Blender in two shapes (16:9 for
  wide screens, 9:16 for phones). Rendered to run 20 s, it plays in about 14: the walk through the works at 1.6 times
  its speed, the way out to the hills at 1.1 (`FAST`, `SLOW` in `scripts/story.ts`). It starts at the turning drums, rises over the machines and the hide conveyor,
  settles on a table of finished goods, then pulls back out of the loading door until the works stand in the
  Ethiopian highlands. The film is the clock for the copy: each chapter's words arrive with their moment in the
  film; the last chapter (the page title and buttons) stays on the final frame. A rail of chapters under it seeks.
- **Words in the film itself**: the drums are stencilled 01 02 03; ቆዳ is painted across the hall floor so that it
  reads true only from where the camera passes; the finished leather carries the ELIA mark in gold foil; the export
  crate is stencilled; the flags fly by the door; and the ELIA mark is grown in yellow Meskel daisies on the far
  hills, laid out so that it comes together exactly as the camera reaches its last position.
- **Pins that ride on the film**: small labels pinned to the machines and the goods (Wringing, Splitting, Hang
  drying, Finishing, Garments, Bags, Finished leather). Where each thing is, frame by frame, comes from the film's
  own cameras (`web/public/film/pins.json`, made with the Blender scripts `track6.py` and `pins6.py`), so the pins
  move with the shot; each keeps off the chapter's words and the other pins, and none show for less motion.
- **Studio pictures and the 3D stage** (Blender): the goods from the film's table (the tote, the field boots, rolls
  of finished leather) and the All African Leather Fair's boot, in a studio of the brand's brown with a warm pool of
  light behind them. They stand in for photos that did not fit: the Programs head and its 194-members section (the
  three sectors: rolls of leather, boots, the tote), the home page's programme cards (the AALF boot taken apart, layer
  above layer; the goods), the Membership head (a member's card in dark leather, the lockup stamped in amber foil),
  the News head (close on the tote's handle) and the 404 (one boot, its pair walked off). On the home page and on
  Programs, the tote and the boot can be turned in 3D (`components/Stage3D.astro`): three.js and the model load only
  as the stage comes near; until then, without 3D, or on a connection that asks to save data, the stage shows the
  piece's picture, rendered in Blender from the same camera.
- **In ELIA's brand** (the brand guide ELIA sent, October 2026): the dark sections are the brand brown, the light
  ones the guide's cream, amber the light in the dark; sections slide in like sheets, cards sit like panels; titles
  in Roboto at a condensed width, the word that carries the light in Roboto's light italic; Ge'ez beside the titles.

Brand colours (with the tints the guide shows, as CSS variables in `styles/global.css`): main `#E2A025` (amber),
main second `#7A6762` (taupe), secondary `#3C1E16` (brown), on `#FFFCF5`. Amber is not used for text on the cream
(it would not read); there, small accents are taupe. Type: Roboto (the brand face) for everything, Noto Sans Ethiopic
for Ge'ez, both self-hosted. The full lockup (logo with the name in Amharic and English, as in the guide) is in
`web/public/media/brand/`: `elia-lockup.svg` for light backgrounds, `-reverse` for dark ones, each also `-stacked`.

## Run it

Needs Node 20+ (22 recommended).

```bash
npm install
npm run dev        # API on http://localhost:4000, site on http://localhost:5173 (forms are proxied to the API)
```

Production:

```bash
npm run build      # web → web/dist (static pages), server → server/dist
npm start          # one process on $PORT (default 4000) serves the pages, the films, the API and the old URLs (301s)
```

## Where things live

| Path | What |
|---|---|
| `web/src/copy/*.ts` | **All page copy.** Carried over from the current site (typos fixed); new copy is marked |
| `web/src/pages/*.astro` | The pages: `/` `/about` `/services` `/programs` `/members` `/ehl` `/eldsc` `/aalf` `/news` `/contact` `/membership` and the 404 |
| `web/src/components/` | Header, footer, the film player, the home story film (`Story.astro`), the intro, the forms |
| `web/src/scripts/` | `site.ts` (menu, reveals, counters, forms), `film.ts` (picks the right film), `story.ts` (the home film's copy in step), the member directory |
| `web/src/styles/` | `global.css` (type, colour, sections), `forms.css` |
| `web/public/film/` | The films and their posters (copied from `blender/film/`) |
| `web/public/media/` | Photos and logos from the current site, as WebP; `fair/` holds four photos from the AALF website. Large photos have smaller copies next to them (`name-480.webp`, `-720`, `-960`, `-1280`) |
| `web/public/media/studio/` | The studio pictures (Blender); `web/public/media/3d/` the 3D stage's models (GLB, meshopt and WebP) and their pictures |
| `tools/studio/` | The Blender scripts behind them: the studio (`studio.py`), the shots (`shots.py`, `card.py`), the stage's pictures (`posters.py`), the tote's bake and export (`export_tote.py`, then `pack.mjs`) |
| `tools/media_variants.py` | Makes those smaller copies. **Run it after adding or replacing a large photo** (`python tools/media_variants.py`, needs Pillow); the pages pick the copies up by name |
| `web/scripts/fonts.mjs` | Runs before every build: cuts Noto Sans Ethiopic down to the Ge'ez letters the site uses (15 kB instead of 200 kB) |
| `server/data/members.json` | The member directory. **The pages are built from it**: after editing, run `npm run build` again |
| `server/data/news.json` | News posts and events (same: rebuild after editing) |
| `server/src/` | Express: serves `web/dist`, forms API (zod-validated, rate-limited, honeypot), legacy redirects |
| `hosting/` | For now: the package and the script that put the site on a subdomain of the AALF hosting (PHP forms in `hosting/api/`, Apache rules) |
| `blender/` | *(not in this repository; kept on the workstation)* The Blender scenes, scripts and renders behind the films |
| `client/` | *(not in this repository)* The previous React version, no longer built |

### The films

Each film comes in several codecs (AV1, VP9 and H.264; the logo film also HEVC) at two sizes; the page picks the best one the browser plays and the size
the screen needs, plays it only while it is on screen, and falls back to the next rendition if one fails to load.
To replace a film, encode the new frames with `tools/encode_film.sh` into `blender/film/`, copy the files to
`web/public/film/`, and rebuild.
The home film (`tannery-*`, 20 s, 25 fps) was rendered at 1600×900 and 720×1280; its frames were checked one by one for
graphics-driver glitches before encoding, and its VP9 renditions were made with ffmpeg (libvpx-vp9, two passes)
because Blender's own VP9 output showed colour smears.

### The 3D stage

`components/Stage3D.astro` shows one piece at a time, chosen with the buttons under it (`copy/stage.ts` lists the
pieces: the model, its picture, its camera). The models live in `web/public/media/3d/`: the tote (from the film; its
procedural leather baked to a 2048 atlas of colour, roughness, ambient occlusion and the grain as a normal map) and
the AALF boot (its animation's last pose, the finished boot). Both are meshopt-compressed with WebP textures; the
page loads three.js (about 180 kB compressed) and a model only when the stage is near. The pictures are rendered with
the same camera (`tools/studio/posters.py`), on a transparent film with only the piece's shadow, so the page's cream
shows through as it does around the model. To change a piece's camera, change it in both `copy/stage.ts` and
`posters.py`, render the picture again and rebuild.

## Speed

Measured with Lighthouse on every page: 100 on a desktop and about 93 to 97 on a phone (slow 4G, mid-range phone).
Accessibility, best practices and SEO score 100. What keeps it fast:

- The styles are written into each page, so no stylesheet request delays the first paint.
- The Ge'ez font carries only the letters in use (`web/scripts/fonts.mjs`). New Amharic text is picked up at the
  next build.
- Photos come in several sizes and each screen downloads the one it needs (`srcset`; see `web/src/lib/media.ts`).
- Each film poster is a picture under the video, so a phone downloads only the tall poster. The intro's poster is
  downloaded only if the film cannot play.
- The top of each inner page starts its entrance as soon as it is painted, without waiting for the script.

## Forms and e-mail

Contact, appointment, newsletter and membership forms post to the API. Every submission is written to
`server/inbox/<form>.jsonl` (membership stamps to `server/inbox/stamps/`), so nothing is lost even without e-mail.
To also e-mail the secretariat, copy `server/.env.example` to `server/.env` and fill in the SMTP settings.

## Online for now: elia.allafricanleatherfair.org

Until ELIA has hosting of its own, the site lives on a subdomain of the AALF site's hosting (Yegara, cPanel account
`allafrpp`), kept out of search engines. That account runs PHP rather than Node, so the forms are answered by small
PHP files (`hosting/api/`) that check and answer exactly like the Node server.

1. Here (in this repository), after the changes are committed and pushed:

   ```bash
   node hosting/bundle.mjs        # -> hosting/out/elia-site-<version>.tar.gz (under 1 MB) and deploy-elia.sh
   ```

2. Put both files in one folder on the computer that has the AALF SSH setup (the `allafrica` host in
   `~/.ssh/config`), open Git Bash there and run `./deploy-elia.sh`.

The first run creates the subdomain and asks for its certificate. The server downloads the films and photos itself,
from this repository on GitHub at the same version, so only the small package travels over the computer's
connection. Every run backs up the subdomain's folder first (`~/backups`, the last three) and deletes nothing.

What people send through the forms is kept on the server outside the web root, in
`~/elia-data/elia.allafricanleatherfair.org/` (`contact.csv`, `appointments.csv`, `subscribers.csv`,
`membership.csv` and the stamps in `stamps/`; they open in Excel via cPanel > File Manager), and is e-mailed to
the address in `hosting/api/_config.php` (`info@eliaet.com`).

When the site moves to its own address, either set it up with Node as below, or use the same PHP package built for
the new address (`node hosting/bundle.mjs https://www.eliaet.com`) with the search-engine block taken out: drop
`NOINDEX: '1'` in `hosting/bundle.mjs` and the `X-Robots-Tag` line in `hosting/htaccess-elia.conf`.

## Deploying on cPanel

1. Upload the project folder (everything except `node_modules/`) to the server, e.g. `~/eliaet`.
2. cPanel → **Setup Node.js App** → *Create application*: Node.js 20 or newer, application root `eliaet`,
   application URL your domain, startup file `server/dist/index.js`, and an environment variable
   `NODE_ENV=production`.
3. Over SSH, enter the app's environment (cPanel shows the exact `source …/activate` command at the top of the app
   page), then in the app root:

   ```bash
   npm ci
   npm run build
   ```

4. **Restart** the app in cPanel. Check `https://your-domain/` and a page such as `/members`.

`web/dist` and `server/dist` are already built in this folder, so step 3 can be skipped for a first try if the
upload includes them (then run *Run NPM Install* in the cPanel app page instead).

The server sends a strict Content-Security-Policy. The few small inline scripts in the pages are allowed by their
hashes, which the server reads from `web/dist` when it starts, so **restart the app after every rebuild**.

## To confirm with ELIA before launch

- **191 or 194?** The old About text said "more than 191" manufacturers; the counters and the size table say 194.
  The About text now says 194 to match. Please confirm.
- **AALF**: the old site mentions both the "12th" and the "14th" edition (at Millennium Hall); the 2026 fair
  (15th edition, 12–15 November, Addis International Convention Center, with the 12th ASFW Addis) comes from the
  AALF 2026 website.
- **Secretary General**: the old About page has a hidden entry for *Mr. Endale Seyfu, Secretary General & Project
  Coordinator*; the visible one is *Mr. Dagnachew Abebe*. The redesign shows the visible one.
- **Membership form, employees "M / F / P / T"**: shown as Male / Female / Permanent / Temporary. Please confirm.
- **Amharic** labels and the association's Amharic name: have a native speaker check them.
- **Social media**: the old site shows icons with no links. Add the real addresses in `web/src/copy/site.ts`.
- **Member directory**: 14 companies have a public listing (the old site's list). Add the rest in
  `server/data/members.json`, then rebuild.
- **Photography**: the photos are the current site's, except four from the AALF website (taken at ASFW Addis 2025,
  AICC): the AALF card on Programs, two news cards and the Services band. New, high-resolution photography of
  tanneries, workshops and products would lift the whole site.
