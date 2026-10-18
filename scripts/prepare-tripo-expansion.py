"""Offline Blender asset optimization; no network, secrets or paid operations.
blender -b --python scripts/prepare-tripo-expansion.py -- .art-source public/assets/tripo
Optional comma separated ART_ASSETS limits a repair to the named source assets.
"""
import bpy, json, math, pathlib, sys, os, struct
from mathutils import Vector
source,target=map(pathlib.Path,sys.argv[sys.argv.index('--')+1:])
config=json.loads(pathlib.Path('docs/art/tripo-expansion/adapter.json').read_text())
selected=os.environ.get('ART_ASSETS','').split(',')
manifest=target/'manifest.json'
data=json.loads(manifest.read_text())
for item in config:
    kind=item['asset']
    if selected!=[''] and kind not in selected: continue
    path=source/(kind+'.glb')
    if not path.exists(): continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path.resolve()),merge_vertices=True)
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join();obj=bpy.context.object
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    # Source's upright axis is Blender Z. Preserve intended apical/basal orientation.
    coords=[v.co.copy() for v in obj.data.vertices]
    bounds=[(min(p[i] for p in coords),max(p[i] for p in coords)) for i in range(3)]
    if kind in ['epithelial','oral-mucosa','lymph-reticulum']:
        # Flat patch: put shortest dimension vertical, preserve winding parity.
        order=sorted(range(3),key=lambda i:bounds[i][1]-bounds[i][0],reverse=True)
        axes=[order[0],order[1],order[2]]
        odd=sum(axes[i]>axes[j] for i in range(3) for j in range(i+1,3))%2
        for v in obj.data.vertices: v.co=Vector((v.co[axes[0]]*(-1 if odd else 1),v.co[axes[1]],v.co[axes[2]]))
        coords=[v.co.copy() for v in obj.data.vertices]
        bounds=[(min(p[i] for p in coords),max(p[i] for p in coords)) for i in range(3)]
    for v in obj.data.vertices:
        for i in range(3):
            low,high=bounds[i];unit=(v.co[i]-low)/max(1e-6,high-low)
            v.co[i]=(unit-(0 if i==2 else .5))*item['dimensions'][i]+(.08 if i==2 else 0)
    if kind=='lymph-reticulum':
        # Repair angular generated scaffold into smooth open biological fibers.
        # Reuse its material; no new API operation or dense per-frame geometry.
        mats=list(obj.data.materials)
        bpy.data.objects.remove(obj,do_unlink=True)
        curve=bpy.data.curves.new('reticular-fibers','CURVE');curve.dimensions='3D'
        curve.resolution_u=3;curve.bevel_depth=.09;curve.bevel_resolution=1
        points=[(-1.3,-.9),(.9,-.8),(-.6,1.1),(1.3,1.2),(0,0),(-2.5,-1.3),(2.5,-1),( -.8,2),(1.5,2),(0,-2)]
        edges=[(0,1),(0,2),(1,3),(2,3),(0,4),(1,4),(2,4),(3,4),(0,5),(1,6),(2,7),(3,8),(4,9)]
        for k,(a,b) in enumerate(edges):
            spline=curve.splines.new('BEZIER');spline.bezier_points.add(2)
            ax,ay=points[a];bx,by=points[b]
            for j,point in enumerate(spline.bezier_points):
                t=j/2
                point.co=(ax+(bx-ax)*t+math.sin(k*1.7)*.2*math.sin(t*math.pi),ay+(by-ay)*t+math.cos(k*.8)*.2*math.sin(t*math.pi),.25+.10*math.sin(k+j))
                point.handle_left_type=point.handle_right_type='AUTO'
        obj=bpy.data.objects.new('reticulum',curve);bpy.context.collection.objects.link(obj)
        bpy.context.view_layer.objects.active=obj;obj.select_set(True)
        bpy.ops.object.convert(target='MESH');obj=bpy.context.object
        for mat in mats: obj.data.materials.append(mat)
        bpy.ops.object.shade_smooth()
    modifier=obj.modifiers.new('triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=modifier.name)
    if len(obj.data.polygons)>item['faces']:
        modifier=obj.modifiers.new('web-budget','DECIMATE');modifier.ratio=item['faces']/len(obj.data.polygons)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier=obj.modifiers.new('gentle-membrane','SMOOTH');modifier.factor=.4 if kind=='intestinal-villus' else .3;modifier.iterations=12 if kind=='intestinal-villus' else 3
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    for p in obj.data.polygons:p.use_smooth=True
    obj.data.normals_split_custom_set([(0,0,0)]*len(obj.data.loops))
    for mat in obj.data.materials:
        if not mat.use_nodes:continue
        for node in mat.node_tree.nodes:
            if node.type=='BSDF_PRINCIPLED':
                for socket,value in [('Metallic',0),('Roughness',.48)]:
                    for link in list(node.inputs[socket].links): mat.node_tree.links.remove(link)
                    node.inputs[socket].default_value=value
            if node.type=='GROUP' and node.inputs.get('Occlusion'):
                for link in list(node.inputs['Occlusion'].links):mat.node_tree.links.remove(link)
    if item['morph']:
        obj.shape_key_add(name='Basis');pulse=obj.shape_key_add(name='membranePulse')
        for vertex in pulse.data:
            x,y,z=vertex.co;r=math.hypot(x,y)
            weight=min(1,max(0,(r-.5)/.8))*min(1,max(0,(z-.2)/.5))
            stretch=1+.04*math.sin(math.atan2(y,x)*3+z)*weight
            vertex.co.x*=stretch;vertex.co.y*=stretch
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
            if kind=='intestinal-villus':
                # Remove ochre baked lighting; match living mucosa's blush palette.
                luma=sum(pixels[i:i+3])/3
                pixels[i:i+3]=[.79+.16*luma,.53+.23*luma,.60+.22*luma]
            else:
                for channel in range(3): pixels[i+channel]=pixels[i+channel]*.82+.12
        image.pixels[:]=pixels
        image.pack()
    textures=[]
    for image in bpy.data.images:
        if image.size[0]<=0 or image.type!='IMAGE':continue
        ratio=min(1,item['textureSize']/max(image.size))
        image.scale(max(1,int(image.size[0]*ratio)),max(1,int(image.size[1]*ratio)))
        image.pack();textures.append({'name':image.name,'width':image.size[0],'height':image.size[1]})
    obj.name=kind
    output=target/(kind+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(output.resolve()),export_format='GLB',use_selection=True,
       export_animations=False,export_morph=item['morph'],export_morph_normal=item['morph'],export_yup=True,
       export_image_format='AUTO',export_cameras=False,export_lights=False)
    glb=output.read_bytes(); exported=json.loads(glb[20:20+struct.unpack_from('<I',glb,12)[0]])
    used_images={i.get('name') for i in exported.get('images',[])}
    textures=[t for t in textures if t['name'] in used_images]
    data['assets']=[a for a in data['assets'] if a['asset']!=kind]
    data['assets'].append({'asset':kind,'triangles':len(obj.data.polygons),'materials':len(obj.data.materials),
      'textures':textures,'dimensionsXYZ':item['dimensions'],'bytes':output.stat().st_size,'morphTargets':int(item['morph'])})
    manifest.write_text(json.dumps(data,indent=2)+'\n')
    print('PREPARED',kind,output.stat().st_size,len(obj.data.polygons),flush=True)
data['source']='TripoAI v3.1; approved samples plus capped sixteen-asset expansion; offline material, geometry, size and morph adapters'
manifest.write_text(json.dumps(data,indent=2)+'\n')
