import * as THREE from 'three';

// Keep the original skinned meshes and BLINK targets, so the finish follows
// the eyelids and gaze without floating highlights or extra facial geometry.
export function refineCharacterEye(mesh: THREE.Mesh) {
  if (new URLSearchParams(location.search).get('eyes') === 'before') return;
  const geometry = mesh.geometry;
  geometry.computeBoundingBox();
  const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
  const half = geometry.boundingBox!.getSize(new THREE.Vector3()).multiplyScalar(.5);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(i, center.x + (position.getX(i) - center.x) * 1.16,
      center.y + (position.getY(i) - center.y) * 1.06, position.getZ(i));
  }
  for (const target of geometry.morphAttributes.position ?? []) {
    for (let i = 0; i < target.count; i++) {
      target.setXY(i, geometry.morphTargetsRelative ? target.getX(i) * 1.16 : center.x + (target.getX(i) - center.x) * 1.16,
        geometry.morphTargetsRelative ? target.getY(i) * 1.06 : center.y + (target.getY(i) - center.y) * 1.06);
    }
    target.needsUpdate = true;
  }
  half.x *= 1.16; half.y *= 1.06;
  position.needsUpdate = true;
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const material = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: .38, metalness: 0});
  material.onBeforeCompile = shader => {
    shader.uniforms.eyeCenter = {value: center};
    shader.uniforms.eyeHalf = {value: half};
    shader.vertexShader = 'uniform vec3 eyeCenter; uniform vec3 eyeHalf; varying vec3 eyePoint;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\neyePoint = (position - eyeCenter) / eyeHalf;');
    shader.fragmentShader = 'varying vec3 eyePoint;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 p = eyePoint.xy;
      float rim = smoothstep(.62, .96, length(p));
      float lower = 1.0 - smoothstep(-.85, .4, p.y);
      vec3 cocoa = mix(vec3(.038, .016, .009), vec3(.16, .068, .023), lower);
      cocoa = mix(cocoa, vec3(.009, .006, .004), rim);
      float pupil = 1.0 - smoothstep(.32, .48, length(p - vec2(0., .08)));
      cocoa = mix(cocoa, vec3(.006, .004, .003), pupil * .88);
      float front = smoothstep(.1, .45, eyePoint.z);
      float glint = (1.0 - smoothstep(.13, .20, length((p - vec2(-.28, .35)) * vec2(1., 1.12)))) * front;
      float smallGlint = (1.0 - smoothstep(.045, .09, length(p - vec2(.27, -.36)))) * front;
      diffuseColor.rgb *= mix(cocoa, vec3(.92, .84, .67), glint);
      diffuseColor.rgb += smallGlint * vec3(.20, .14, .07);
    `);
  };
  const old = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mesh.material = material;
  old.forEach(m => m.dispose());
}
