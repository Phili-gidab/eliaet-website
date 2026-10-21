"""Leather for the site's backgrounds, as a seamless tile: a square of full-grain hide seen from straight above in a
low raking light (pebbled grain, pores, soft folds, the slow undulation of a real hide). The square wraps around at
its edges, so a page repeats it at one fixed size and the grain is the same size everywhere, on a small panel or a
whole section. Procedural (every pattern is read on a torus in four dimensions, which is what makes it wrap).

    blender -b --factory-startup -P hide_tile.py -- <out.webp|png> <tone: chestnut|saddle|tan> [px] [seed] [spp] [tile_m]
"""
import sys, math
import bpy

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
OUT = argv[0]
TONE = argv[1] if len(argv) > 1 else 'chestnut'
PX = int(argv[2]) if len(argv) > 2 else 2200
SEED = float(argv[3]) if len(argv) > 3 else 3.0
SPP = int(argv[4]) if len(argv) > 4 else 48
TILE = float(argv[5]) if len(argv) > 5 else 0.24          # metres of leather across the square


def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


TONES = {
    # base, groove (darker), mottle (lighter patches), fold (darker)
    'chestnut': ('#4b2a1e', '#2a140d', '#5e3424', '#26120b'),
    'saddle': ('#6a3d22', '#3e2213', '#7f4b2a', '#341b0e'),
    'tan': ('#bf8a55', '#956335', '#d09c66', '#87572d'),
}
# a dyed, milled hide is pebbled; natural vegetable-tanned leather (the one that takes a brand) is smooth, its grain
# fine and shallow, with a little more sheen
FINISH = {
    'chestnut': dict(relief=1.0, cells=300.0, folds=0.45, rough=(0.56, 0.8), spec=0.36),
    'saddle': dict(relief=0.8, cells=300.0, folds=0.4, rough=(0.56, 0.8), spec=0.36),
    'tan': dict(relief=0.38, cells=430.0, folds=0.22, rough=(0.46, 0.72), spec=0.42),
}[TONE]
base, groove, mottle, fold = (lin(c) for c in TONES[TONE])

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
try:                                                    # the GPU, when the machine has one Cycles can use
    cp = bpy.context.preferences.addons['cycles'].preferences
    for t in ('CUDA', 'OPTIX', 'HIP', 'METAL', 'ONEAPI'):      # CUDA first: OptiX fails on some GTX cards
        try:
            cp.compute_device_type = t
            cp.get_devices()
        except Exception:
            continue
        gpus = [d for d in cp.devices if d.type == t]
        if gpus:
            for d in cp.devices:
                d.use = d.type == t
            sc.cycles.device = 'GPU'
            print('rendering on', t, [d.name for d in gpus])
            break
except Exception as e:
    print('GPU setup:', e)
sc.cycles.samples = SPP
sc.cycles.use_adaptive_sampling = True
sc.cycles.use_denoising = True
sc.cycles.max_bounces = 4
sc.view_settings.view_transform = 'Standard'
sc.view_settings.look = 'None'
sc.view_settings.exposure = 0.0
sc.render.resolution_x = sc.render.resolution_y = PX
sc.render.resolution_percentage = 100
if OUT.lower().endswith('.webp'):
    sc.render.image_settings.file_format = 'WEBP'
    sc.render.image_settings.quality = 92
    sc.render.image_settings.color_mode = 'RGB'
else:
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_depth = '8'
sc.render.filepath = OUT

# the picture is rendered with a margin of BORDER pixels all round (the pattern simply carries on past the square), so
# the denoiser treats the square's edges like any other part; the margin is cut off afterwards (to_tile.py)
BORDER = 32
K = 1 + 2 * BORDER / PX
sc.render.resolution_x = sc.render.resolution_y = PX + 2 * BORDER
bpy.ops.mesh.primitive_plane_add(size=1)
plane = bpy.context.object
plane.scale = (TILE * K, TILE * K, 1)
bpy.ops.object.transform_apply(scale=True)                 # object units in metres
for d in plane.data.uv_layers.active.data:                 # the square's UVs run 0..1, the margin's beyond
    d.uv = (d.uv[0] * K - BORDER / PX, d.uv[1] * K - BORDER / PX)

m = bpy.data.materials.new('Hide')
m.use_nodes = True
nt = m.node_tree
N, L = nt.nodes, nt.links
for n in list(N):
    N.remove(n)


def node(t, **kw):
    n = N.new(t)
    for k, v in kw.items():
        if k.startswith('in_'):
            n.inputs[k[3:].replace('_', ' ')].default_value = v
        else:
            setattr(n, k, v)
    return n


def math_(op, a=None, b=None, va=None, vb=None, clamp=False):
    n = node('ShaderNodeMath', operation=op, use_clamp=clamp)
    if a is not None: L.new(a, n.inputs[0])
    elif va is not None: n.inputs[0].default_value = va
    if b is not None: L.new(b, n.inputs[1])
    elif vb is not None: n.inputs[1].default_value = vb
    return n.outputs[0]


