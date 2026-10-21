"""save an EXR render with several view settings: python3 grade.py in.exr out_prefix look1:exp1 look2:exp2 ..."""
import sys, bpy
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
src, pre = args[0], args[1]
img = bpy.data.images.load(src)
sc = bpy.context.scene
sc.view_settings.view_transform = 'AgX'
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_depth = '8'
for spec in args[2:]:
    look, exp = spec.split(':')
    sc.view_settings.look = {'mhc': 'AgX - Medium High Contrast', 'punchy': 'AgX - Punchy', 'base': 'None', 'hc': 'AgX - High Contrast', 'base+': 'AgX - Base Contrast'}[look]
    sc.view_settings.exposure = float(exp)
    out = '%s_%s_%s.png' % (pre, look, exp)
    img.save_render(out, scene=sc)
    print('saved', out)
