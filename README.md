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
  above layer; the goods), the Members page's application (a member's card in dark leather, the lockup stamped in amber foil),
  the News head (close on the tote's handle) and the 404 (one boot, its pair walked off). On the home page and on
  Programs, the tote and the boot can be turned in 3D (`components/Stage3D.astro`): three.js and the model load only
  as the stage comes near; until then, without 3D, or on a connection that asks to save data, the stage shows the
  piece's picture, rendered in Blender from the same camera.
- **Leather, in a few places** (Blender, `tools/leather/`): real hide as the surface of the footer's strap, the
  saddle-brown sections and a few tan panels, with words set into it as text: the footer line pressed in, the fair's
  dates in amber foil, the Ethiopian Highland Leather mark branded into tan leather, the certified producers as ink
  stamps, the President's message printed on a stitched panel (`styles/leather.css`, `components/LeatherDefs.astro`).
- **In ELIA's brand** (the brand guide ELIA sent, October 2026): the dark sections are the brand brown, the light
  ones the guide's cream, amber the light in the dark; sections slide in like sheets, cards sit like panels; titles
  in Roboto at a condensed width, the word that carries the light in Roboto's light italic; Ge'ez beside the titles.

Brand colours (with the tints the guide shows, as CSS variables in `styles/global.css`): main `#E2A025` (amber),
main second `#7A6762` (taupe), secondary `#3C1E16` (brown), on `#FFFCF5`. Amber is not used for text on the cream
(it would not read); there, small accents are taupe. Type: Roboto (the brand face) for everything, Noto Sans Ethiopic
for Ge'ez, both self-hosted. The full lockup (logo with the name in Amharic and English, as in the guide) is in
`web/public/media/brand/`: `elia-lockup.svg` for light backgrounds, `-reverse` for dark ones, each also `-stacked`.

## Run it

Needs Node 22.13 or later (the database is Node's own SQLite).

```bash
npm install
npm run dev        # the server on http://localhost:4000, the pages on http://localhost:5173 (the API is proxied)
```

Production:

```bash
npm run build      # web → web/dist (the pages), server → server/dist (one file, nothing to install with it)
npm start          # one process on $PORT (default 4000): the pages, their live parts, the API, the old addresses (301s)
```

`npm run typecheck` checks both halves; `node server/test/smoke.mjs http://127.0.0.1:4000 <data folder>` walks the
forms, the members' area, the back office and the guards against a running server (start it on an empty data folder).

## Where things live

| Path | What |
|---|---|
| `web/src/copy/*.ts` | **All page copy**, from the content document ELIA sent (and the current site, typos fixed) |
| `web/src/pages/` | The pages: `/` `/about` `/industry` `/members` `/programs` `/invest` `/ehl` `/eldsc` `/aalf` `/news` `/contact`, the members' area (`members/`), the back office (`admin`), the 404, and the templates the server fills for each news post and event (`templates/`) |
| `web/src/app/` | The members' area and the back office (Preact): sign-in, the directory, a company's page, the dashboard, `admin/` |
| `web/src/components/` | Header, footer, the films, the home story (`Story.astro`), the 3D stage, the forms, the leather (`LeatherDefs.astro`, `Seals.astro`) |
| `web/src/scripts/` | `site.ts` (menu, reveals, counters, the forms), `film.ts`, `story.ts` |
| `web/src/styles/` | `global.css` (type, colour, sections), `forms.css`, `cms.css` (news, events, publications), `app.css` (members' area, back office), `leather.css` |
| `web/public/film/`, `web/public/media/` | The films and posters; photos and logos as WebP, large ones with smaller copies (`name-480.webp`, `-720`, `-960`, `-1280`; `tools/media_variants.py` makes them); `media/leather/` the hides |
| `server/src/` | Express: the pages and their live parts (`pages.ts`), the API (`routes/`), sessions, files, e-mail, the database (`db.ts`, `migrations.ts`) |
| `server/data/` | What a new database starts with: the member companies (`members.json`), news, events and publications (`seed/`, with the profile PDF). After the first start they live in the database and are managed in the back office |
| `shared/` | What the pages and the server both use: the lists (categories, regions…), the HTML of cards and rows, the Markdown |
| `hosting/` | The package and the script that put the site online as a Node.js app on cPanel (below) |
| `tools/` | `studio/` and `leather/` (Blender scripts), `encode_film.sh`, `media_variants.py` |
| `blender/` | *(not in this repository; kept on the workstation)* The Blender scenes, scripts and renders behind the films |

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

Measured with Lighthouse: 97 to 100 on a phone (slow 4G, mid-range phone) on the inner pages, about 80 on the home
page with its film, and 99 to 100 on a desktop. Accessibility, best practices and SEO score 100. What keeps it fast:

- The styles are written into each page, so no stylesheet request delays the first paint.
- The Ge'ez font carries only the letters in use (`web/scripts/fonts.mjs`). New Amharic text is picked up at the
  next build.
- Photos come in several sizes and each screen downloads the one it needs (`srcset`; see `web/src/lib/media.ts`).
- Each film poster is a picture under the video, so a phone downloads only the tall poster.
- The leather and the 3D stage load only as their place comes near.

## Forms, the members' area and the back office

What the forms bring in is kept in the database (the back office's Inbox, Applications and Access requests) and
e-mailed to the team it is for (`NOTIFY_TO`, `TEAM_*` in the settings below); the sender gets a short confirmation
with a reference that repeats nothing they typed. Every form has a hidden field for bots, a small puzzle the
browser solves while the person types (no picture to read), and limits per visitor and for the whole site.

Member companies' people ask for access (`/members/request-access`); the Secretariat approves them in the back office
(`/admin`), which e-mails them a link to set their password (up to three people a company). The back office also
manages the member companies, the news, events and publications on the site, and what members see: notices,
documents and opportunities. Nobody, the Secretariat included, ever sees or sends a password.

In development nothing is sent: e-mails are written to the data folder's `outbox/`.

## Online for now: elia.allafricanleatherfair.org

Until ELIA has hosting of its own, the site runs as a Node.js app on the AALF site's hosting (Yegara, cPanel account
`allafrpp`), kept out of search engines.

1. Here (in this repository), after the changes are committed and **pushed** (the server takes the films and photos
   from GitHub at that version):

   ```bash
   node hosting/bundle.mjs        # -> hosting/out/elia-app-<version>.tar.gz (a few MB) and deploy-elia.sh
   ```

2. Put both files in one folder on the computer that has the AALF SSH setup (the `allafrica` host in
   `~/.ssh/config`), open Git Bash there and run `./deploy-elia.sh`. The first time, add the Secretariat's account:
   `./deploy-elia.sh --admin someone@eliaet.com "Their Name"` (the link to set its password is shown at the end and
   e-mailed).

The server takes the films and photos (about 70 MB) from GitHub itself, so they never travel over the deploying
computer's connection. While the repository (`Phili-gidab/eliaet`) is private, the server needs a read-only token
for it: on GitHub, Settings > Developer settings > Personal access tokens > Fine-grained tokens, one for this
repository only with Contents: Read-only. Give it to the server once with `./deploy-elia.sh --github-token` (it asks
for the token without showing it, and keeps it in `~/.elia-github-token`, readable by that account only). When the
token runs out, the deploy stops before changing anything and says so: make a new one and run that again. A public
repository needs no token.

The first run creates the subdomain, makes the Node.js app in cPanel and moves the old static site's files to
`~/backups`. Every run copies the data first (`~/backups/elia-data`, the last five), keeps the version before in
`~/elia-app/.previous`, and checks that the site answers and sees each visitor's own address (where the host does
not give it, the limits count all visitors together: `CLIENT_IP=shared` in the settings).

The data lives outside the web root, in `~/elia-data/elia.allafricanleatherfair.org/`: the database, the uploaded
files, and the settings file `.env` (who receives the forms, the e-mail sender, SMTP if the server's own mail is not
used). After changing `.env`, restart the app (cPanel > Setup Node.js App > Restart). Over SSH, in `~/elia-app`:

```bash
node server/dist/cli.mjs create-admin someone@eliaet.com "Their Name"   # another Secretariat account
node server/dist/cli.mjs send-link someone@eliaet.com                    # a new set-password link
node server/dist/cli.mjs backup ~/backups/elia-data                      # a copy of the database and the files
node server/dist/cli.mjs stats                                           # what is in the database
```

(with the server's Node: `/opt/alt/alt-nodejs22/root/usr/bin/node`, or the version the app uses).

## When the site moves to www.eliaet.com

Build the package for the new address (`node hosting/bundle.mjs https://www.eliaet.com`), set `REMOTE` and
`HOME_DIR` in `deploy-elia.sh` to the new hosting, and take out the search-engine block: drop `NOINDEX: '1'` in
`hosting/bundle.mjs` (it makes robots.txt turn search engines away) and `NOINDEX=1` from the settings file (it adds an
`X-Robots-Tag: noindex` header to every answer).
The data can come along: copy the data folder (or a backup) to the new hosting before the first start.

## To confirm with ELIA before launch

- **Publications**: five of the six have no file yet (Member Market Briefs, the EHL Certification Guidebook, the AALF
  2026 Exhibitor and Sponsorship Guide, the African Leather Journal, the EHL brochure); they show as "Coming soon",
  and "Download the EHL Brochure" on Programs leads to that list. Upload the files in the back office (Publications).
- **Members**: the directory has 15 companies of the 194; add the rest in the back office (one by one, or a
  spreadsheet: Member companies > Import).
- **The President's photo**, the **Board** and the **social media** addresses (`web/src/copy/about.ts`, `site.ts`).
- **The fair's name**: the content document says "All Africa Leather Fair", the logo and the 2025 poster "All African
  Leather Fair". The site follows the document, except where it names the logo and the 14th edition.
- **Amharic** labels and the association's Amharic name: have a native speaker check them.
- **Photography**: new, high-resolution photographs of tanneries, workshops and products would lift the whole site.
