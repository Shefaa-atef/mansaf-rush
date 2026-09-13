"""Blender authoring source: closed hand surface, continuous poses, red tatreez.
Run Blender --background --python tools/build_continuous_arm.py -- --render-review.
"""
import bpy, bmesh, math, json
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
REVIEW=ROOT/'output/playwright';REVIEW.mkdir(parents=True,exist_ok=True)
scene=bpy.data.scenes.new('Continuous hand and red tatreez')
bpy.context.window.scene=scene
def material(name,color,roughness):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=m.diffuse_color;b.inputs['Roughness'].default_value=roughness
 return m
skin=material('Warm apricot skin',(.68,.34,.155),.56)
cloth=material('Black woven thobe',(.014,.012,.013),.92)
red=material('Crimson cuff edge',(.24,.012,.019),.86)
cuffmat=material('Red black tatreez embroidery',(.15,.015,.025),.84)
parts=[]
def ellipsoid(center,radii):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=24,location=center)
 ob=bpy.context.object;ob.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);parts.append(ob);return ob
def capsule(a,b,r,endr):
 a,b=Vector(a),Vector(b)
 for i in range(12):
  t=i/11;radius=r*(1-t)+endr*t;ellipsoid(a.lerp(b,t),(radius,radius*.91,radius))
# Deep overlapping volumes are remeshed, never exported as separate fingers.
hand=ellipsoid((0,0,.045),(.163,.081,.198))
ellipsoid((0,-.001,.224),(.084,.064,.12))
fingers=[(-.125,-.086,.176,.0375),(-.043,-.11,.219,.0395),(.044,-.115,.243,.0405),(.127,-.095,.209,.0395)]
for x,root,length,r in fingers:
 capsule((x,0,root+.062),(x,0,root-length+.025),r,r*.89)
capsule((.107,.003,.107),(.248,.006,-.025),.058,.043)
bpy.ops.object.select_all(action='DESELECT')
for ob in parts:ob.select_set(True)
bpy.context.view_layer.objects.active=hand;bpy.ops.object.join();hand.name='HandSkin'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
mod=hand.modifiers.new('One watertight skin volume','REMESH');mod.mode='VOXEL';mod.voxel_size=.003;mod.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=mod.name)
mod=hand.modifiers.new('Soft finger webs','SMOOTH');mod.factor=1;mod.iterations=35;bpy.ops.object.modifier_apply(modifier=mod.name)
mod=hand.modifiers.new('Runtime surface','DECIMATE');mod.ratio=.10;bpy.ops.object.modifier_apply(modifier=mod.name)
mod=hand.modifiers.new('Smooth silhouette','SUBSURF');mod.levels=1;bpy.ops.object.modifier_apply(modifier=mod.name)
for p in hand.data.polygons:p.use_smooth=True
hand.data.materials.append(skin)
# Verify connectivity and watertightness rather than relying on object count.
bm=bmesh.new();bm.from_mesh(hand.data);pending=set(bm.verts);components=[]
while pending:
 stack=[pending.pop()];count=0
 while stack:
  v=stack.pop();count+=1
  for e in v.link_edges:
   other=e.other_vert(v)
   if other in pending:pending.remove(other);stack.append(other)
 components.append(count)
boundary=sum(not e.is_manifold for e in bm.edges);bm.free()
assert len(components)==1 and boundary==0,(components,boundary)
base=np.array([v.co[:] for v in hand.data.vertices],dtype=np.float64)
def ease(t):
 t=np.clip(t,0,1);return t*t*(3-2*t)
