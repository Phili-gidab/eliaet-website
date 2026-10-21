"""ELIA product studio: the leather goods from the hero film (blender3/goods3.py, the film's own materials), the field
boots and the AALF boot, on a photographic stage in the brand's light. Runs in the bpy module (cloud) or in Blender.

    import studio as S
    S.new_scene(); M = S.materials(); ...
"""
import os, sys, math, glob
HERE = os.path.dirname(os.path.abspath(__file__))
# the hero film's scripts (goods3, prod3, mat3, elia_lib): ELIA_SCRIPTS, by default the workstation's
SCRIPTS = os.environ.get('ELIA_SCRIPTS', r'C:\Users\ASUS\Desktop\Eliaet\blender\scripts')
sys.path.insert(0, SCRIPTS)
os.environ.setdefault('ELIA_ROOT', os.path.join(HERE, 'root'))
import bpy
from mathutils import Vector, Matrix, Euler
import elia_lib as E, mat3 as MT, goods3 as G

ROOT = os.environ['ELIA_ROOT']
HDRI = os.path.join(ROOT, 'assets', 'polyhaven', 'hdri')


def srgb(h):
    """'#3c1e16' -> linear RGB"""
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


BRAND = {k: srgb(v) for k, v in {
    'amber': '#e2a025', 'amber60': '#ecc06e', 'amber20': '#faefdb', 'taupe': '#7a6762', 'brown': '#3c1e16',
    'brown80': '#5d443d', 'page': '#fffcf5', 'bone': '#d3cccb'}.items()}


# ------------------------------------------------------------------------------------------------ scene
def new_scene(engine='CYCLES'):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = engine
    sc.unit_settings.system = 'METRIC'
    cy = sc.cycles
    cy.device = 'CPU'
    cy.samples = 128
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.02
    cy.use_denoising = True
    try:
        cy.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    cy.max_bounces = 8; cy.diffuse_bounces = 3; cy.glossy_bounces = 4; cy.transmission_bounces = 4
    cy.transparent_max_bounces = 8; cy.caustics_reflective = False; cy.caustics_refractive = False
    cy.sample_clamp_indirect = 6.0
    try:
        cy.use_light_tree = True
    except Exception:
        pass
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Punchy'
    sc.view_settings.exposure = -0.6
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_depth = '16'
    sc.render.use_persistent_data = True
    world(0.35)
    return sc


