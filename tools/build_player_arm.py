import bpy, math, os, json
from mathutils import Vector
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
OUT = str(ROOT / 'src' / 'assets')
# Work in a separate scene so the artist's open document stays intact.
scene = bpy.data.scenes.new('Mansaf Player Arm Reference')
bpy.context.window.scene = scene
def smooth(a,b,t):
 t=max(0,min(1,(t-a)/(b-a)));return t*t*(3-2*t)
def mesh(name,vs,fs):
 data=bpy.data.meshes.new(name);data.from_pydata(vs,[],fs);data.update()
 ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob)
 for p in data.polygons:p.use_smooth=True
 return ob
def skinmat(name,color,rough):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=m.diffuse_color;b.inputs['Roughness'].default_value=rough
 return m
skin=skinmat('Warm peach satin skin',(.72,.385,.19),.62)
cloth=skinmat('Midnight charcoal woven cloth',(.018,.026,.027),.92)
gold=skinmat('Antique gold stitching',(.50,.30,.09),.65)
teal=skinmat('Deep teal cuff',(.014,.12,.12),.86)
parts=[]
def ellipsoid(p,s):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=p)
 ob=bpy.context.object;ob.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);parts.append(ob);return ob
# Deliberately flatter palm with taper to the wrist, rather than overlapping balls.
profiles=[(.34,.076,.039),(.26,.081,.042),(.18,.091,.044),(.10,.123,.047),(.025,.149,.049),(-.045,.157,.047),(-.10,.154,.043),(-.14,.139,.028),(-.157,.10,.014)]
vs=[];fs=[];N=40
for j,(z,w,h) in enumerate(profiles):
 for i in range(N):
  a=2*math.pi*i/N;c=math.cos(a);s=math.sin(a)
  x=w*1.02*math.copysign(abs(c)**.88,c);y=h*1.70*math.copysign(abs(s)**.88,s)
  if y>0:y-=.006*math.exp(-(x/.09)**2-((z-.02)/.12)**2)
  vs.append((x,y,z))
  if j:fs.append(((j-1)*N+i,(j-1)*N+(i+1)%N,j*N+(i+1)%N,j*N+i))
fs.append(tuple(reversed(range(N))));fs.append(tuple((len(profiles)-1)*N+i for i in range(N)))
palm=mesh('Palm structure',vs,[tuple(reversed(f)) for f in fs]);parts.append(palm)
fingers=[(-.128,-.095,.19,.041),(-.043,-.125,.235,.045),(.046,-.133,.258,.046),(.132,-.11,.226,.043)]
def digit_tube(start,end,r0,r1):
 start=Vector(start);end=Vector(end);axis=(end-start).normalized()
 side=Vector((0,1,0)).cross(axis).normalized();up=axis.cross(side).normalized()
 verts=[];faces=[];rings=36;sides=24
 for j in range(rings+1):
  t=j/rings;center=start.lerp(end,t)
  cap=math.sqrt(max(.0001,1-((t-.86)/.14)**2)) if t>.86 else 1
  r=(r0*(1-t)+r1*t)*cap
  for i in range(sides):
   a=i/sides*2*math.pi;verts.append(center+side*(r*math.cos(a))+up*(r*.9*math.sin(a)))
   if j:faces.append(((j-1)*sides+i,(j-1)*sides+(i+1)%sides,j*sides+(i+1)%sides,j*sides+i))
 faces.append(tuple(reversed(range(sides))));faces.append(tuple(rings*sides+i for i in range(sides)))
 ob=mesh('Digit surface',verts,faces);parts.append(ob)
for idx,(x,z,L,r) in enumerate(fingers):
 digit_tube((x,0,z+.025),(x,0,z-L),r,r*.80)
