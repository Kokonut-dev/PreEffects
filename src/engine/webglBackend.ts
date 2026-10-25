// WebGL2 Hardware Viewport Shader Presenter + Automatic Canvas2D Fallback

export interface ViewportSnapshotFrame {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}

const VERT_SRC = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uMainTex;
uniform sampler2D uSnapTex;
uniform float uWipeSplit;
uniform int uHasSnap;
uniform int uCheckerboard;
out vec4 fragColor;
void main() {
  vec4 col = (uHasSnap == 1 && vUv.x < uWipeSplit) ? texture(uSnapTex, vUv) : texture(uMainTex, vUv);
  if (uCheckerboard == 1 && col.a < 0.999) {
    vec2 cell = floor(gl_FragCoord.xy / 12.0);
    float checker = mod(cell.x + cell.y, 2.0);
    vec3 bg = mix(vec3(0.14), vec3(0.20), checker);
    col.rgb = mix(bg, col.rgb, col.a);
    col.a = 1.0;
  }
  fragColor = col;
}`;

/**
 * Pure helper exposed for unit-testing Software Canvas2D checkerboard + A/B snapshot compositing (BUG-R4-02).
 */
export function compositeSoftwareViewportPixels(
  srcPixels: Uint8ClampedArray,
  dstPixels: Uint8ClampedArray,
  w: number,
  h: number,
  checkerboard: boolean,
  snapshot?: ViewportSnapshotFrame | null,
  wipeSplit01 = 0,
): void {
  dstPixels.set(srcPixels);
  const validSnap = Boolean(
    snapshot &&
    snapshot.width > 0 &&
    snapshot.height > 0 &&
    snapshot.pixels.length === snapshot.width * snapshot.height * 4 &&
    wipeSplit01 > 0.005,
  );
  if (validSnap && snapshot) {
    const splitX = Math.floor(w * wipeSplit01);
    const sw = snapshot.width;
    const sh = snapshot.height;
    for (let y = 0; y < h; y++) {
      const sy = Math.min(sh - 1, ((y * sh) / h) | 0);
      for (let x = 0; x < splitX; x++) {
        const sx = Math.min(sw - 1, ((x * sw) / w) | 0);
        const so = (sy * sw + sx) * 4;
        const o = (y * w + x) * 4;
        dstPixels[o] = snapshot.pixels[so];
        dstPixels[o + 1] = snapshot.pixels[so + 1];
        dstPixels[o + 2] = snapshot.pixels[so + 2];
        dstPixels[o + 3] = snapshot.pixels[so + 3];
      }
    }
  }

  // BUG-R4-02 Fixed: Software Canvas2D checkerboard compositing for transparent pixels
  if (checkerboard) {
    for (let y = 0; y < h; y++) {
      const cy = (y / 12) | 0;
      const rowOff = y * w * 4;
      for (let x = 0; x < w; x++) {
        const o = rowOff + (x << 2);
        const a = dstPixels[o + 3];
        if (a < 255) {
          const chk = ((x / 12) | 0) + cy;
          const bg = (chk & 1) ? 51 : 36;
          if (a === 0) {
            dstPixels[o] = bg;
            dstPixels[o + 1] = bg;
            dstPixels[o + 2] = bg;
            dstPixels[o + 3] = 255;
          } else {
            const inv = 255 - a;
            dstPixels[o] = ((dstPixels[o] * a + bg * inv) / 255) | 0;
            dstPixels[o + 1] = ((dstPixels[o + 1] * a + bg * inv) / 255) | 0;
            dstPixels[o + 2] = ((dstPixels[o + 2] * a + bg * inv) / 255) | 0;
            dstPixels[o + 3] = 255;
          }
        }
      }
    }
  }
}

export class ViewportPresenter {
  private gl: WebGL2RenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private mainTex: WebGLTexture | null = null;
  private snapTex: WebGLTexture | null = null;
  private uMainLoc: WebGLUniformLocation | null = null;
  private uSnapLoc: WebGLUniformLocation | null = null;
  private uHasSnapLoc: WebGLUniformLocation | null = null;
  private uWipeLoc: WebGLUniformLocation | null = null;
  private uCheckerLoc: WebGLUniformLocation | null = null;
  private mainTexW = 0;
  private mainTexH = 0;
  private snapTexW = 0;
  private snapTexH = 0;
  private cachedImgData: ImageData | null = null;
  public backendName: 'WebGL2 GPU' | 'Canvas2D Software' = 'Canvas2D Software';

  constructor(private canvas: HTMLCanvasElement, preferGpu = true) {
    if (preferGpu) {
      try {
        const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true });
        if (gl) {
          this.initGl(gl);
        }
      } catch {
        this.gl = null;
      }
    }
  }

  private initGl(gl: WebGL2RenderingContext): void {
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) || 'Shader compile error');
      }
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT_SRC));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG_SRC));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('WebGL2 link failed');
    }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const makeTex = () => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };

    this.gl = gl;
    this.prog = prog;
    this.mainTex = makeTex();
    this.snapTex = makeTex();
    this.uMainLoc = gl.getUniformLocation(prog, 'uMainTex');
    this.uSnapLoc = gl.getUniformLocation(prog, 'uSnapTex');
    this.uHasSnapLoc = gl.getUniformLocation(prog, 'uHasSnap');
    this.uWipeLoc = gl.getUniformLocation(prog, 'uWipeSplit');
    this.uCheckerLoc = gl.getUniformLocation(prog, 'uCheckerboard');
    this.backendName = 'WebGL2 GPU';
  }

  present(
    pixels: Uint8ClampedArray,
    w: number,
    h: number,
    checkerboard: boolean,
    snapshot?: ViewportSnapshotFrame | null,
    wipeSplit01 = 0,
  ): void {
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    const validSnap = Boolean(
      snapshot &&
      snapshot.width > 0 &&
      snapshot.height > 0 &&
      snapshot.pixels.length === snapshot.width * snapshot.height * 4 &&
      wipeSplit01 > 0.005,
    );

    if (this.gl && this.prog && this.mainTex && this.snapTex) {
      const gl = this.gl;
      gl.viewport(0, 0, w, h);
      gl.useProgram(this.prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.mainTex);
      // OPT-R4-07: Allocate once per resolution change, then stream via zero-reallocation texSubImage2D!
      if (this.mainTexW !== w || this.mainTexH !== h) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        this.mainTexW = w;
        this.mainTexH = h;
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      }
      gl.uniform1i(this.uMainLoc, 0);

      if (validSnap && snapshot) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.snapTex);
        if (this.snapTexW !== snapshot.width || this.snapTexH !== snapshot.height) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, snapshot.width, snapshot.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, snapshot.pixels);
          this.snapTexW = snapshot.width;
          this.snapTexH = snapshot.height;
        } else {
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, snapshot.width, snapshot.height, gl.RGBA, gl.UNSIGNED_BYTE, snapshot.pixels);
        }
      }
      gl.uniform1i(this.uSnapLoc, 1);
      gl.uniform1i(this.uHasSnapLoc, validSnap ? 1 : 0);
      gl.uniform1f(this.uWipeLoc, wipeSplit01);
      gl.uniform1i(this.uCheckerLoc, checkerboard ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return;
    }

    // Software 2D Canvas fallback (reuses cached ImageData + composites checkerboard & snapshot)
    const ctx2d = this.canvas.getContext('2d');
    if (!ctx2d) return;
    if (!this.cachedImgData || this.cachedImgData.width !== w || this.cachedImgData.height !== h) {
      this.cachedImgData = ctx2d.createImageData(w, h);
    }
    compositeSoftwareViewportPixels(pixels, this.cachedImgData.data, w, h, checkerboard, snapshot, wipeSplit01);
    ctx2d.putImageData(this.cachedImgData, 0, 0);
  }
}
