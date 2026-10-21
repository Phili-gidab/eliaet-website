/* new: the pieces on the 3D stage (components/Stage3D.astro). The tote is the one on the table in the home page's
   film (made in Blender, blender/scripts/goods3.py); the boot is the All African Leather Fair's, from its website.
   Their pictures are rendered in Blender from these same views (work: blender/scripts/posters.py). */

export interface StagePiece {
  key: string
  /** the button's name */
  name: string
  /** the GLB under /media/3d */
  model: string
  /** the piece's picture at its starting angle (WebP, with copies for responsive()) */
  poster: string
  alt: string
  /** a line about the piece, under the stage */
  note: string
  /** three.js: vertical field of view (degrees), the camera and the point it looks at (metres, y up, the piece on
      y = 0 with its front to +z), the piece's turn about its upright (degrees) */
  view: { fov: number; cam: [number, number, number]; target: [number, number, number]; turn: number }
}

export const TOTE: StagePiece = {
  key: 'tote',
  name: 'Tote',
  model: '/media/3d/tote.glb',
  poster: '/media/3d/tote.webp',
  alt: 'A tote bag in chestnut calf leather with two rolled handles, tan piping and brass fittings.',
  note: 'A tote in chestnut calf: rolled handles, tan piping, saddle stitching and brass fittings.',
  view: { fov: 24, cam: [0, 0.42, 1.585], target: [0, 0.2, 0], turn: -22 },
}

export const BOOT: StagePiece = {
  key: 'boot',
  name: 'Boot',
  model: '/media/3d/boot.glb',
  poster: '/media/3d/boot.webp',
  alt: 'A brogue boot in tan calf with a dark brown toe, on a welted leather sole with a stacked heel.',
  note: 'A brogue boot on a welted leather sole: tan calf upper, dark toe, stacked leather heel.',
  view: { fov: 24, cam: [0, 0.3, 1.05], target: [0, 0.072, 0], turn: -28 },
}

export const PIECES = [TOTE, BOOT]