def world(strength=0.35, hdri='qwantani_morning_1k.hdr', rot=0.0, tint=(1, 1, 1), clamp=None):
    """the HDRI for reflections and a little ambient light; clamp caps its brightest pixels (the sun), so it casts
    no hard shadow of its own"""
    w = bpy.data.worlds.get('Studio') or bpy.data.worlds.new('Studio')
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = strength
    path = os.path.join(HDRI, hdri)
    if os.path.exists(path):
        tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Rotation'].default_value = (0, 0, math.radians(rot))
        env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(path, check_existing=True)
        nt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], env.inputs['Vector'])
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'
        mx.inputs['Factor'].default_value = 1.0
        col = env.outputs['Color']
        if clamp:
            sep = nt.nodes.new('ShaderNodeSeparateColor'); com = nt.nodes.new('ShaderNodeCombineColor')
            nt.links.new(col, sep.inputs['Color'])
            for k in ('Red', 'Green', 'Blue'):
                m = nt.nodes.new('ShaderNodeMath'); m.operation = 'MINIMUM'; m.inputs[1].default_value = clamp
                nt.links.new(sep.outputs[k], m.inputs[0]); nt.links.new(m.outputs[0], com.inputs[k])
            col = com.outputs['Color']
        nt.links.new(col, mx.inputs[6]); mx.inputs[7].default_value = (*tint, 1)
        nt.links.new(mx.outputs[2], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    return w


def coll(name):
    return E.ensure_coll(name)


# ------------------------------------------------------------------------------------------------ materials
def materials():
    """the hero film's leathers (hero_v3.materials, with film6.goods' last pass: worn creases, waxed coats)"""
    M = {}
    M['tote'] = MT.leather('M3_ToteCalf', (0.078, 0.029, 0.016), var=0.11, rough=(0.24, 0.42), coat=0.38, coat_rough=0.11,
                           grain='calf', grain_str=0.6, rough_var=0.14, pullup=(0.15, 0.06, 0.032), pullup_amt=0.28,
                           cavity=0.4, sheen=0.03, hue_drift=(0.095, 0.036, 0.017))
    M['tote_pipe'] = MT.leather('M3_TotePiping', (0.050, 0.019, 0.011), var=0.05, rough=(0.2, 0.32), coat=0.45,
                                coat_rough=0.1, grain='calf', grain_str=0.2, cavity=0.2)
    M['satchel'] = MT.leather('M3_SatchelPullUp', (0.058, 0.027, 0.013), var=0.18, rough=(0.34, 0.56), coat=0.18,
                              coat_rough=0.28, grain='aged', grain_mul=0.6, grain_str=0.5, pullup=(0.25, 0.125, 0.052),
                              pullup_amt=0.75, wrinkle=0.3, dark_edge=(0.02, 0.01, 0.006), cavity=0.5,
                              hue_drift=(0.07, 0.034, 0.012))
    M['satchel_flesh'] = MT.suede('M3_SatchelFlesh', (0.22, 0.13, 0.07))
    M['wallet'] = MT.leather('M3_WalletTan', (0.22, 0.10, 0.032), var=0.1, rough=(0.28, 0.42), coat=0.25, coat_rough=0.14,
                             grain='smooth', grain_str=0.4, pullup=(0.34, 0.17, 0.06), pullup_amt=0.35, cavity=0.45)
    M['wallet_lining'] = MT.leather('M3_WalletLining', (0.17, 0.075, 0.025), var=0.08, rough=(0.38, 0.55), coat=0.05,
                                    grain='smooth', grain_str=0.3)
    M['edge'] = MT.edge_paint('M3_EdgePaint', (0.022, 0.012, 0.007))
    M['thread'] = MT.thread('M3_ThreadBeige', (0.40, 0.28, 0.15))
    M['thread_tonal'] = MT.thread('M3_ThreadTonal', (0.13, 0.055, 0.022))
    M['brass'] = MT.metal('M3_Brass', (0.80, 0.60, 0.30), rough=0.22, var=0.07, patina=(0.33, 0.25, 0.13), patina_amt=0.35)
    M['zip'] = MT.suede('M3_ZipTape', (0.016, 0.012, 0.009), sheen=0.3)
    M['chalk'] = MT.chalk('M3_Chalk')
    for k, name, base, pu in (('stack_a', 'M3_StackCognac', (0.23, 0.10, 0.030), (0.34, 0.16, 0.05)),
                              ('stack_b', 'M3_StackChestnut', (0.12, 0.052, 0.020), (0.3, 0.12, 0.04)),
                              ('stack_c', 'M3_StackHoney', (0.30, 0.15, 0.050), (0.5, 0.22, 0.07))):
        M[k] = MT.leather(name, base, var=0.12, rough=(0.28, 0.44), coat=0.22, grain='smooth', grain_str=0.45,
                          pullup=pu, pullup_amt=0.3, cavity=0.5, marks=0.35)
    M['stack_d'] = MT.leather('M3_StackBlack', (0.017, 0.015, 0.014), var=0.15, rough=(0.25, 0.42), coat=0.3,
                              grain='smooth', grain_str=0.45, pullup=(0.06, 0.045, 0.035), pullup_amt=0.3, cavity=0.4)
    for k, c in (('stack_a', (0.34, 0.20, 0.10)), ('stack_b', (0.28, 0.17, 0.09)), ('stack_c', (0.38, 0.23, 0.12)), ('stack_d', (0.12, 0.10, 0.08))):
        M[k + '_flesh'] = MT.suede('M3_' + k + '_Flesh', c)
    M['stack_edge'] = MT.suede('M3_StackEdge', (0.16, 0.075, 0.03), sheen=0.3, rough=0.75)
    M['tan'] = MT.leather('M3_RollTanAniline', (0.30, 0.138, 0.046), var=0.14, rough=(0.30, 0.50), coat=0.14,
                          coat_rough=0.22, grain='smooth', grain_str=0.85, sheen=0.1, cavity=0.35, wrinkle=0.22,
                          hue_drift=(0.25, 0.10, 0.03), marks=0.6)
    M['tan_flesh'] = MT.suede('M3_RollTanFlesh', (0.36, 0.20, 0.09))
    M['tan_edge'] = MT.suede('M3_RollTanEdge', (0.22, 0.11, 0.045), rough=0.85, sheen=0.25)
    M['brown'] = MT.leather('M3_RollMilled', (0.10, 0.048, 0.022), var=0.10, rough=(0.30, 0.56), coat=0.12, coat_rough=0.25,
                            grain='pebble', grain_mul=1.25, grain_str=1.1, cavity=0.45, marks=0.3)
    M['brown_flesh'] = MT.suede('M3_RollBrownFlesh', (0.24, 0.15, 0.08))
    M['brown_edge'] = MT.suede('M3_RollBrownEdge', (0.08, 0.038, 0.018), rough=0.85, sheen=0.2)
    M['croc'] = MT.croc('M3_CrocBelly')
    M['croc_flesh'] = MT.suede('M3_CrocFlesh', (0.13, 0.08, 0.042))
    M['croc_edge'] = MT.suede('M3_CrocEdge', (0.05, 0.04, 0.025), rough=0.8, sheen=0.2)
    M['tie'] = MT.leather('M3_Thong', (0.15, 0.065, 0.028), var=0.1, rough=(0.38, 0.55), coat=0.1, grain='smooth',
                          grain_str=0.3, coords_mode='OBJECT', obj_scale=1.0)
    _goods_pass()
    return M


def _goods_pass():
    """film6.goods(): wear and dirt darken creases and corners (AO), waxed satin on the calf, oily sheen on pull-up"""
    for name, coat, sheen, dark in (('M3_ToteCalf', 0.28, 0.0, 0.45), ('M3_TotePiping', 0.28, 0.0, 0.4),
                                    ('M3_SatchelPullUp', 0.12, 0.18, 0.5), ('M3_WalletTan', 0.15, 0.12, 0.4)):
        m = bpy.data.materials.get(name)
        if m is None or m.get('goods6'):
            continue
        nt = m.node_tree
        P = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        base = P.inputs['Base Color']
        src_ = base.links[0].from_socket if base.is_linked else tuple(base.default_value[:3])
        ao = MT.N(nt, 'ShaderNodeAmbientOcclusion', (-600, -900)); ao.samples = 8
        ao.inputs['Distance'].default_value = 0.04
        f = MT.maprange(nt, ao.outputs['AO'], 0.35, 0.95, dark, 0.0, (-400, -900))
        col = MT.mix(nt, src_, (0.35, 0.3, 0.27), f, 'MULTIPLY', (-200, -700))
        MT.link(nt, col, base)
        if coat:
            P.inputs['Coat Weight'].default_value = max(P.inputs['Coat Weight'].default_value, coat)
            P.inputs['Coat Roughness'].default_value = 0.28
        if sheen:
            P.inputs['Sheen Weight'].default_value = max(P.inputs['Sheen Weight'].default_value, sheen)
            P.inputs['Sheen Roughness'].default_value = 0.45
        m['goods6'] = 1


def matte(name, color, rough=0.85, spec=0.3):
    m, nt = E.mat(name)
    P = MT.N(nt, 'ShaderNodeBsdfPrincipled', (600, 0))
    P.inputs['Base Color'].default_value = (*color, 1)
    P.inputs['Roughness'].default_value = rough
    P.inputs['Specular IOR Level'].default_value = spec
    MT.output(nt, P.outputs['BSDF'], (900, 0))
    return m


# ------------------------------------------------------------------------------------------------ the goods
def tote(M, loc=(0, 0, 0), yaw=0.0):
    return G.tote3(M, loc, yaw, cname='Goods')


def satchel(M, loc=(0, 0, 0), yaw=0.0):
    return G.satchel3(M, loc, yaw, cname='Goods')


def wallet(M, loc=(0, 0, 0), yaw=0.0):
    return G.wallet_closed3(M, loc, yaw, cname='Goods')


def wallet_open(M, loc=(0, 0, 0), yaw=0.0, open_deg=150.0):
    return G.wallet_open3(M, loc, yaw, open_deg=open_deg, cname='Goods')


def stack(M, loc=(0, 0, 0), yaw=0.0, n=6):
    return G.hide_stack3(M, loc, yaw, n=n, cname='Goods')


ROLLS = {  # r_core, r_outer, thick, gap, seed, start_deg, tele, mats
    'croc': (0.036, 0.078, 0.0024, 1.75, 3, 205, 0.0016, ('croc', 'croc_flesh', 'croc_edge')),
    'tan': (0.030, 0.066, 0.0019, 1.8, 5, 150, 0.0012, ('tan', 'tan_flesh', 'tan_edge')),
    'brown': (0.026, 0.057, 0.0018, 1.8, 8, 120, 0.0010, ('brown', 'brown_flesh', 'brown_edge')),
}


def roll(M, kind, length, loc=(0, 0, 0), yaw=0.0, tie=None, name=None):
    rc, ro, th, gap, seed, ang, tele, mk = ROLLS[kind]
    name = name or 'Roll_' + kind
    r = G.roll3(name, length, rc, ro, th, [M[k] for k in mk], seed=seed, gap=gap, start_angle=math.radians(ang),
                edge_amp=0.010, flap=0.012, flap_arc=1.4, tele=tele, tele_dir=1, squash=0.9, wobble=0.0009,
                outer_soft=0.0008, end_len=0.07, tele_jit=0.003, cname='Goods')
    h = r['roll_half_height']
    r.matrix_world = (Matrix.Translation((loc[0], loc[1], loc[2] + h)) @ Matrix.Rotation(yaw, 4, 'Z')
                      @ Matrix.Rotation(math.radians(90), 4, 'Y'))
    parts = [r]
    if tie is not None:
        for p in G.roll_tie(r, name + '_Tie', tie * length, M['tie'], cname='Goods'):
            mwp = p.matrix_world.copy()
            p.parent = r
            p.matrix_parent_inverse = Matrix.Identity(4)
            p.matrix_basis = mwp
            parts.append(p)
    return r, parts


def boot_material():
    A = os.path.join(ROOT, 'assets', 'fieldboot')
    m, nt = E.mat('M3_FieldBoot')
    P = MT.N(nt, 'ShaderNodeBsdfPrincipled', (900, 0))
    uv, tc = MT.coords(nt, 'UV')
    tx = lambda f, nc, loc: MT.image(nt, os.path.join(A, f), uv, nc, loc)
    c = tx('FieldBoot_BaseColor.jpg', False, (-900, 300)); r = tx('FieldBoot_Roughness.jpg', True, (-900, 0))
    n = tx('FieldBoot_Normal.jpg', True, (-900, -300)); ao = tx('FieldBoot_AO.jpg', True, (-900, 600))
    hs = MT.N(nt, 'ShaderNodeHueSaturation', (-600, 300), Hue=0.5, Saturation=1.18, Value=0.80)
    MT.link(nt, c.outputs['Color'], hs.inputs['Color'])
    bc = MT.N(nt, 'ShaderNodeBrightContrast', (-400, 300), Bright=0.0, Contrast=0.06)
    MT.link(nt, hs.outputs['Color'], bc.inputs['Color'])
    col = MT.mix(nt, bc.outputs['Color'], ao.outputs['Color'], 0.35, 'MULTIPLY', (-200, 400))
    MT.link(nt, col, P.inputs['Base Color'])
    MT.link(nt, MT.maprange(nt, r.outputs['Color'], 0.0, 1.0, 0.22, 0.62, (-500, 0)), P.inputs['Roughness'])
    nm = MT.N(nt, 'ShaderNodeNormalMap', (-500, -300), Strength=1.0)
    MT.link(nt, n.outputs['Color'], nm.inputs['Color'])
    MT.link(nt, nm.outputs['Normal'], P.inputs['Normal']); MT.link(nt, nm.outputs['Normal'], P.inputs['Coat Normal'])
    P.inputs['Coat Weight'].default_value = 0.3; P.inputs['Coat Roughness'].default_value = 0.18
    P.inputs['Sheen Weight'].default_value = 0.05
    MT.output(nt, P.outputs['BSDF'])
    return m


_BOOTS = {}


def field_boots():
    """the film's pair of field boots (the user's FieldBoot model), each levelled on its own: sole on z=0, toe at
    -Y, pivot under the middle of the footprint. Returns [right, left] (as hero_v3.boots)."""
    if _BOOTS.get('pair'):
        return _BOOTS['pair']
    obj = os.path.join(ROOT, 'assets', 'fieldboot', 'Format2.obj')
    before = set(bpy.data.objects.keys())
    bpy.ops.wm.obj_import(filepath=obj, forward_axis='NEGATIVE_Z', up_axis='Y')
    new = [bpy.data.objects[n] for n in set(bpy.data.objects.keys()) - before if bpy.data.objects[n].type == 'MESH']
    new.sort(key=lambda o: sum((o.matrix_world @ Vector(c)).x for c in o.bound_box))
    m = boot_material()
    out = []
    for i, o in enumerate(new):
        for c in o.users_collection:
            c.objects.unlink(o)
        coll('Goods').objects.link(o)
        o.name = 'FieldBoot_%d' % i
        me = o.data
        me.transform(o.matrix_world)
        o.matrix_world = Matrix.Identity(4)
        me.transform(Matrix.Scale(0.01, 4))
        zmin = min(v.co.z for v in me.vertices)
        sole = [v.co.copy() for v in me.vertices if v.co.z < zmin + 0.012]
        mx_ = sum(p.x for p in sole) / len(sole); my_ = sum(p.y for p in sole) / len(sole)
        sxx = sum((p.x - mx_) ** 2 for p in sole); syy = sum((p.y - my_) ** 2 for p in sole)
        sxy = sum((p.x - mx_) * (p.y - my_) for p in sole)
        phi = 0.5 * math.atan2(2 * sxy, sxx - syy)
        me.transform(Matrix.Rotation(math.pi / 2 - phi, 4, 'Z'))
        zs = [v.co.z for v in me.vertices]; zmax_ = max(zs)
        top_y = [v.co.y for v in me.vertices if v.co.z > zmin + (zmax_ - zmin) * 0.7]
        sole_y = [v.co.y for v in me.vertices if v.co.z < zmin + 0.012]
        if sum(top_y) / len(top_y) < sum(sole_y) / len(sole_y):
            me.transform(Matrix.Rotation(math.pi, 4, 'Z'))
        xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
        piv = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)))
        me.transform(Matrix.Translation(-piv))
        me.materials.clear(); me.materials.append(m)
        me.shade_smooth()
        out.append(o)
    med = {}
    for o in out:
        vs = o.data.vertices
        ymin = min(v.co.y for v in vs)
        tip = [v.co.x for v in vs if v.co.y < ymin + 0.012 and v.co.z < 0.03]
        med[o.name] = sum(tip) / len(tip) if tip else 0.0
    if len(out) == 2 and med[out[1].name] > med[out[0].name] + 0.002:
        out.reverse()
    out[0].name, out[1].name = 'FieldBoot_R', 'FieldBoot_L'
    _BOOTS['pair'] = out
    return out


