import { Composition, Layer, ObjMeshData, Project } from './types';
import { clamp, degToRad, lerp, Mat4, Mat4Array } from '../utils/math';
import { parseHexColor } from '../utils/color';
import { evaluateProperty } from './expressions';
import { separableBoxBlur } from '../effects/kernels';
import { globalBufferPool } from '../utils/bufferPool';

export function computeLayerWorldMatrix(
  layer: Layer,
  comp: Composition,
  time: number,
  project?: Project,
  visited = new Set<string>(),
): Mat4Array {
  if (visited.has(layer.id)) return Mat4.identity();
  visited.add(layer.id);

  const pos = evaluateProperty(layer.transform.position, time, layer, comp, project).value;
  const anc = evaluateProperty(layer.transform.anchorPoint, time, layer, comp, project).value;
  const scl = evaluateProperty(layer.transform.scale, time, layer, comp, project).value;
  const rz = evaluateProperty(layer.transform.rotationZ, time, layer, comp, project).value;

  // Fast direct 2D affine matrix construction (avoids 7 intermediate Float32Array(16) allocations per layer!)
  if (!layer.threeD && !layer.parentId) {
    const rad = degToRad(rz);
    const c = Math.cos(rad), s = Math.sin(rad);
    const sx = scl[0] / 100, sy = scl[1] / 100;
    const m00 = c * sx, m01 = s * sx;
    const m10 = -s * sy, m11 = c * sy;
    const tx = pos[0] - (m00 * anc[0] + m10 * anc[1]);
    const ty = pos[1] - (m01 * anc[0] + m11 * anc[1]);
    return new Float64Array([
      m00, m01, 0, 0,
      m10, m11, 0, 0,
      0, 0, 1, 0,
      tx, ty, 0, 1,
    ]);
  }

  const rx = layer.threeD ? evaluateProperty(layer.transform.rotationX, time, layer, comp, project).value : 0;
  const ry = layer.threeD ? evaluateProperty(layer.transform.rotationY, time, layer, comp, project).value : 0;

  let m = Mat4.translate(pos[0], pos[1], layer.threeD ? pos[2] : 0);
  if (layer.threeD) {
    m = Mat4.multiply(m, Mat4.rotateX(degToRad(rx + (layer.transform.orientation[0] ?? 0))));
    m = Mat4.multiply(m, Mat4.rotateY(degToRad(ry + (layer.transform.orientation[1] ?? 0))));
  }
  m = Mat4.multiply(m, Mat4.rotateZ(degToRad(rz + (layer.threeD ? layer.transform.orientation[2] ?? 0 : 0))));
  m = Mat4.multiply(m, Mat4.scale(scl[0] / 100, scl[1] / 100, (layer.threeD ? scl[2] : 100) / 100));
  m = Mat4.multiply(m, Mat4.translate(-anc[0], -anc[1], layer.threeD ? -anc[2] : 0));

  if (layer.parentId) {
    const parent = comp.layers.find((l) => l.id === layer.parentId);
    if (parent) {
      const pm = computeLayerWorldMatrix(parent, comp, time, project, visited);
      return Mat4.multiply(pm, m);
    }
  }
  return m;
}