def posed(bend,thumb_bend,cup):
 result=base.copy();x,y,z=base.T
 centers=np.array([f[0] for f in fingers])
 weights=np.exp(-((x[:,None]-centers[None,:])/.038)**4)
 weights/=np.maximum(weights.sum(axis=1,keepdims=True),1e-20)
 displacement=np.zeros_like(base)
 for i,(cx,root,length,r) in enumerate(fingers):
  start=-.045;distance=np.maximum(0,start-z);reach=start-(root-length+.025)
  grid=np.linspace(0,reach+.06,320)
  finger_bend=bend[i] if isinstance(bend,(list,tuple)) else bend*(1+.05*(3-i))
  angle=finger_bend*ease(grid/(reach*.95));step=grid[1]-grid[0]
  forward=np.cumsum(np.cos(angle))*step-step;upward=np.cumsum(np.sin(angle))*step
  theta=np.interp(distance,grid,angle)
  yy=np.interp(distance,grid,upward)+y*np.cos(theta)
  zz=start-np.interp(distance,grid,forward)+y*np.sin(theta)
  active=ease(distance/.075)
  displacement[:,1]+=weights[:,i]*active*(yy-y)
  displacement[:,2]+=weights[:,i]*active*(zz-z)
 thumb_weight=ease((x-.155)/.065)*ease((z+.095)/.075)
 result+=displacement*(1-thumb_weight[:,None])
 # Bend the thumb along its diagonal centerline; rotating by X position
 # flattened its tip because opposite sides received different rotations.
 dx=x-.12;dz=z-.08
 distance=np.maximum(0,dx*.73-dz*.684)
 lateral=dx*.684+dz*.73
 grid=np.linspace(0,.25,320);angle=thumb_bend*.85*ease(grid/.17);step=grid[1]-grid[0]
 forward=np.cumsum(np.cos(angle))*step-step;upward=np.cumsum(np.sin(angle))*step
 theta=np.interp(distance,grid,angle);along=np.interp(distance,grid,forward)-y*np.sin(theta)
 tx=.12+along*.73+lateral*.684;tz=.08-along*.684+lateral*.73
 ty=np.interp(distance,grid,upward)+y*np.cos(theta)
 result[:,0]+=(tx-x)*thumb_weight
 result[:,1]+=(ty-y)*thumb_weight
 result[:,2]+=(tz-z)*thumb_weight
 result[:,1]+=cup*.016*(x/.17)**2*np.exp(-((z-.005)/.14)**4)
 return result
poses={'OPEN':(.20,.10,.08),'GATHER':(1.05,.38,.3),'CUP':(1.45,.65,.8),'ROLL_LEFT':(1.95,.95,1),'ROLL_RIGHT':(1.8,.85,.95),'HOLD_LOKMA':(1.70,.86,.9),'EAT':(2.05,1.05,.95)}
poses.update({
 'REACH':([.42,.28,.16,.22],.14,.12),
 'SCOOP_START':([1.25,.90,.45,.32],.30,.35),
 'SCOOP_CLOSE':([1.8,1.65,1.45,1.25],.80,.80),
 'RELEASE':([.65,.43,.20,.18],.20,.20),
 'KNEAD_A':([2.25,2.0,1.55,1.25],1.05,1),
 'KNEAD_B':([1.4,1.65,2.0,2.15],.75,.85),
})
def coords(p):return np.column_stack((p[:,0],-p[:,2],p[:,1])).astype(np.float32)
hand.data.vertices.foreach_set('co',coords(posed(*poses['OPEN'])).ravel())
hand.shape_key_add(name='Basis')
for name,values in poses.items():
 if name=='OPEN':continue
 key=hand.shape_key_add(name=name);key.data.foreach_set('co',coords(posed(*values)).ravel());key.value=0
# Bring the soft fingertip pads together for eating while leaving the palm intact.
pinch=posed([2.20,2.15,2.10,2.15],1.05,.9)
x,y,z=base.T
tip=ease((-z-.13)/.13)
finger_weights=np.exp(-((x[:,None]-np.array([f[0] for f in fingers])[None,:])/.038)**4)
finger_weights/=np.maximum(finger_weights.sum(axis=1,keepdims=True),1e-20)
for i,(cx,root,length,r) in enumerate(fingers):
 mask=(np.abs(x-cx)<.02)&(z<root-length+.05)
 center=pinch[mask].mean(axis=0)
 target=np.array([-.05+i*.048,.185+(1-abs(i-1.5)/1.5)*.015,-.15])
 pinch+=(target-center)[None,:]*(finger_weights[:,i]*tip)[:,None]
thumb=ease((x-.17)/.06)*ease((z+.095)/.06)
thumb_center=pinch[x>.25].mean(axis=0)
pinch+=(np.array([.11,.16,-.12])-thumb_center)[None,:]*thumb[:,None]*.85
key=hand.shape_key_add(name='EAT_PINCH');key.data.foreach_set('co',coords(pinch).ravel());key.value=0
hand.data.update()
def tube(name,z0,z1,rows,sides,radius,mat):
 vs=[];fs=[]
 for j in range(rows+1):
  t=j/rows
  for i in range(sides):
   a=i/sides*math.tau;r=radius(t,a);vs.append((r*math.cos(a),-(z0+(z1-z0)*t),r*.88*math.sin(a)))
   if j:fs.append(((j-1)*sides+i,(j-1)*sides+(i+1)%sides,j*sides+(i+1)%sides,j*sides+i))
 data=bpy.data.meshes.new(name);data.from_pydata(vs,[],fs);data.update()
 ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);data.materials.append(mat)
 uv=data.uv_layers.new(name='Woven UV')
 for p in data.polygons:
  p.use_smooth=True;row=p.index//sides;col=p.index%sides
  for k,li in enumerate(p.loop_indices):uv.data[li].uv=((col+(k in (1,2)))/sides,(row+(k>=2))/rows)
 return ob