def maprange(x, a, b, c=0.0, d=1.0, interp='LINEAR'):
    n = node('ShaderNodeMapRange', interpolation_type=interp, clamp=True)
    L.new(x, n.inputs['Value'])
    n.inputs['From Min'].default_value = a
    n.inputs['From Max'].default_value = b
    n.inputs['To Min'].default_value = c
    n.inputs['To Max'].default_value = d
    return n.outputs['Result']


out = node('ShaderNodeOutputMaterial')
bsdf = node('ShaderNodeBsdfPrincipled')
L.new(bsdf.outputs[0], out.inputs[0])

# ── the square on a torus: (u, v) → (R cos 2πu, R sin 2πu, R cos 2πv, R sin 2πv). This torus is flat (distances
# along it are distances on the square), so the patterns keep their shapes and sizes, and meet themselves at the edges.
R = TILE / (2 * math.pi)
uv = node('ShaderNodeTexCoord').outputs['UV']
sep = node('ShaderNodeSeparateXYZ')
L.new(uv, sep.inputs[0])
au = math_('MULTIPLY', sep.outputs['X'], vb=2 * math.pi)
av = math_('MULTIPLY', sep.outputs['Y'], vb=2 * math.pi)
tx = math_('MULTIPLY', math_('COSINE', au), vb=R)
ty = math_('MULTIPLY', math_('SINE', au), vb=R)
tz = math_('MULTIPLY', math_('COSINE', av), vb=R)
tw = math_('MULTIPLY', math_('SINE', av), vb=R)
xyz = node('ShaderNodeCombineXYZ')
L.new(tx, xyz.inputs[0]); L.new(ty, xyz.inputs[1]); L.new(tz, xyz.inputs[2])
P3, P4 = xyz.outputs[0], tw                                 # the point: three coordinates and a fourth


def shifted(p3, p4, k):
    """the same point, moved to another part of the pattern's space (each pattern its own, from the seed)"""
    s = SEED * 0.37 + k * 0.731                          # small numbers: the finest patterns lose precision far out
    a = node('ShaderNodeVectorMath', operation='ADD')
    L.new(p3, a.inputs[0])
    a.inputs[1].default_value = (s, s * 0.61 + 0.31, s * 0.27 - 0.77)
    return a.outputs[0], math_('ADD', p4, vb=s * 0.83 + 0.19)


def tex(kind, p, k, **kw):
    v3, v4 = shifted(p[0], p[1], k)
    n = node(kind, **kw)
    L.new(v3, n.inputs['Vector'])
    L.new(v4, n.inputs['W'])
    return n


# a slight warp of the whole surface, so the grain never repeats a pattern of cells exactly
w1 = tex('ShaderNodeTexNoise', (P3, P4), 1, noise_dimensions='4D', in_Scale=30.0, in_Detail=3.0)
w2 = tex('ShaderNodeTexNoise', (P3, P4), 2, noise_dimensions='4D', in_Scale=30.0, in_Detail=3.0)
off3 = node('ShaderNodeVectorMath', operation='MULTIPLY_ADD')
L.new(w1.outputs['Color'], off3.inputs[0])
off3.inputs[1].default_value = (0.004, 0.004, 0.004)
L.new(P3, off3.inputs[2])
off3b = node('ShaderNodeVectorMath', operation='SUBTRACT')        # centre the warp on zero
L.new(off3.outputs[0], off3b.inputs[0])
off3b.inputs[1].default_value = (0.002, 0.002, 0.002)
W3 = off3b.outputs[0]
W4 = math_('ADD', P4, math_('MULTIPLY', math_('SUBTRACT', w2.outputs['Fac'], vb=0.5), vb=0.004))
WP = (W3, W4)
P = (P3, P4)

# pebbled grain: cells a few millimetres across, a groove between them
cells = FINISH['cells']
grain = tex('ShaderNodeTexVoronoi', WP, 3, voronoi_dimensions='4D', feature='DISTANCE_TO_EDGE', in_Scale=cells, in_Randomness=0.95)
groove_f = maprange(grain.outputs['Distance'], 0.0, 0.16, 1.0, 0.0, 'SMOOTHSTEP')            # 1 in the groove
# the same cells as rounded domes (the distance to each cell's centre), not facets
dome = tex('ShaderNodeTexVoronoi', WP, 3, voronoi_dimensions='4D', feature='F1', in_Scale=cells, in_Randomness=0.95)
pebble = maprange(dome.outputs['Distance'], 0.0, 0.62, 1.0, 0.0, 'SMOOTHERSTEP')
# finer, flatter cells inside them
fine = tex('ShaderNodeTexVoronoi', WP, 4, voronoi_dimensions='4D', feature='DISTANCE_TO_EDGE', in_Scale=cells * 2.55, in_Randomness=1.0)
fine_g = maprange(fine.outputs['Distance'], 0.0, 0.12, 1.0, 0.0, 'SMOOTHSTEP')

