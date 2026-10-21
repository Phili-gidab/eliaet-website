# The studio

The studio pictures in `web/public/media/studio/` and the 3D stage's models and pictures in `web/public/media/3d/`
were made with these scripts, in Blender 5.2 (or its Python module, `pip install bpy==5.2.2`, Python 3.13).

They build on the hero film's own scripts (`blender/scripts/` on the workstation: `elia_lib.py`, `mat3.py`,
`prod3.py`, `goods3.py`), which make the tote, the rolls, the wallet and their leathers; set `ELIA_SCRIPTS` to that
folder. `ELIA_ROOT` (default `./root`) holds what they read:

- `assets/polyhaven/` the leather grain maps (`leather_red_03`, `leather_white`, `brown_leather`, `fabric_leather_02`)
  and `hdri/qwantani_morning_1k.hdr`, as in `blender/assets`;
- `assets/fieldboot/` the field boots (`Format2.obj` and their maps, as JPEGs: `FieldBoot_BaseColor.jpg`, ...);
- `fonts/Roboto-SemiBold.ttf` (a static instance of Roboto, for the card's MEMBER);
- `lockup_stacked_flat.svg` (`python3 flatten_svg.py web/public/media/brand/elia-lockup-stacked.svg root/lockup_stacked_flat.svg`).

The AALF boot comes from the AALF website (`assets/models/boot.glb`): `node decode.mjs boot.glb models/aalf_boot_plain.glb`
makes the copy Blender can open.

| Run | Makes |
|---|---|
| `python3 shots.py head final` (and `styles`, `aalf`, `sectors`, `lone`, `detail`) | `out/<shot>.png` and `.exr` |
| `python3 card.py final` | the member's card, `out/card.png` |
| `python3 posters.py tote final`, `posters.py boot final` | the 3D stage's pictures, `out/s3d_<piece>.png` |
| `python3 export_tote.py 2048` then `node pack.mjs tote models/tote_raw.glb models/tote_ao.png models/tote.glb 1024` | the tote's model |
| `node pack.mjs boot <aalf boot.glb> models/boot.glb` | the boot's model (its last pose, no camera) |
| `python3 to_web.py` | copies all of them into `web/public/media` as WebP; then `python tools/media_variants.py` |

`grade.py` saves an `.exr` render again with another look or exposure (AgX), without rendering it again.
