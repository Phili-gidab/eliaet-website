# Leather

The pieces of hide behind a few parts of the site (`web/public/media/leather/`, used by `web/src/styles/leather.css`)
are rendered in Blender 5.2 by `hide_tile.py`: a procedural full-grain hide (pebbled grain, pores, soft folds, the
slow undulation and mottling of a real hide) seen from straight above in a low light from the upper left. Each one is
a square that wraps around at its edges (every pattern is read on a flat torus in four dimensions), so the page
repeats it at one fixed size and the grain is the same size on a small patch as on a whole section.

    blender -b --factory-startup -P tools/leather/hide_tile.py -- tile-chestnut.webp chestnut 2200 3 48
    blender -b --factory-startup -P tools/leather/hide_tile.py -- tile-tan.webp tan 2200 7 48
    blender -b --factory-startup -P tools/leather/hide_tile.py -- tile-saddle.webp saddle 2200 11 48
    python3 tools/leather/to_tile.py tile-chestnut.webp chestnut      # and the same for tan, saddle

The arguments after `--` are the output, the tone (`chestnut`, `saddle` or `tan`), the size in pixels, the seed, the
samples and, optionally, how many metres of leather the square covers (0.24). Each takes about two minutes on a
GTX 1650 Ti (CUDA); the Python module works too (`pip install bpy==5.2.2`, then `python3 hide_tile.py -- ...`) but
slowly on a processor. The render has a 32-pixel margin all round, so the denoiser treats the square's edges like
the rest; `to_tile.py` cuts it off and writes the three sizes.

The words set into the leather are text; `web/src/components/LeatherDefs.astro` holds the SVG filters that give them
their light and shade (pressed in, branded, inked), `leather.css` the foil.

`web/public/media/ehl/ehl-mark.webp`, the mark branded into the tan hide on the EHL page and Programs, is the
Ethiopian Highland Leather logo from ELIA's profile (`ELIA_Profile_Updated.pdf`, page 7): its transparency, 960
pixels wide, in dark brown.
