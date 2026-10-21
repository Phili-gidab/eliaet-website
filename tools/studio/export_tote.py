"""The tote from the hero film as a web model: its procedural leather baked to an atlas (colour with the worn
creases, roughness, the grain as a normal map, ambient occlusion), the small parts in plain materials, one GLB.

    python3 export_tote.py [size]   ->  models/tote_raw.glb  (then: node pack.mjs)
"""
import sys, os, math, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import studio as S
import bpy, bmesh
from mathutils import Vector

SIZE = int(sys.argv[-1]) if sys.argv[-1].isdigit() else 2048
OUTD = os.path.join(HERE, 'models'); os.makedirs(OUTD, exist_ok=True)
t0 = time.time()
S.new_scene(); M = S.materials()
sc = bpy.context.scene
root, parts = S.tote(M, (0, 0, 0), 0)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()

# 1. every part as a plain mesh in world space, modifiers applied, then one object
objs = []
for o in parts:
    if o.type != 'MESH':
        continue
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    me.transform(o.matrix_world)
    ob = bpy.data.objects.new(o.name + '_x', me)
    sc.collection.objects.link(ob)
    objs.append(ob)
for o in list(parts) + [root]:
    bpy.data.objects.remove(o, do_unlink=True)
for ob in objs:
    if 'UVMap' not in ob.data.uv_layers:
        ob.data.uv_layers.new(name='UVMap')
bpy.ops.object.select_all(action='DESELECT')
for ob in objs:
    ob.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.object.join()
tote = bpy.context.view_layer.objects.active
tote.name = 'Tote'
me = tote.data
print('joined', len(me.vertices), 'verts', len(me.polygons), 'faces', [m.name for m in me.materials])

# 2. the leather slots get their own unwrap, packed into one atlas
LEATHER = {'M3_ToteCalf', 'M3_TotePiping'}
lslots = {i for i, m in enumerate(me.materials) if m and m.name in LEATHER}
bake_uv = me.uv_layers.new(name='Bake')
me.uv_layers.active = bake_uv
bpy.ops.object.mode_set(mode='EDIT')
bm = bmesh.from_edit_mesh(me)
for f in bm.faces:
    f.select = f.material_index in lslots
bmesh.update_edit_mesh(me)
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004, area_weight=0.0, scale_to_bounds=False)
bpy.ops.uv.pack_islands(margin=0.004, rotate=True)
# the small parts (thread, brass, edge paint) take no texture: their atlas corner is a single texel, out of the way
bm = bmesh.from_edit_mesh(me)
lay = bm.loops.layers.uv['Bake']
for f in bm.faces:
    if f.material_index not in lslots:
        for l in f.loops:
            l[lay].uv = (0.9995, 0.9995)
bmesh.update_edit_mesh(me)
bpy.ops.object.mode_set(mode='OBJECT')

# the leathers keep reading their grain from the original UVs while baking into the atlas
for m in me.materials:
    if not m or m.name not in LEATHER:
        continue
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.bl_idname == 'ShaderNodeTexCoord' and n.outputs['UV'].is_linked:
            uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'UVMap'; uvn.location = n.location
            for l in list(n.outputs['UV'].links):
                nt.links.new(uvn.outputs['UV'], l.to_socket)
me = tote.data
me.uv_layers.active = me.uv_layers['Bake']
me.uv_layers['Bake'].active_render = True
print('uv layers', [(l.name, l.active, l.active_render) for l in me.uv_layers])

# 3. bake
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.render.bake.margin = 12
sc.render.bake.use_clear = True
imgs = {}
def target(kind, noncolor):
    im = bpy.data.images.new('tote_' + kind, SIZE, SIZE, alpha=False, float_buffer=False)
    if noncolor:
        im.colorspace_settings.name = 'Non-Color'
    imgs[kind] = im
    for m in me.materials:
        if m:
            nt = m.node_tree
            for n in [n for n in nt.nodes if n.name == 'BakeTarget']:
                nt.nodes.remove(n)
            t = nt.nodes.new('ShaderNodeTexImage'); t.name = 'BakeTarget'; t.image = im
            u = nt.nodes.new('ShaderNodeUVMap'); u.uv_map = 'Bake'; nt.links.new(u.outputs['UV'], t.inputs['Vector'])
            for n in nt.nodes:
                n.select = False
            t.select = True; nt.nodes.active = t
    return im

