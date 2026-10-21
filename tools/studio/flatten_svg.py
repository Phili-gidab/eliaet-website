"""Flatten an SVG lockup for Blender's importer: <use> glyphs become <path>s with their offsets as transforms.
python3 flatten_svg.py in.svg out.svg"""
import sys, re
import xml.etree.ElementTree as ET

NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
src, dst = sys.argv[1], sys.argv[2]
tree = ET.parse(src)
root = tree.getroot()
defs = {}
for d in root.iter('{%s}defs' % NS):
    for p in d:
        defs[p.get('id')] = p.get('d')
for d in list(root.iter('{%s}defs' % NS)):
    root.remove(d)
for t in list(root.iter('{%s}title' % NS)):
    root.remove(t)


def walk(el):
    for i, c in enumerate(list(el)):
        if c.tag == '{%s}use' % NS:
            ref = (c.get('href') or c.get('{http://www.w3.org/1999/xlink}href')).lstrip('#')
            p = ET.Element('{%s}path' % NS, {'d': defs[ref], 'transform': 'translate(%s %s)' % (c.get('x', '0'), c.get('y', '0'))})
            el.remove(c); el.insert(i, p)
        else:
            walk(c)


walk(root)
for el in root.iter():
    if el.get('fill') not in (None, 'none'):
        el.set('fill', '#000000')
    if 'fill-opacity' in el.attrib:
        del el.attrib['fill-opacity']
tree.write(dst, encoding='unicode')
print('paths', sum(1 for _ in root.iter('{%s}path' % NS)), 'circles', sum(1 for _ in root.iter('{%s}circle' % NS)))
