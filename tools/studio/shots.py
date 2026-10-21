"""The ELIA site's studio shots. python3 shots.py <shot> [prev|final]  ->  out/<shot>.png (+ .exr)

head     Programs page head: the tote and the field boots, front on (4:5; the phone crop is 16:11 through the middle)
styles   Home bento 'Styles you have to see': close and low on the tote and a boot (2:1; crops to 2.6:1 and 4:3)
aalf     Home bento '15th All African Leather Fair': the AALF boot taken apart, layer above layer (16:10)
sectors  Programs '194 members': the three sectors - rolls of finished leather, boots, the tote (5:7; crop 4:3)
lone     404: one boot on its own - its pair has walked off (4:5)
"""
import sys, os, math, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import studio as S
import bpy
from mathutils import Vector, Matrix

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
D = math.radians


def brown_stage(key=40.0, top=24.0, rim=(26.0, 20.0), front=22.0, pool=55.0, pool_at=(0.02, 1.0, 0.36), world=0.035,
                y_wall=1.0, key_from=(-1.5, -0.7, 1.1), aim=(0.0, 0.05, 0.15)):
    S.world(world)
    S.sweep(color=S.BRAND['brown'], y_wall=y_wall, radius=0.8)
    ax, ay, az = aim
    S.area('Key', key_from, aim, (0.9, 1.6), key, 4300, spread=70)
    S.area('Top', (ax, ay, 1.7), (ax, ay, 0.0), (1.4, 0.9), top, 4800, spread=80)
    S.area('RimR', (ax + 0.95, ay + 0.5, 0.6), (ax + 0.15, ay, az), (0.25, 1.0), rim[0], 3300, spread=50)
    S.area('RimL', (ax - 0.95, ay + 0.55, 0.55), (ax - 0.15, ay, az + 0.03), (0.25, 1.0), rim[1], 3300, spread=50)
    S.area('Fill', (ax + 0.8, -1.7, 0.5), aim, (1.2, 1.0), 5, 5200)
    if front:
        S.area('Front', (ax - 0.1, -2.1, 1.25), (ax - 0.1, ay + 0.05, az + 0.07), (1.8, 0.5), front, 5000, spread=60)
    if pool:
        S.spot('Pool', (pool_at[0], -0.9, 1.15), pool_at, pool, 3000, 42, 1.0, 0.5)


def boots_pair(R=(0.145, -0.02, -16), L=(0.295, 0.07, 10)):
    bR, bL = S.field_boots()
    bR.location = (R[0], R[1], 0); bR.rotation_euler = (0, 0, D(R[2]))
    bL.location = (L[0], L[1], 0); bL.rotation_euler = (0, 0, D(L[2]))
    return bR, bL


def lay_on_floor(objs):
    """drop a group so that its lowest point touches z = 0"""
    lo, hi = S.bounds(objs)
    for o in objs:
        if o.parent is None:
            o.location.z -= lo.z


# ------------------------------------------------------------------------------------------------ the shots
def head(M):
    brown_stage()
    S.tote(M, (-0.185, 0.10, 0), -6)
    boots_pair()
    S.camera((0.0, -1.8, 0.45), (0.0, 0.06, 0.19), lens=82, dof=(1.85, 7.1))
    return (1280, 1600)


def styles(M):
    brown_stage(key=36, front=18, pool=55, pool_at=(0.0, 1.0, 0.28), aim=(0.0, 0.08, 0.12))
    S.roll(M, 'tan', 0.62, (-0.36, 0.30, 0), D(18), tie=0.22, name='Roll_tan')
    S.roll(M, 'brown', 0.50, (0.36, 0.36, 0), D(-24), name='Roll_brown')
    S.tote(M, (-0.06, 0.18, 0), -10)
    boots_pair(R=(0.25, -0.06, -24), L=(0.40, 0.04, 6))
    S.camera((0.03, -2.15, 0.50), (0.03, 0.10, 0.15), lens=62, dof=(2.25, 8.0))
    return (1600, 800)


RISE = {'TopLift': 0, 'Heel': 0.015, 'Outsole': 0.030, 'Midsole': 0.049, 'Welt': 0.067, 'Insole': 0.089,
        'Footbed': 0.106, 'Upper': 0.141}