tube('Sleeve',.425,2.25,80,80,lambda t,a:.106+.055*float(ease(t))+.0025*math.sin(t*22+a*2)*math.sin(math.pi*t)**2,cloth)
tube('EmbroideredCuff',.25,.45,16,96,lambda t,a:.105+.004*math.sin(t*math.pi),cuffmat)
for z in [.248,.257,.437,.448]:tube('CuffPiping_'+str(z),z,z+.005,3,96,lambda t,a:.106,cloth if z in [.248,.448] else red)
# Red stepped diamond embroidery, ivory accents and narrow crimson borders.
W,H=2048,1024;yy,xx=np.mgrid[0:H,0:W];u=xx/W;v=yy/H
gx=np.floor(((u*8)%1)*40)/40;gy=np.floor(v*48)/48
diamond=np.abs(gx-.5)*2+np.abs(gy-.5)*2.9
rgb=np.zeros((H,W,4),dtype=np.float32);rgb[:]=(.038,.023,.027,1)
def paint(mask,color):rgb[mask,:3]=color
crimson=(.57,.055,.095);scarlet=(.73,.11,.15);ivory=(.80,.65,.44)
paint((diamond>.70)&(diamond<.96),crimson);paint((diamond>.42)&(diamond<.58),scarlet)
paint((diamond>.20)&(diamond<.30),ivory);paint(diamond<.10,scarlet)
paint((v<.11)|(v>.89),crimson);paint((v<.035)|(v>.965),(.02,.012,.016))
paint(((v>.065)&(v<.078))|((v>.922)&(v<.935)),ivory)
paint((np.abs(((u*16)%1)-.5)<.085)&(((v>.14)&(v<.20))|((v>.80)&(v<.86))),ivory)
rgb[:,:,:3]*=(.86+.14*np.sin(xx*math.pi/3)*np.sin(yy*math.pi/3))[:,:,None]
img=bpy.data.images.new('2048px crimson black tatreez',width=W,height=H);img.pixels.foreach_set(rgb.ravel());img.pack()
nt=cuffmat.node_tree;tex=nt.nodes.new('ShaderNodeTexImage');tex.image=img
nt.links.new(tex.outputs['Color'],nt.nodes.get('Principled BSDF').inputs['Base Color'])
bpy.ops.object.select_all(action='DESELECT')
for ob in scene.objects:
 if ob.type=='MESH':ob.select_set(True)
bpy.context.view_layer.objects.active=hand
bpy.ops.export_scene.gltf(filepath=str(ROOT/'src/assets/mansaf-player-arm-v6.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_morph=True,export_animations=False)
(REVIEW/'arm-topology.json').write_text(json.dumps({'components':components,'non_manifold_edges':boundary,'vertices':len(base),'texture':[W,H],'poses':list(poses)},indent=2))
def aim(ob,point):ob.rotation_euler=(Vector(point)-ob.location).to_track_quat('-Z','Y').to_euler()
world=bpy.data.worlds.new('Hand studio');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.10,.12,.14,1)
bpy.ops.object.camera_add(location=(.48,1.15,1.55));cam=bpy.context.object;aim(cam,(.025,-.13,0));cam.data.type='ORTHO';cam.data.ortho_scale=1.05;scene.camera=cam
for loc,energy,size in [((-.7,.8,2),90,1.4),((1,-.4,.7),50,1.2)]:
 bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=energy;light.data.shape='DISK';light.data.size=size;aim(light,(0,0,0))
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=1400;scene.render.resolution_y=1400;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'output/mansaf-player-arm-v6.blend'),copy=True)
if '--render-review' in __import__('sys').argv:
 for name in ['OPEN','GATHER','HOLD_LOKMA']:
  for k in hand.data.shape_keys.key_blocks[1:]:k.value=1 if k.name==name else 0
  scene.render.filepath=str(REVIEW/('arm-v6-'+name.lower()+'.png'));bpy.ops.render.render(write_still=True)
print('Continuous hand complete:',len(base),'vertices; one closed component')
