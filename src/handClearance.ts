import * as THREE from 'three';

const bounds = new THREE.Box3();
const contact = new THREE.Vector3();

/** Check the posed skin, including fingertips and thumb, against the food below it. */
export function keepHandAboveFood(hand: THREE.Group, heightAt: (x: number, z: number) => number) {
  const anatomy = hand.getObjectByName('hand-anatomy');
  if (!anatomy) return 0;
  hand.updateWorldMatrix(true, true);
  let lift = 0;
  anatomy.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const samples = node.userData.contactVertices as number[] | undefined;
    if (samples) {
      // Use the animated surface, not a rotated bounding-box corner in empty air.
      for (const index of samples) {
        node.getVertexPosition(index, contact).applyMatrix4(node.matrixWorld);
        lift = Math.max(lift, heightAt(contact.x, contact.z) + .018 - contact.y);
      }
      return;
    }
    const geometry = node.geometry as THREE.BufferGeometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    bounds.copy(geometry.boundingBox!).applyMatrix4(node.matrixWorld);
    // The bottom of each posed digit's bounds is a conservative contact surface.
    for (let x = 0; x <= 2; x++) for (let z = 0; z <= 2; z++) {
      const px = THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, x / 2);
      const pz = THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, z / 2);
      lift = Math.max(lift, heightAt(px, pz) + .025 - bounds.min.y);
    }
  });
  hand.position.y += lift;
  hand.updateWorldMatrix(false, true);
  return lift;
}
