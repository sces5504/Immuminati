"""Offline-only Blender adapter. No API calls or credentials.
blender -b --python scripts/prepare-tripo-samples.py -- .art-source public/assets/tripo
"""
import bpy, json, math, pathlib, sys, os, struct
from mathutils import Vector

source, target = map(pathlib.Path, sys.argv[sys.argv.index('--')+1:])
target.mkdir(parents=True, exist_ok=True)
audit = []
for kind, faces, dimensions in [('macrophage',4000,(3.6,3.3,2.2)), ('neutrophil',4000,(3.0,2.85,2.25)), ('alveolar-septum',1200,(4.2,1.15,1.0))]:
    selected=os.environ.get('ART_ASSETS','').split(',')
    if selected!=[''] and kind not in selected: continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str((source/(kind+'.glb')).resolve()),merge_vertices=True)
    objects = [o for o in bpy.context.scene.objects if o.type=='MESH']
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    obj=bpy.context.object
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    coords=[v.co.copy() for v in obj.data.vertices]
    bounds=[(min(p[i] for p in coords),max(p[i] for p in coords)) for i in range(3)]
    if kind=='alveolar-septum':
        # Align the longest source axis to the horizontal tile direction.
        order=sorted(range(3),key=lambda i:bounds[i][1]-bounds[i][0],reverse=True)
        axes=[order[0],order[2],order[1]]
        odd=sum(axes[i]>axes[j] for i in range(3) for j in range(i+1,3))%2
        for v in obj.data.vertices: v.co=Vector((v.co[axes[0]]*(-1 if odd else 1),v.co[axes[1]],v.co[axes[2]]))
        coords=[v.co.copy() for v in obj.data.vertices]
        bounds=[(min(p[i] for p in coords),max(p[i] for p in coords)) for i in range(3)]
    for v in obj.data.vertices:
        for i in range(3):
            minimum,maximum=bounds[i]
            unit=(v.co[i]-minimum)/max(1e-6,maximum-minimum)
            v.co[i]=(unit-(0 if i==2 else .5))*dimensions[i]+(.08 if i==2 else 0)
    triangulate=obj.modifiers.new('triangles','TRIANGULATE')
    bpy.ops.object.modifier_apply(modifier=triangulate.name)
    if len(obj.data.polygons)>faces:
        decimate=obj.modifiers.new('web-budget','DECIMATE')
        decimate.ratio=faces/len(obj.data.polygons)
        bpy.ops.object.modifier_apply(modifier=decimate.name)
    soften=obj.modifiers.new('soft-membrane-surface','SMOOTH')
    soften.factor=.4
    soften.iterations=4
    bpy.ops.object.modifier_apply(modifier=soften.name)
    for p in obj.data.polygons: p.use_smooth=True
    obj.data.normals_split_custom_set([(0,0,0)]*len(obj.data.loops))
    for material in obj.data.materials:
        if not material.use_nodes: continue
        for node in material.node_tree.nodes:
            if node.type=='BSDF_PRINCIPLED':
                for socket,value in [('Metallic',0),('Roughness',.46 if kind!='alveolar-septum' else .65)]:
                    for link in list(node.inputs[socket].links): material.node_tree.links.remove(link)
                    node.inputs[socket].default_value=value
            if node.type=='GROUP' and node.inputs.get('Occlusion'):
                for link in list(node.inputs['Occlusion'].links): material.node_tree.links.remove(link)
    if kind!='alveolar-septum':
        obj.shape_key_add(name='Basis')
        pulse=obj.shape_key_add(name='membranePulse')
        for vertex in pulse.data:
            x,y,z=vertex.co
            radius=math.hypot(x,y)
            weight=min(1,max(0,(radius-.5)/.8))*min(1,max(0,(z-.2)/.5))
            stretch=1+.045*math.sin(math.atan2(y,x)*3+z)*weight
            vertex.co.x*=stretch
            vertex.co.y*=stretch
    if kind=='alveolar-septum':
        diffuse=set()
        for mat in obj.data.materials:
            if mat.use_nodes:
                for node in mat.node_tree.nodes:
                    if node.type=='BSDF_PRINCIPLED':
                        for link in node.inputs['Base Color'].links:
                            if link.from_node.type=='TEX_IMAGE': diffuse.add(link.from_node.image)
        for image in diffuse:
            pixels=list(image.pixels[:])
            for i in range(0,len(pixels),4):
                for channel in range(3):pixels[i+channel]=pixels[i+channel]*.65+.25
            image.pixels[:]=pixels;image.pack()
    textures=[]
    for image in bpy.data.images:
        if image.size[0]<=0 or image.type!='IMAGE': continue
        size=512
        ratio=min(1,size/max(image.size))
        image.scale(max(1,int(image.size[0]*ratio)),max(1,int(image.size[1]*ratio)))
        image.pack()
        textures.append({'name':image.name,'width':image.size[0],'height':image.size[1]})
    obj.name=kind+'-membrane' if kind!='alveolar-septum' else 'alveolar-septum-tile'
    path=target/(kind+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path.resolve()),export_format='GLB',use_selection=True,
        export_animations=False,export_morph=True,export_morph_normal=True,export_yup=True,
        export_image_format='AUTO',export_cameras=False,export_lights=False)
    glb=path.read_bytes(); exported=json.loads(glb[20:20+struct.unpack_from('<I',glb,12)[0]])
    used_images={i.get('name') for i in exported.get('images',[])}
    textures=[t for t in textures if t['name'] in used_images]
    audit.append({'asset':kind,'triangles':len(obj.data.polygons),'materials':len(obj.data.materials),
        'textures':textures,'dimensionsXYZ':dimensions,'bytes':path.stat().st_size,
        'morphTargets':0 if kind=='alveolar-septum' else 1})
previous=json.loads((target/'manifest.json').read_text()) if (target/'manifest.json').exists() else {'assets':[]}
updated={x['asset'] for x in audit}
audit=[x for x in previous['assets'] if x['asset'] not in updated]+audit
(target/'manifest.json').write_text(json.dumps({'source':'TripoAI v3.1; approved samples plus sixteen-asset expansion; offline web adapters','assets':audit},indent=2)+'\n')
print(json.dumps(audit))