# Thumb starts low on the palm, projects sideways, and has two short phalanges.
thumb_start=Vector((.105,.008,.115));thumb_end=Vector((.242,.026,-.047));thumb_axis=(thumb_end-thumb_start).normalized();thumb_len=(thumb_end-thumb_start).length
digit_tube(thumb_start-thumb_axis*.025,thumb_end+thumb_axis*.018,.057,.039)
bpy.ops.object.select_all(action='DESELECT')
for ob in parts:ob.select_set(True)
bpy.context.view_layer.objects.active=palm;bpy.ops.object.join();hand=bpy.context.object;hand.name='HandSkin'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
remesh=hand.modifiers.new('Welded anatomical surface','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.0038;remesh.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=remesh.name)
sm=hand.modifiers.new('Smooth skin','SMOOTH');sm.factor=.7;sm.iterations=5;bpy.ops.object.modifier_apply(modifier=sm.name)
dec=hand.modifiers.new('Runtime topology','DECIMATE');dec.ratio=.42;bpy.ops.object.modifier_apply(modifier=dec.name)
hand.data.materials.append(skin)
hand.data.validate(verbose=True);hand.data.update()
base=[v.co.copy() for v in hand.data.vertices]
poses={'OPEN':(.12,.20,.08,.20),'GATHER':(.40,.65,.24,.42),'CUP':(.43,.65,.22,.60),'ROLL_LEFT':(.55,.95,.28,.9),'ROLL_RIGHT':(.49,.88,.25,.8),'HOLD_LOKMA':(.52,.80,.26,.85),'EAT':(.65,.83,.28,.95)}
def coord(v):return Vector((v[0],-v[2],v[1]))*10
for v in hand.data.vertices:v.co=coord(v.co)
bpy.ops.object.armature_add();rig=bpy.context.object;rig.name='FingerRig'
bpy.ops.object.mode_set(mode='EDIT');rig.data.edit_bones.remove(rig.data.edit_bones[0])
def bone(name,a,b,parent=None):
 ob=rig.data.edit_bones.new(name);ob.head=coord(a);ob.tail=coord(b)
 if parent:ob.parent=rig.data.edit_bones[parent]
 return ob
bone('Palm',(0,0,.34),(0,0,-.10))
for idx,(x,z,L,r) in enumerate(fingers):
 steps=[0,.44,.76,1.0]
 for j in range(3):bone(f'Finger{idx}_{j}',(x,0,z-L*steps[j]),(x,0,z-L*steps[j+1]),'Palm' if j==0 else f'Finger{idx}_{j-1}')
mid=thumb_start.lerp(thumb_end,.53)
bone('Thumb0',thumb_start,mid,'Palm');bone('Thumb1',mid,thumb_end,'Thumb0')
bpy.ops.object.mode_set(mode='OBJECT');bpy.ops.object.select_all(action='DESELECT');hand.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
for v in hand.data.vertices:
 weights=[(g.group,max(0,min(1,g.weight))) for g in v.groups];total=sum(w for _,w in weights)
 if total:
  for group,w in weights:hand.vertex_groups[group].add([v.index],w/total,'REPLACE')
polish=hand.modifiers.new('Pose surface polish','SMOOTH');polish.factor=1.0;polish.iterations=10
posed={}
for name,(mcp,pip,dip,opp) in poses.items():
 for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0)
 for idx in range(4):
  for j,angle in enumerate([mcp+(3-idx)*.024,pip,dip]):rig.pose.bones[f'Finger{idx}_{j}'].rotation_euler.x=angle
 rig.pose.bones['Thumb0'].rotation_euler.x=opp*.50
 rig.pose.bones['Thumb0'].rotation_euler.z=-opp*.18
 rig.pose.bones['Thumb1'].rotation_euler.x=opp*.55
 bpy.context.view_layer.update()
 evaluated=hand.evaluated_get(bpy.context.evaluated_depsgraph_get());data=evaluated.to_mesh()
 posed[name]=[v.co.copy()/10 for v in data.vertices];evaluated.to_mesh_clear()
for mod in list(hand.modifiers):hand.modifiers.remove(mod)
hand.parent=None
rig.hide_render=True;rig.hide_set(True)
for i,v in enumerate(posed['OPEN']):hand.data.vertices[i].co=v
hand.data.update()
hand.shape_key_add(name='Basis')
for i,v in enumerate(posed['OPEN']):hand.data.shape_keys.key_blocks[0].data[i].co=v
for name,values in posed.items():
 if name=='OPEN':continue
 key=hand.shape_key_add(name=name)
 key.value=0
 for i,v in enumerate(values):key.data[i].co=v