def aalf_boot(path=os.path.join(HERE, 'models', 'aalf_boot_plain.glb'), frame=None):
    """the AALF site's boot (made in Blender for allafricanleatherfair.org), assembled: the last frame of its
    coming-apart animation. Returns its root empty (sole on z=0, toe to -Y as imported)."""
    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=path)
    new = [bpy.data.objects[n] for n in set(bpy.data.objects.keys()) - before]
    acts = [a for a in bpy.data.actions]
    end = max((a.frame_range[1] for a in acts), default=1)
    sc = bpy.context.scene
    sc.frame_set(int(frame if frame is not None else end))
    root = bpy.data.objects.new('AALFBoot', None)
    coll('Goods').objects.link(root)
    for o in new:
        if o.parent is None:
            o.parent = root
        for c in list(o.users_collection):
            if c.name != 'Goods':
                c.objects.unlink(o)
        if o.name not in coll('Goods').objects:
            coll('Goods').objects.link(o)
    return root, new


# ------------------------------------------------------------------------------------------------ the stage
def sweep(name='Sweep', color=None, width=6.0, depth=4.0, height=3.0, radius=0.9, mat=None, y_wall=1.2):
    """a photographic seamless: floor (towards -Y, the camera) curving up into a wall at +y_wall"""
    import bmesh
    bm = bmesh.new()
    prof = []
    n_arc = 24
    # floor from -depth to the start of the curve, the curve, then the wall up to height
    y0 = y_wall - radius
    prof.append((-depth, 0.0))
    for i in range(0, 12):
        prof.append((-depth + (y0 + depth) * (i + 1) / 12, 0.0))
    for i in range(1, n_arc + 1):
        a = (math.pi / 2) * i / n_arc
        prof.append((y0 + radius * math.sin(a), radius - radius * math.cos(a)))
    for i in range(1, 9):
        prof.append((y_wall, radius + (height - radius) * i / 8))
    nx = 24
    vs = [[bm.verts.new((-width / 2 + width * j / nx, y, z)) for (y, z) in prof] for j in range(nx + 1)]
    for j in range(nx):
        for i in range(len(prof) - 1):
            bm.faces.new((vs[j][i], vs[j + 1][i], vs[j + 1][i + 1], vs[j][i + 1]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me); coll('Stage').objects.link(ob)
    ob.data.materials.append(mat or matte('M_' + name, color or BRAND['brown'], 0.9))
    return ob


def backdrop_mat(name='M_Backdrop', dark='#2e160f', light='#7a3f1f', centre=(0.05, 0.95, 0.42), radii=(1.25, 1.0, 0.75),
                 rough=0.92, power=1.6):
    """a painted seamless: the brand brown, warming to a soft pool of light behind the goods (painted into the
    paper, as a photographer's hand-painted backdrop: no light to leave a hard edge on the floor)"""
    m, nt = E.mat(name)
    P = MT.N(nt, 'ShaderNodeBsdfPrincipled', (600, 0))
    tc = MT.N(nt, 'ShaderNodeTexCoord', (-1200, 0))
    sub = MT.N(nt, 'ShaderNodeVectorMath', (-1000, 0), operation='SUBTRACT')
    MT.link(nt, tc.outputs['Object'], sub.inputs[0]); sub.inputs[1].default_value = centre
    div = MT.N(nt, 'ShaderNodeVectorMath', (-850, 0), operation='DIVIDE')
    MT.link(nt, sub.outputs['Vector'], div.inputs[0]); div.inputs[1].default_value = radii
    ln = MT.N(nt, 'ShaderNodeVectorMath', (-700, 0), operation='LENGTH')
    MT.link(nt, div.outputs['Vector'], ln.inputs[0])
    f = MT.maprange(nt, ln.outputs['Value'], 0.0, 1.0, 1.0, 0.0, (-550, 0), 'SMOOTHERSTEP')
    f = MT.math_(nt, 'POWER', f, power, (-400, 0))
    col = MT.mix(nt, srgb(dark), srgb(light), f, 'MIX', (-200, 0))
    MT.link(nt, col, P.inputs['Base Color'])
    P.inputs['Roughness'].default_value = rough
    P.inputs['Specular IOR Level'].default_value = 0.25
    MT.output(nt, P.outputs['BSDF'], (900, 0))
    return m


def plane(name, size, loc, mat):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc)
    ob = bpy.context.active_object; ob.name = name
    ob.scale = (size[0], size[1], 1)
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    coll('Stage').objects.link(ob)
    ob.data.materials.append(mat)
    return ob