def aalf(M):
    brown_stage(key=34, top=20, front=14, pool=60, pool_at=(0.0, 1.0, 0.40), aim=(0.0, 0.0, 0.2))
    root, new = S.aalf_boot(frame=175)
    sc = bpy.context.scene
    # keep the finished boot's pose, then let its layers come apart as on the AALF site (the same rises)
    mws = {o.name: o.matrix_world.copy() for o in new}
    for o in new:
        o.animation_data_clear()
    for o in new:
        o.matrix_world = mws[o.name]
    for o in new:
        if o.type == 'CAMERA':
            o.hide_render = True
    spread = 1.55
    for k, r in RISE.items():
        p = bpy.data.objects.get('Part_' + k)
        if p is not None:
            mw = p.matrix_world.copy(); mw.translation.z += r * spread; p.matrix_world = mw
    root.rotation_euler = (0, 0, D(-24))
    root.location = (0.0, 0.05, 0.0)
    S.camera((0.06, -1.6, 0.40), (0.015, 0.05, 0.205), lens=72, dof=(1.62, 8.0))
    return (1600, 1000)


def sectors(M):
    brown_stage(key=36, top=22, front=18, pool=55, pool_at=(0.0, 1.0, 0.5), aim=(0.0, 0.12, 0.25))
    # three rolls of finished leather stand behind (the tanneries), the boots (the shoe makers), the tote (the goods)
    # a small pyramid of rolls behind, their spiral ends to the camera's left
    S.roll(M, 'tan', 0.64, (-0.05, 0.36, 0), D(32), tie=0.24, name='Roll_tan')
    S.roll(M, 'brown', 0.58, (0.08, 0.47, 0), D(32), name='Roll_brown')
    r3, p3 = S.roll(M, 'tan', 0.52, (0.02, 0.42, 0), D(32), name='Roll_top')
    r3.location.z += 0.112
    S.tote(M, (-0.17, 0.06, 0), -8)
    boots_pair(R=(0.16, -0.08, -18), L=(0.30, 0.02, 8))
    S.camera((0.02, -1.62, 0.52), (0.02, 0.14, 0.20), lens=74, dof=(1.7, 8.0))
    return (1280, 1792)


def lone(M):
    brown_stage(key=34, top=22, front=16, pool=60, pool_at=(-0.05, 1.0, 0.30), aim=(0.0, 0.02, 0.12))
    bR, bL = S.field_boots()
    bR.location = (0.0, 0.02, 0); bR.rotation_euler = (0, 0, D(-58))
    bL.hide_render = True; bL.hide_viewport = True
    S.camera((0.0, -1.12, 0.33), (0.0, 0.02, 0.112), lens=85, dof=(1.14, 5.6))
    return (1280, 1600)


def detail(M):
    """News page head: close on the tote's handle, where it meets the bag: the keeper, its rivet, the brass ring, the
    stitching; the boots soft behind"""
    brown_stage(key=30, top=18, front=16, pool=50, pool_at=(0.05, 1.0, 0.30), aim=(0.0, 0.0, 0.2))
    # this close, the calf's grain shows: a stronger normal map than the film's (which saw the bag from metres away)
    for n in M['tote'].node_tree.nodes:
        if n.bl_idname == 'ShaderNodeNormalMap':
            n.inputs['Strength'].default_value = 1.5
    root, parts = S.tote(M, (0.0, 0.0, 0), -24)
    bpy.context.view_layer.update()
    fit = [o for o in parts if o.name.startswith('Tote3_FitF')]
    fit.sort(key=lambda o: (o.matrix_world.translation.x))
    p = fit[0].matrix_world.translation.copy() if fit else Vector((-0.07, -0.07, 0.24))
    boots_pair(R=(0.20, 0.30, -30), L=(0.34, 0.40, -6))
    tgt = p + Vector((0.004, 0.0, -0.035))
    S.camera(tgt + Vector((-0.17, -0.40, 0.10)), tgt, lens=100, dof=((Vector((-0.17, -0.40, 0.10))).length, 3.2))
    print('fittings', [(o.name, [round(c, 3) for c in o.matrix_world.translation]) for o in fit])
    return (1280, 1600)


SHOTS = {'head': head, 'styles': styles, 'aalf': aalf, 'sectors': sectors, 'lone': lone, 'detail': detail}

if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    shot = args[0]; q = args[1] if len(args) > 1 else 'prev'
    t0 = time.time()
    S.new_scene(); M = S.materials()
    res = SHOTS[shot](M)
    if q == 'prev':
        k = 640 / max(res)
        res = (int(res[0] * k), int(res[1] * k)); spp = 40
    else:
        spp = int(args[2]) if len(args) > 2 else 96
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, '%s%s.png' % (shot, '' if q == 'final' else '_prev'))
    S.render(path, res, spp, exr=(q == 'final'))
    if q == 'final':
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, shot + '.blend'))
    print('SHOT', shot, q, res, spp, round(time.time() - t0, 1), path)
