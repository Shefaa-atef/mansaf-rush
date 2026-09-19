import * as THREE from 'three';
import pattern1Url from './assets/pattern 1.png';
import pattern2Url from './assets/pattern 2.png';
import pattern3Url from './assets/pattern 3.png';

function canvasTexture(draw: (ctx: CanvasRenderingContext2D) => void, repeats: [number, number] = [1, 1]) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  draw(canvas.getContext('2d')!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeats); texture.anisotropy = 8;
  return texture;
}

export function textile(repeats: [number, number] = [2, 1], refined = false) {
  return canvasTexture(ctx => {
    ctx.fillStyle = refined ? '#74363a' : '#86282e'; ctx.fillRect(0, 0, 512, 512);
    const diamond = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + w, y); ctx.lineTo(x, y + h); ctx.lineTo(x - w, y); ctx.closePath(); ctx.fill();
    };
    for (const y of [16, 240, 272, 496]) { ctx.fillStyle = refined ? '#b59a7c' : '#c5a178'; ctx.fillRect(0, y, 512, 5); }
    for (const y of [32, 224, 288, 480]) { ctx.fillStyle = refined ? '#343130' : '#29292a'; ctx.fillRect(0, y, 512, 12); }
    for (const y of [70, 186, 326, 442]) for (let x = 0; x < 512; x += 32) {
      diamond(x, y, 11, 15, '#d2b085'); diamond(x, y, 4, 6, '#4b4b40');
    }
    for (const y of [128, 384]) for (let x = 0; x <= 512; x += 128) {
      diamond(x, y, 53, 76, '#302d2a'); diamond(x, y, 40, 59, '#a57d60');
      diamond(x, y, 27, 43, '#a33b35'); diamond(x, y, 14, 26, '#c4a47b'); diamond(x, y, 5, 11, '#424136');
      ctx.fillStyle = '#d2b085';
      for (const side of [-1, 1]) for (let k = 0; k < 4; k++) ctx.fillRect(x + side * (20 + k * 7) - 3, y - 34 + k * 10, 6, 7);
    }
    // Fine weave marks keep the pattern tactile without requiring an image asset.
    ctx.fillStyle = '#f9d1a00b'; for (let i = 0; i < 512; i += 4) ctx.fillRect(i, 0, 1, 512);
    ctx.fillStyle = '#0000000c'; for (let i = 0; i < 512; i += 4) ctx.fillRect(0, i, 512, 1);
  }, repeats);
}

export function minimalTextile(repeats: [number, number] = [2, 1], refined = false) {
  return canvasTexture(ctx => {
    // Rich Sadu Maroon base
    ctx.fillStyle = refined ? '#74363a' : '#86282e';
    ctx.fillRect(0, 0, 512, 512);

    // Clean, minimal accent stripes (top & bottom borders only)
    ctx.fillStyle = '#c5a178';
    ctx.fillRect(0, 24, 512, 4);
    ctx.fillRect(0, 484, 512, 4);

    ctx.fillStyle = '#29292a';
    ctx.fillRect(0, 36, 512, 8);
    ctx.fillRect(0, 468, 512, 8);

    ctx.fillStyle = '#c5a178';
    ctx.fillRect(0, 48, 512, 3);
    ctx.fillRect(0, 461, 512, 3);

    // Subtle fine weave texture for tactile fabric depth
    ctx.fillStyle = '#f9d1a00d';
    for (let i = 0; i < 512; i += 4) ctx.fillRect(i, 0, 1, 512);
    ctx.fillStyle = '#00000010';
    for (let i = 0; i < 512; i += 4) ctx.fillRect(0, i, 512, 1);
  }, repeats);
}

export function loadTexturePattern(url: string, repeatS = 1, repeatT = 1) {
  const texture = new THREE.TextureLoader().load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatS, repeatT);
  texture.anisotropy = 8;
  return texture;
}

export function cushionPattern(repeats: [number, number] = [3, 1.5]) {
  return loadTexturePattern(pattern1Url, repeats[0], repeats[1]);
}

export function rugPattern(repeats: [number, number] = [4, 4]) {
  return loadTexturePattern(pattern2Url, repeats[0], repeats[1]);
}

export function wallRugPattern(repeats: [number, number] = [1, 1]) {
  return loadTexturePattern(pattern1Url, repeats[0], repeats[1]);
}

export function keffiyeh() {
  return canvasTexture(ctx => {
    ctx.fillStyle = '#fff0da'; ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#b52632'; ctx.lineWidth = 8;
    for (let row = -1; row < 10; row++) for (let col = -1; col < 10; col++) {
      const x = col * 64 + (row % 2) * 32, y = row * 56;
      ctx.beginPath(); ctx.moveTo(x - 23, y - 10); ctx.lineTo(x - 12, y - 19); ctx.lineTo(x, y - 9); ctx.lineTo(x + 13, y - 19); ctx.lineTo(x + 26, y - 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 23, y + 7); ctx.lineTo(x - 12, y + 17); ctx.lineTo(x, y + 7); ctx.lineTo(x + 13, y + 17); ctx.lineTo(x + 26, y + 7); ctx.stroke();
      ctx.fillStyle = '#bf3039'; ctx.fillRect(x - 4, y - 5, 8, 10);
    }
  }, [2, 1.5]);
}