def area(name, loc, target, size=(1.0, 1.0), energy=100.0, kelvin=4300, spread=None, shape='RECTANGLE', color=None):
    L = bpy.data.lights.new(name, 'AREA'); L.shape = shape
    L.size = size[0]; L.size_y = size[1]; L.energy = energy
    L.color = color or E.kelvin(kelvin)
    if spread is not None:
        L.spread = math.radians(spread)
    o = bpy.data.objects.new(name, L); coll('Lights').objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o


def spot(name, loc, target, energy=200.0, kelvin=3800, size_deg=40, blend=0.8, radius=0.2, color=None):
    L = bpy.data.lights.new(name, 'SPOT'); L.energy = energy
    L.color = color or E.kelvin(kelvin); L.spot_size = math.radians(size_deg); L.spot_blend = blend
    L.shadow_soft_size = radius
    o = bpy.data.objects.new(name, L); coll('Lights').objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o


def camera(loc, target, lens=85.0, sensor=36.0, dof=None, shift=(0, 0), name='Cam'):
    cd = bpy.data.cameras.new(name); cd.lens = lens; cd.sensor_width = sensor; cd.sensor_fit = 'HORIZONTAL'
    cd.shift_x, cd.shift_y = shift
    cd.clip_start = 0.01; cd.clip_end = 60
    if dof:
        cd.dof.use_dof = True; cd.dof.focus_distance = dof[0]; cd.dof.aperture_fstop = dof[1]
    o = bpy.data.objects.new(name, cd); coll('Cameras').objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = o
    return o


def bounds(objs):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for o in objs:
        if o.type != 'MESH':
            continue
        ev = o.evaluated_get(dg)
        for c in ev.bound_box:
            p = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, p)); hi = Vector(map(max, hi, p))
    return lo, hi


def render(path, res=(1600, 2000), samples=128, pct=100, transparent=False, exr=True):
    """renders to path (.png, graded by the scene's view settings) and, if exr, the scene-referred light next to it
    (path.exr) so the grade can be changed later without rendering again (grade.py)"""
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = pct
    sc.cycles.samples = samples
    sc.render.film_transparent = transparent
    st = sc.render.image_settings
    st.file_format = 'PNG'; st.color_depth = '16'; st.color_mode = 'RGBA' if transparent else 'RGB'
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    if exr:
        img = bpy.data.images['Render Result']
        st.file_format = 'OPEN_EXR'; st.color_depth = '16'; st.exr_codec = 'ZIP'
        img.save_render(os.path.splitext(path)[0] + '.exr', scene=sc)
        st.file_format = 'PNG'; st.color_depth = '16'
    return path
