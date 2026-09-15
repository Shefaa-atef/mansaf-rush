import bpy,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output'/'chibi-refinement';OUT.mkdir(parents=True,exist_ok=True)
SRC=ROOT/'src'/'assets'
for idx,(name,source) in enumerate([('zaid','zaid-studio.glb'),('omar','omar-refined.glb'),('sami','sami-refined.glb')]):
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(SRC/source));rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
 headnames=('Rounded head','Ear','Eye','Double agal','Keffiyeh','Mouth','Tongue','Small rounded nose','Sculpted beard','Moustache','Curl','Hair crown')
 for o in list(bpy.context.scene.objects):
  if o.type!='MESH':continue
  if o.name.startswith(headnames):
   blocks=[k.data for k in o.data.shape_keys.key_blocks] if o.data.shape_keys else [o.data.vertices]
   for block in blocks:
    for v in block:
     v.co.x*=.95;v.co.y*=.98
     if o.name.startswith(('Curl','Hair crown')):v.co.z=1.94+(v.co.z-1.94)*.91
  if o.name.startswith('Eye') and not o.name.startswith('Eyebrow'):
   mat=o.data.materials[0].copy();mat.name='Soft matte cocoa eyes';mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.94;mat.node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=.12;o.data.materials[0]=mat
   center=sum((v.co for v in o.data.vertices),Vector())/len(o.data.vertices)
   blocks=[k.data for k in o.data.shape_keys.key_blocks] if o.data.shape_keys else [o.data.vertices]
   for block in blocks:
    for v in block:v.co.x=center.x+(v.co.x-center.x)*.83;v.co.z=center.z+(v.co.z-center.z)*.72;v.co.y=center.y+(v.co.y-center.y)*.68
  if o.name.startswith('Eyebrow'):
   blocks=[k.data for k in o.data.shape_keys.key_blocks] if o.data.shape_keys else [o.data.vertices]
   center=sum(v.co.z for v in o.data.vertices)/len(o.data.vertices)
   for block in blocks:
    for v in block:v.co.z=center+(v.co.z-center)*.59-.018
 # A continuous sculpted curly hairstyle, retaining Sami's familiar silhouette.
 if idx==2:
  hair=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith(('Curl','Hair crown'))]
  bpy.ops.object.select_all(action='DESELECT')
  for o in hair:o.select_set(True)
  bpy.context.view_layer.objects.active=hair[0];bpy.ops.object.join();o=bpy.context.object;o.name='Sami sculpted curls'
  for mod in list(o.modifiers):o.modifiers.remove(mod)
  rem=o.modifiers.new('Connected curls','REMESH');rem.mode='VOXEL';rem.voxel_size=.018;bpy.ops.object.modifier_apply(modifier=rem.name)
  sm=o.modifiers.new('Soft curl transitions','SMOOTH');sm.factor=.7;sm.iterations=4;bpy.ops.object.modifier_apply(modifier=sm.name)
  o.vertex_groups.clear();group=o.vertex_groups.new(name='head');group.add(list(range(len(o.data.vertices))),1,'REPLACE');mod=o.modifiers.new('Follow head','ARMATURE');mod.object=rig
  for p in o.data.polygons:p.use_smooth=True
 cloth=bpy.data.materials.get('Tailored cotton')
 if idx>0:
  color=[(.0,.0,.0),(.025,.034,.044),(.036,.056,.050)][idx];cloth.diffuse_color=(*color,1);cloth.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=cloth.diffuse_color
 # Quiet woven cloth: muted red diamonds and border bands rather than a tiny high-contrast grid.
 if idx<2:
  scarf=bpy.data.materials.get('Red white woven shemagh');bs=scarf.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.98
  for link in list(scarf.node_tree.links):
   if link.to_node==bs and link.to_socket==bs.inputs['Base Color']:scarf.node_tree.links.remove(link)
  if idx==0:
   image=bpy.data.images.new('Crimson shemagh woven motifs',width=1024,height=1024);pixels=[]
   for y in range(1024):
    for x in range(1024):
     u=x/1024;v=y/1024
     row=int(v*42);tx=(u*36+(row%2)*.5)%1;ty=(v*42)%1
     ix=int(tx*8);iy=int(ty*8)
     motif={(2,1),(3,1),(3,2),(4,2),(4,3),(5,3),(2,3),(3,4),(4,4),(4,5),(5,5),(5,6)}
     red=(ix,iy) in motif
     edge=min(u,1-u,v,1-v)
     if edge<.014:red=.004<edge<.011
     elif edge<.027:red=False
     elif edge<.072:
      q=(u if min(v,1-v)<min(u,1-u) else v)*55
      zig=abs((q%1)*2-1)
      red=abs(((edge-.027)/.045*3)%1-zig)<.24
     elif edge<.082:red=True
     color=(.53,.065,.080) if red else (.94,.89,.79);weave=1-.025*((x+y)%2)
     pixels.extend([color[0]*weave,color[1]*weave,color[2]*weave,1])
   image.pixels.foreach_set(pixels);image.pack();tex=scarf.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;scarf.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
  else:bs.inputs['Base Color'].default_value=(.78,.75,.67,1)
  drape=next(o for o in bpy.context.scene.objects if o.name.startswith('Keffiyeh'))
  for v in drape.data.vertices:
   base=v.index%2597;row=base//49 if idx==0 else -1
   if v.co.z<1.90:
    rear=max(0,min(1,(v.co.y+.08)/.40))
    v.co.z=1.90+(v.co.z-1.90)*(1.03+.48*rear)
   # Pull the front side curtains behind and away from the cheeks.
   front=max(0,1-row/10) if idx==0 else max(0,min(1,(-v.co.y-.10)/.35))*max(0,min(1,(1.95-v.co.z)/.75))
   side=max(0,min(1,(abs(v.co.x)-.20)/.52))
   v.co.x+=math.copysign(.030*front*side,v.co.x if v.co.x else 1)
   v.co.y+=.030*front*side
   # Let the rear hang as a calm fabric plane with shallow vertical folds.
   if (idx==0 and row>=20) or (idx==1 and v.co.y>.18 and v.co.z<1.95):
    target=.505+.012*math.cos(v.co.x*18)*max(0,min(1,(v.co.z-.72)/1.1))
    v.co.y=v.co.y*.25+target*.75
  # Average mirrored points to remove the lopsided balloon shape.
  if idx==0:
   for layer in (0,2597):
    for row in range(18,53):
     outer=(abs(drape.data.vertices[layer+row*49].co.x)+abs(drape.data.vertices[layer+row*49+48].co.x))*.5
     taper=max(0,min(1,(row-20)/32))
     desired=.72*(1-taper**1.08) if row>=20 else outer
     for col in range(24):
      left=drape.data.vertices[layer+row*49+col]
      right=drape.data.vertices[layer+row*49+48-col]
      x=(abs(left.co.x)+abs(right.co.x))*.5
      y=(left.co.y+right.co.y)*.5;z=(left.co.z+right.co.z)*.5
      if outer>.0001:x*=desired/outer
      left.co.x=-x;right.co.x=x;left.co.y=right.co.y=y;left.co.z=right.co.z=z
     center=drape.data.vertices[layer+row*49+24]
     center.co.x=0
  bpy.context.view_layer.objects.active=drape
  sub=drape.modifiers.new('Soft fabric folds','SUBSURF');sub.levels=1;bpy.ops.object.modifier_apply(modifier=sub.name)
  for o in bpy.context.scene.objects:
   if o.name.startswith('Double agal'):
    center=sum((v.co for v in o.data.vertices),Vector())/len(o.data.vertices)
    for v in o.data.vertices:v.co.z=center.z+(v.co.z-center.z)*.80
 # One soft tailored body surface with a clear shoulder and waist silhouette.
 for o in list(bpy.context.scene.objects):
  if o.type=='MESH' and o.name.startswith(('Thobe tapered','Torso underneath')):bpy.data.objects.remove(o,do_unlink=True)
 # Keep only the reference-sheet body proportion change: a longer, softly flared thobe.
 profile=[(.16,.43,.245),(.20,.43,.245),(.48,.415,.24),(.78,.39,.23),(1.02,.365,.22),(1.22,.39,.215),(1.32,.385,.20),(1.40,.27,.15),(1.43,.15,.12)]
 vs=[];faces=[];N=48
 for z,w,d in profile:
  for i in range(N):
   a=2*math.pi*i/N;fold=.004*math.cos(a*10)*(1.45-z)
   vs.append(((w+fold)*math.sin(a),-(d+fold)*math.cos(a),z))
 for j in range(len(profile)-1):
  for i in range(N):a=j*N+i;b=j*N+(i+1)%N;faces.append((a,b,b+N,a+N))
 faces.append(tuple(reversed(range(N))));faces.append(tuple((len(profile)-1)*N+i for i in range(N)))
 me=bpy.data.meshes.new('Soft tailored chibi thobe');me.from_pydata(vs,[],faces);me.update();body=bpy.data.objects.new('Soft tailored chibi thobe',me);bpy.context.collection.objects.link(body);body.data.materials.append(cloth);body.parent=rig
 groups={n:body.vertex_groups.new(name=n) for n in ['pelvis','spine','chest']}
 for i,v in enumerate(body.data.vertices):
  chest=max(0,min(1,(v.co.z-.98)/.25));pelvis=max(0,min(1,(.98-v.co.z)/.25));spine=1-chest-pelvis
  for n,w in [('chest',chest),('pelvis',pelvis),('spine',spine)]:
   if w>0:groups[n].add([i],w,'REPLACE')
 for p in me.polygons:p.use_smooth=True
 sub=body.modifiers.new('Soft tailoring','SUBSURF');sub.levels=2;bpy.context.view_layer.objects.active=body;bpy.ops.object.modifier_apply(modifier=sub.name)
 mod=body.modifiers.new('Body motion','ARMATURE');mod.object=rig
 rig['chibiRefinement']=2
 for o in bpy.context.scene.objects:
  if o.type=='MESH' and o.data.shape_keys:
   for k in o.data.shape_keys.key_blocks:k.value=0
   o.active_shape_key_index=0;o.show_only_shape_key=False
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(name+'-chibi-polished.blend')))
 bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'-chibi-polished.glb')),export_format='GLB',export_animations=False,export_extras=True)