# only the leather faces are baked: hide the rest by baking with them in the atlas corner (they get no texture)
bpy.ops.object.select_all(action='DESELECT'); tote.select_set(True); bpy.context.view_layer.objects.active = tote
sc.cycles.samples = 16
target('color', False)
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_clear=True)
print('baked color', round(time.time() - t0, 1), flush=True)
target('rough', True)
bpy.ops.object.bake(type='ROUGHNESS', use_clear=True)
print('baked rough', round(time.time() - t0, 1), flush=True)
target('normal', True)
bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', use_clear=True)
print('baked normal', round(time.time() - t0, 1), flush=True)
sc.cycles.samples = 64
target('ao', True)
sc.world.light_settings.distance = 0.06
bpy.ops.object.bake(type='AO', use_clear=True)
print('baked ao', round(time.time() - t0, 1), flush=True)
for k, im in imgs.items():
    im.filepath_raw = os.path.join(OUTD, 'tote_%s.png' % k); im.file_format = 'PNG'; im.save()

# 4. web materials
def web_mat(name, color=None, rough=0.5, metal=0.0, coat=0.0, coat_rough=0.3, sheen=0.0, tex=False):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    P = nt.nodes.get('Principled BSDF')
    P.inputs['Roughness'].default_value = rough; P.inputs['Metallic'].default_value = metal
    P.inputs['Coat Weight'].default_value = coat; P.inputs['Coat Roughness'].default_value = coat_rough
    P.inputs['Sheen Weight'].default_value = sheen
    if color:
        P.inputs['Base Color'].default_value = (*color, 1)
    if tex:
        uv = nt.nodes.new('ShaderNodeUVMap'); uv.uv_map = 'Bake'
        def it(k):
            t = nt.nodes.new('ShaderNodeTexImage'); t.image = imgs[k]; nt.links.new(uv.outputs['UV'], t.inputs['Vector']); return t
        nt.links.new(it('color').outputs['Color'], P.inputs['Base Color'])
        nt.links.new(it('rough').outputs['Color'], P.inputs['Roughness'])
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.uv_map = 'Bake'
        nt.links.new(it('normal').outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], P.inputs['Normal'])
    return m

leather = web_mat('Tote_Leather', rough=0.35, coat=0.3, coat_rough=0.28, tex=True)
plain = {
    'M3_EdgePaint': web_mat('Tote_EdgePaint', (0.022, 0.012, 0.007), 0.3, coat=0.4, coat_rough=0.2),
    'M3_ThreadBeige': web_mat('Tote_Thread', (0.40, 0.28, 0.15), 0.55, sheen=0.4),
    'M3_ThreadTonal': web_mat('Tote_ThreadTonal', (0.13, 0.055, 0.022), 0.55, sheen=0.4),
    'M3_Brass': web_mat('Tote_Brass', (0.80, 0.60, 0.30), 0.24, metal=1.0),
    'M3_ZipTape': web_mat('Tote_Zip', (0.016, 0.012, 0.009), 0.8, sheen=0.3),
}
used = []
for i, m in enumerate(me.materials):
    if m and m.name in LEATHER:
        me.materials[i] = leather
    elif m and m.name in plain:
        me.materials[i] = plain[m.name]
    else:
        print('unmapped material', m.name if m else None)
# one UV map: the atlas
for l in [l for l in me.uv_layers if l.name != 'Bake']:
    me.uv_layers.remove(l)
for a in [a for a in me.attributes if a.name in ('crv', 'edge')]:
    me.attributes.remove(a)
# the glTF file is y-up and faces +z; the tote's front faces -y in Blender, which becomes +z
out = os.path.join(OUTD, 'tote_raw.glb')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=False, export_apply=True,
                          export_texcoords=True, export_normals=True, export_materials='EXPORT',
                          export_image_format='AUTO', export_cameras=False, export_lights=False, export_yup=True)
print('EXPORTED', out, os.path.getsize(out), round(time.time() - t0, 1))
