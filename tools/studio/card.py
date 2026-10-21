"""Membership page head: an ELIA member's card in dark leather, the stacked lockup stamped in amber foil, lying on a
tan card wallet; the tote out of focus behind.   python3 card.py [prev|final]  ->  out/card.png"""
import sys, os, math, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import studio as S
import shots as SH
import bpy, bmesh
from mathutils import Vector, Matrix
import mat3 as MT, prod3 as P3, elia_lib as E

D = math.radians
W, H, R, T = 0.0856, 0.054, 0.0034, 0.0016          # a bank card's size, in 1.6 mm leather


def rrect_pts(w, h, r, n=10):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(n + 1):
            a = D(a0 + 90 * i / n)
            pts.append(Vector((cx + r * math.cos(a), cy + r * math.sin(a), 0)))
    return pts


def card(mat_top, mat_edge):
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    ring = rrect_pts(W, H, R)
    bot = [bm.verts.new(p) for p in ring]
    top = [bm.verts.new(p + Vector((0, 0, T))) for p in ring]
    ft = bm.faces.new(top); ft.material_index = 0
    fb = bm.faces.new(list(reversed(bot))); fb.material_index = 0
    for f in (ft, fb):
        for l in f.loops:
            l[uv].uv = (l.vert.co.x, l.vert.co.y)
    n = len(ring); s = 0.0
    for i in range(n):
        a, b = i, (i + 1) % n
        f = bm.faces.new((bot[a], bot[b], top[b], top[a])); f.material_index = 1
        L = (ring[b] - ring[a]).length
        for l, (u, v) in zip(f.loops, ((s, 0), (s + L, 0), (s + L, T), (s, T))):
            l[uv].uv = (u, v)
        s += L
    me = bpy.data.meshes.new('Card'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('Card', me); S.coll('Goods').objects.link(ob)
    me.materials.append(mat_top); me.materials.append(mat_edge)
    bv = ob.modifiers.new('Bevel', 'BEVEL'); bv.width = 0.00045; bv.segments = 3; bv.limit_method = 'ANGLE'
    for p in me.polygons:
        p.use_smooth = True
    return ob


def foil_material():
    m, nt = E.mat('M_Foil')
    P = MT.N(nt, 'ShaderNodeBsdfPrincipled', (600, 0))
    P.inputs['Metallic'].default_value = 1.0
    P.inputs['Base Color'].default_value = (0.86, 0.47, 0.09, 1)        # the brand's amber, as a foil
    vec, tc = MT.coords(nt, 'Object', (-900, 0))
    n = MT.noise(nt, MT.scaled(nt, vec, 260.0, (-700, 0)), 1.0, 3, 0.6, loc=(-500, 0))
    MT.link(nt, MT.maprange(nt, n.outputs['Fac'], 0.3, 0.7, 0.14, 0.3, (-300, 0)), P.inputs['Roughness'])
    MT.output(nt, P.outputs['BSDF'], (900, 0))
    return m


def svg_mesh(path, name, width, mat):
    before = set(bpy.data.objects.keys())
    bpy.ops.import_curve.svg(filepath=path)
    new = [bpy.data.objects[k] for k in set(bpy.data.objects.keys()) - before]
    for o in new:
        o.data.dimensions = '2D'; o.data.fill_mode = 'BOTH'; o.data.resolution_u = 10
    bpy.ops.object.select_all(action='DESELECT')
    for o in new:
        o.select_set(True)
    bpy.context.view_layer.objects.active = new[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active; ob.name = name
    me = ob.data
    me.transform(ob.matrix_world); ob.matrix_world = Matrix.Identity(4)
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]
    k = width / (max(xs) - min(xs))
    me.transform(Matrix.Scale(k, 4) @ Matrix.Translation((-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, 0)))
    me.materials.clear(); me.materials.append(mat)
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    S.coll('Goods').objects.link(ob)
    ob['h'] = (max(ys) - min(ys)) * k
    return ob


def text(body, size, mat, spacing=1.0, font='Roboto-SemiBold.ttf'):
    cu = bpy.data.curves.new(body, 'FONT'); cu.body = body; cu.size = size
    cu.font = bpy.data.fonts.load(os.path.join(S.ROOT, 'fonts', font), check_existing=True)
    cu.space_character = spacing; cu.align_x = 'LEFT'; cu.align_y = 'BOTTOM'
    ob = bpy.data.objects.new(body, cu); S.coll('Goods').objects.link(ob)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    m = bpy.data.objects.new(body + '_m', me); S.coll('Goods').objects.link(m)
    bpy.data.objects.remove(ob, do_unlink=True)
    me.materials.clear(); me.materials.append(mat)
    return m


def build(M):
    S.world(0.03)
    S.sweep(color=S.BRAND['brown'], y_wall=1.4, radius=0.8)
    aim = (0.0, 0.0, 0.012)
    S.area('Key', (-0.9, -0.55, 0.85), aim, (0.6, 0.9), 5.5, 4300, spread=60)
    # behind the card, where the camera's view reflects off it: the foil and the leather's coat catch this one
    S.area('Glint', (0.05, 0.70, 0.58), aim, (0.42, 0.16), 0.7, 3900, spread=30)
    S.area('Rim', (0.75, 0.35, 0.3), aim, (0.2, 0.6), 2.5, 3300, spread=50)
    S.spot('Pool', (0.0, -0.3, 1.2), (0.0, 0.08, 0.0), 6.0, 3000, 30, 1.0, 0.3)
    leather = MT.leather('M_CardLeather', (0.034, 0.0145, 0.0085), var=0.1, rough=(0.34, 0.52), coat=0.06, coat_rough=0.3,
                         grain='calf', grain_str=0.55, rough_var=0.12, cavity=0.3, sheen=0.04, spec=0.3)
    edge = MT.edge_paint('M_CardEdge', (0.012, 0.007, 0.005))
    foil = foil_material()
    c = card(leather, edge)
    # stitching all round, 3 mm in
    ring = rrect_pts(W - 0.006, H - 0.006, R - 0.002, 12)
    ring = ring + [ring[0]]
    st = P3.stitches('Card_Stitch', [p + Vector((0, 0, T)) for p in ring], [Vector((0, 0, 1))] * len(ring), M['thread_tonal'],
                     pitch=0.0030, slen=0.0022, r=0.00036, cname='Goods')
    st.parent = c
    # the stamp: the stacked lockup on the left two-thirds, MEMBER under it
    lk = svg_mesh(os.path.join(S.ROOT, 'lockup_stacked_flat.svg'), 'Card_Lockup', 0.050, foil)
    lk.location = (-0.0085, 0.0045, T + 0.00006); lk.parent = c
    mb = text('MEMBER', 0.0033, foil, spacing=1.35)
    mb.location = (-W / 2 + 0.0085, -H / 2 + 0.0078, T + 0.00006); mb.parent = c
    # the card on a tan card wallet, the tote behind
    M = dict(M); M['wallet'] = M['tote']
    P = next(n for n in M['tote'].node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    P.inputs['Coat Weight'].default_value = 0.1; P.inputs['Coat Roughness'].default_value = 0.32
    S.wallet(M, (0.0, 0.004, 0), -8)
    c.location = (0.006, -0.004, 0.0136); c.rotation_euler = (0, 0, D(14))
    S.camera((0.0, -0.34, 0.30), (0.004, 0.004, 0.012), lens=100, dof=(0.45, 3.5))
    return (1280, 1600)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    q = args[0] if args else 'prev'
    t0 = time.time()
    S.new_scene(); M = S.materials()
    res = build(M)
    if q == 'prev':
        res = (512, 640); spp = 40
    else:
        spp = int(args[1]) if len(args) > 1 else 96
    out = os.path.join(HERE, 'out', 'card%s.png' % ('' if q == 'final' else '_prev'))
    S.render(out, res, spp, exr=(q == 'final'))
    if q == 'final':
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'out', 'card.blend'))
    print('CARD', q, round(time.time() - t0, 1), out)
