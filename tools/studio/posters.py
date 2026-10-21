"""Pictures for the 3D stage (web/src/components/Stage3D.astro): each piece from the stage's own camera, on a
transparent film with only its shadow, so the page's cream shows through as it does around the 3D model.

    python3 posters.py tote|boot [prev|final]  ->  out/s3d_<piece>.png

The views here are the ones in the page (copy/stage.ts): three.js coordinates, y up, the piece's front to +z.
"""
import sys, os, math, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import studio as S
import bpy
from mathutils import Vector, Matrix

D = math.radians
VIEWS = {   # fov (vertical, degrees), camera, target, turn (degrees about the upright)
    'tote': dict(fov=24, cam=(0.0, 0.42, 1.585), target=(0.0, 0.20, 0.0), turn=-22),
    'boot': dict(fov=24, cam=(0.0, 0.30, 1.05), target=(0.0, 0.072, 0.0), turn=-28),
}


def b(v):
    """three.js (x, y, z) -> Blender (x, -z, y)"""
    return Vector((v[0], -v[2], v[1]))


def cream_light(aim):
    S.world(0.5, rot=40, clamp=1.6)
    # the key as in stage3d-gl.ts (from the front left, above), made a soft box; a top box; a rim from behind right
    S.area('Key', b((-1.25, 1.35, 0.95)) * 1.1, aim, (0.9, 0.9), 88, 5000)
    S.area('Top', b((0.1, 2.0, 0.2)), aim, (1.2, 1.2), 22, 5600)
    S.area('Rim', b((0.9, 0.7, -1.2)), aim, (0.5, 1.0), 40, 4200)
    S.area('Fill', b((1.2, 1.5, 1.3)), aim, (1.4, 1.2), 9, 5800)


def stage_floor():
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
    f = bpy.context.active_object; f.name = 'Catcher'
    f.is_shadow_catcher = True
    f.data.materials.append(S.matte('M_Catcher', S.BRAND['page'], 0.9))
    return f


def camera(v):
    cam = S.camera(b(v['cam']), b(v['target']), lens=12 / math.tan(D(v['fov']) / 2), sensor=24.0)
    cam.data.sensor_fit = 'VERTICAL'
    return cam


def tote(M):
    v = VIEWS['tote']
    root, parts = S.tote(M, (0, 0, 0), v['turn'])
    return v


def boot(M):
    v = VIEWS['boot']
    root, new = S.aalf_boot(frame=175)
    mws = {o.name: o.matrix_world.copy() for o in new}
    for o in new:
        o.animation_data_clear()
    for o in new:
        o.matrix_world = mws[o.name]
        if o.type == 'CAMERA':
            o.hide_render = True
    root.rotation_euler = (0, 0, D(v['turn']))
    return v


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    piece = args[0]; q = args[1] if len(args) > 1 else 'prev'
    t0 = time.time()
    S.new_scene(); M = S.materials()
    sc = bpy.context.scene
    sc.view_settings.look = 'AgX - Punchy'; sc.view_settings.exposure = -0.3
    v = {'tote': tote, 'boot': boot}[piece](M)
    stage_floor()
    cream_light(b(v['target']))
    camera(v)
    res = (1080, 1350) if q == 'final' else (432, 540)
    spp = 96 if q == 'final' else 32
    out = os.path.join(HERE, 'out', 's3d_%s%s.png' % (piece, '' if q == 'final' else '_prev'))
    S.render(out, res, spp, transparent=True, exr=(q == 'final'))
    print('POSTER', piece, q, round(time.time() - t0, 1), out)