for p in hand.data.polygons:p.use_smooth=True
hand.data.validate(verbose=True);hand.data.update()
# Sleeve is a single editable quad surface. The runtime bends this exported mesh.
def tube(name,z0,z1,rows,sides,radius,material):
 vs=[];fs=[]
 for j in range(rows+1):
  t=j/rows;z=z0+(z1-z0)*t
  for i in range(sides):
   a=i/sides*2*math.pi;r=radius(t,a)
   vs.append((r*math.cos(a),-z,r*math.sin(a)*.88))
   if j:fs.append(((j-1)*sides+i,(j-1)*sides+(i+1)%sides,j*sides+(i+1)%sides,j*sides+i))
 ob=mesh(name,vs,fs);ob.data.materials.append(material)
 uv=ob.data.uv_layers.new(name='CuffUV')
 for poly in ob.data.polygons:
  j=(poly.index//sides);i=poly.index%sides
  for k,li in enumerate(poly.loop_indices):uv.data[li].uv=((i+(k in (1,2)))/sides,(j+(k>=2))/rows)
 return ob
sleeve=tube('Sleeve',.425,2.25,64,48,lambda t,a:.105+.055*smooth(0,1,t)+.0035*math.sin(t*27+a*2)*math.sin(math.pi*t)**2,cloth)
cuff=tube('EmbroideredCuff',.25,.45,10,64,lambda t,a:.103+.006*math.sin(math.pi*t),teal)
# Embedded jacquard texture: slim gold chevrons and small ivory diamonds on teal.
W=512;H=256;pixels=[]
for y in range(H):
 v=y/H
 for x in range(W):
  u=x/W;cx=(u*12)%1;cy=(v*3)%1
  color=(.022,.19,.185)
  if v<.06 or v>.94:color=(.028,.055,.059)
  elif .09<v<.12 or .88<v<.91:color=(.7,.5,.22)
  elif abs(abs(cx-.5)*1.4+abs(v-.5)*2-.35)<.035:color=(.72,.53,.26)
  elif abs(cx-.5)+abs(v-.5)*2<.10:color=(.78,.75,.60)
  thread=.90+.10*((x+y)%3)/2
  pixels.extend([*(c*thread for c in color),1])
img=bpy.data.images.new('Teal gold diamond embroidery',width=W,height=H);img.pixels=pixels;img.pack()
nt=teal.node_tree;tex=nt.nodes.new('ShaderNodeTexImage');tex.image=img
nt.links.new(tex.outputs['Color'],nt.nodes.get('Principled BSDF').inputs['Base Color'])
for z in [.248,.267,.432,.450]:tube('CuffPiping_'+str(z),z,z+.006,2,64,lambda t,a:.105, gold if z in [.267,.432] else cloth)
asset=[ob for ob in bpy.context.scene.objects if ob.type=='MESH']
hand['purpose']='Full rounded palm, shorter articulated digits and opposable thumb; full sleeve included.'
hand['coordinates']='Game: palm +Y, fingertips -Z, wrist +Z. Player scale 1.2.'
bpy.ops.object.select_all(action='DESELECT')
for ob in asset:ob.select_set(True)
bpy.context.view_layer.objects.active=hand
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'output' / 'mansaf-player-arm-v5.blend'), copy=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'mansaf-player-arm-v5.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_morph=True,export_animations=False)
print('ASSET',len(hand.data.vertices),'skin vertices')
def aim(ob,p):ob.rotation_euler=(Vector(p)-ob.location).to_track_quat('-Z','Y').to_euler()
world=bpy.data.worlds.new('Arm review world');bpy.context.scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.055,.065,.07,1)
bpy.ops.object.camera_add(location=(.75,1.20,1.6));cam=bpy.context.object;aim(cam,(0,-.23,0));cam.data.type='ORTHO';cam.data.ortho_scale=1.5;bpy.context.scene.camera=cam
for loc,power,size in [((-.7,.6,2),80,1.5),((.9,-.1,.7),35,1.3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);ob=bpy.context.object;ob.data.energy=power;ob.data.shape='DISK';ob.data.size=size;aim(ob,(0,0,0))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=1100;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
for name in ['OPEN','GATHER','HOLD_LOKMA']:
 for key in hand.data.shape_keys.key_blocks[1:]:key.value=1 if key.name==name else 0
 scene.render.filepath=str(ROOT / 'output' / 'playwright' / ('arm-v5-'+name.lower()+'.png'));bpy.ops.render.render(write_still=True)