export function compute3DLightingFactor(
  layer: Layer,
  comp: Composition,
  layerWorldPos: [number, number, number],
  time: number,
  project?: Project,
): [number, number, number] {
  if (!layer.threeD || layer.material3D?.acceptsLights === false) return [1, 1, 1];
  const lights = comp.layers.filter((l) => l.type === 'light' && l.visible && l.lightSettings);
  if (lights.length === 0) return [1, 1, 1];

  const mat = layer.material3D ?? {
    castsShadows: true, acceptsShadows: true, acceptsLights: true,
    ambient: 25, diffuse: 80, specular: 45, shininess: 32, metal: 20, extrusionDepth: 0,
  };
  let lr = mat.ambient / 100;
  let lg = mat.ambient / 100;
  let lb = mat.ambient / 100;

  for (const light of lights) {
    const ls = light.lightSettings!;
    const [cr, cg, cb] = parseHexColor(ls.color);
    const intensity = ls.intensity / 100;
    if (ls.lightType === 'ambient') {
      lr += (cr / 255) * intensity;
      lg += (cg / 255) * intensity;
      lb += (cb / 255) * intensity;
    } else {
      const lPos = evaluateProperty(light.transform.position, time, light, comp, project).value;
      const dx = lPos[0] - layerWorldPos[0];
      const dy = lPos[1] - layerWorldPos[1];
      const dz = (lPos[2] || -500) - layerWorldPos[2];
      const dist = Math.max(1, Math.hypot(dx, dy, dz));
      const nDotL = Math.max(0.15, Math.abs(dz) / dist);
      const spec = Math.pow(nDotL, Math.max(2, mat.shininess * 0.5)) * (mat.specular / 100);
      const factor = intensity * ((mat.diffuse / 100) * nDotL + spec);
      lr += (cr / 255) * factor;
      lg += (cg / 255) * factor;
      lb += (cb / 255) * factor;
    }
  }
  return [clamp(lr, 0, 2.5), clamp(lg, 0, 2.5), clamp(lb, 0, 2.5)];
}

export function applyCameraDepthOfField(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  layerZ: number,
  activeCamera: Layer | undefined,
  comp: Composition,
  time: number,
  project?: Project,
): void {
  if (!activeCamera?.cameraSettings?.depthOfField) return;
  const camPos = evaluateProperty(activeCamera.transform.position, time, activeCamera, comp, project).value;
  const camZ = camPos[2] || -1200;
  const distToCam = Math.abs(layerZ - camZ);
  const focus = activeCamera.cameraSettings.focusDistance || 1200;
  const coc = (Math.abs(distToCam - focus) / Math.max(100, focus)) *
    (activeCamera.cameraSettings.aperture * 0.08) *
    (activeCamera.cameraSettings.blurLevel / 100);
  const rad = Math.min(24, Math.round(coc));
  if (rad >= 1) {
    const dst = globalBufferPool.acquire(rgba.length, false);
    const scratch = globalBufferPool.acquire(rgba.length, false);
    separableBoxBlur(rgba, dst, scratch, w, h, rad, rad);
    rgba.set(dst);
    globalBufferPool.release(dst);
    globalBufferPool.release(scratch);
  }
}

// Rasterize Imported 3D Wavefront OBJ Mesh into Layer Buffer
export function rasterizeObjMesh3D(
  buf: Uint8ClampedArray,
  w: number,
  h: number,
  mesh: ObjMeshData,
  rotXDeg: number,
  rotYDeg: number,
  rotZDeg: number,
  wireColorHex = '#38BDF8',
): void {
  const [cr, cg, cb] = parseHexColor(wireColorHex);
  const m = Mat4.multiply(
    Mat4.rotateY(degToRad(rotYDeg)),
    Mat4.multiply(Mat4.rotateX(degToRad(rotXDeg)), Mat4.rotateZ(degToRad(rotZDeg))),
  );
  const scale = Math.min(w, h) * 0.28;
  const projected = mesh.vertices.map(([vx, vy, vz]) => {
    const [tx, ty, tz] = Mat4.transformPoint(m, vx, vy, vz);
    const persp = 4 / Math.max(1.2, 4 + tz);
    return [w / 2 + tx * scale * persp, h / 2 - ty * scale * persp] as [number, number];
  });

  const drawEdge = (p0: [number, number], p1: [number, number]) => {
    const steps = Math.max(2, Math.min(400, Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]))));
    for (let s = 0; s <= steps; s++) {
      const px = Math.round(lerp(p0[0], p1[0], s / steps));
      const py = Math.round(lerp(p0[1], p1[1], s / steps));
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const o = (py * w + px) * 4;
        buf[o] = cr; buf[o + 1] = cg; buf[o + 2] = cb; buf[o + 3] = 255;
      }
    }
  };

  for (const face of mesh.faces) {
    for (let i = 0; i < face.length; i++) {
      const a = projected[face[i]];
      const b = projected[face[(i + 1) % face.length]];
      if (a && b) drawEdge(a, b);
    }
  }
}