# pores: tiny pits, thicker in some places than others
pores = tex('ShaderNodeTexVoronoi', P, 5, voronoi_dimensions='4D', feature='F1', in_Scale=1500.0, in_Randomness=1.0)
pit = maprange(pores.outputs['Distance'], 0.0, 0.16, 1.0, 0.0, 'SMOOTHSTEP')
pm = tex('ShaderNodeTexNoise', P, 6, noise_dimensions='4D', in_Scale=40.0, in_Detail=2.0)
pit = math_('MULTIPLY', pit, maprange(pm.outputs['Fac'], 0.45, 0.7))

# soft folds: long wandering lines (where a slowly varying field crosses one level), each a rounded trough, coming
# and going along their length
folds = []
for i, (scale, level, width, wt) in enumerate([(9.0, 0.5, 0.035, 1.0), (14.0, 0.47, 0.03, 0.7)]):
    f = tex('ShaderNodeTexNoise', P, 7 + i, noise_dimensions='4D', in_Scale=scale, in_Detail=2.5, in_Roughness=0.5, in_Distortion=0.3)
    d = math_('ABSOLUTE', math_('SUBTRACT', f.outputs['Fac'], vb=level))
    trough = maprange(d, 0.0, width, 1.0, 0.0, 'SMOOTHERSTEP')
    mk = tex('ShaderNodeTexNoise', P, 9 + i, noise_dimensions='4D', in_Scale=12.0, in_Detail=2.0)
    mask = maprange(mk.outputs['Fac'], 0.48, 0.64)
    folds.append(math_('MULTIPLY', math_('MULTIPLY', trough, mask), vb=wt))
fold_f = math_('MAXIMUM', folds[0], folds[1])

# the slow undulation of the hide
und = tex('ShaderNodeTexNoise', P, 11, noise_dimensions='4D', in_Scale=7.0, in_Detail=4.0, in_Roughness=0.55)

# height: domed pebbles, minus grooves, pits and folds, on the undulation
RL = FINISH['relief']
h = math_('MULTIPLY', pebble, vb=0.5 * RL)
h = math_('SUBTRACT', h, math_('MULTIPLY', groove_f, vb=0.18 * RL))
h = math_('SUBTRACT', h, math_('MULTIPLY', fine_g, vb=0.05))
h = math_('SUBTRACT', h, math_('MULTIPLY', pit, vb=0.25))
h = math_('SUBTRACT', h, math_('MULTIPLY', fold_f, vb=FINISH['folds']))
h = math_('ADD', h, math_('MULTIPLY', und.outputs['Fac'], vb=0.6))
bump = node('ShaderNodeBump', in_Strength=0.6, in_Distance=0.001)
L.new(h, bump.inputs['Height'])
L.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

# colour: the base with lighter mottling, darker in the grooves and folds (where the finish gathers)
mn = tex('ShaderNodeTexNoise', P, 12, noise_dimensions='4D', in_Scale=13.0, in_Detail=5.0, in_Roughness=0.6)
mot = maprange(mn.outputs['Fac'], 0.35, 0.75)
c1 = node('ShaderNodeMix', data_type='RGBA', blend_type='MIX')
L.new(mot, c1.inputs['Factor'])
c1.inputs['A'].default_value = base
c1.inputs['B'].default_value = mottle
c2 = node('ShaderNodeMix', data_type='RGBA', blend_type='MIX')
L.new(math_('MULTIPLY', groove_f, vb=0.65 * max(RL, 0.5)), c2.inputs['Factor'])
L.new(c1.outputs['Result'], c2.inputs['A'])
c2.inputs['B'].default_value = groove
c3 = node('ShaderNodeMix', data_type='RGBA', blend_type='MIX')
L.new(math_('MULTIPLY', fold_f, vb=0.32), c3.inputs['Factor'])
L.new(c2.outputs['Result'], c3.inputs['A'])
c3.inputs['B'].default_value = fold
L.new(c3.outputs['Result'], bsdf.inputs['Base Color'])

# a waxy finish: rougher in the grooves
rough = node('ShaderNodeMapRange', clamp=True)
L.new(groove_f, rough.inputs['Value'])
rough.inputs['To Min'].default_value = FINISH['rough'][0]
rough.inputs['To Max'].default_value = FINISH['rough'][1]
L.new(rough.outputs['Result'], bsdf.inputs['Roughness'])
bsdf.inputs['Specular IOR Level'].default_value = FINISH['spec']
plane.data.materials.append(m)

# the light: a low sun from the upper left, as the page's own light falls, and a little warm light from the sky.
# A sun lights every point alike, so the light itself does not break the wrap.
sun = bpy.data.lights.new('Sun', 'SUN')
sun.energy = 3.4
sun.angle = math.radians(4)
so = bpy.data.objects.new('Sun', sun)
sc.collection.objects.link(so)
so.rotation_euler = (math.radians(66), 0, math.radians(-135))     # 24° above the surface, from the upper left
w = bpy.data.worlds.new('W')
sc.world = w
w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.95, 0.86, 0.74, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.22

cam = bpy.data.cameras.new('Cam')
cam.type = 'ORTHO'
cam.ortho_scale = TILE * K
co_ = bpy.data.objects.new('Cam', cam)
sc.collection.objects.link(co_)
co_.location = (0, 0, 1)
sc.camera = co_

bpy.ops.render.render(write_still=True)
print('wrote', OUT)
