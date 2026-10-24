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

export class ViewportPresenter {
  private gl: WebGL2RenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private mainTex: WebGLTexture | null = null;
  private snapTex: WebGLTexture | null = null;
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
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      gl.uniform1i(gl.getUniformLocation(this.prog, 'uMainTex'), 0);

      if (validSnap && snapshot) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.snapTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, snapshot.width, snapshot.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, snapshot.pixels);
      }
      gl.uniform1i(gl.getUniformLocation(this.prog, 'uSnapTex'), 1);
      gl.uniform1i(gl.getUniformLocation(this.prog, 'uHasSnap'), validSnap ? 1 : 0);
      gl.uniform1f(gl.getUniformLocation(this.prog, 'uWipeSplit'), wipeSplit01);
      gl.uniform1i(gl.getUniformLocation(this.prog, 'uCheckerboard'), checkerboard ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return;
    }

    // Software 2D Canvas fallback (supports cross-resolution snapshot UV sampling + checkerboard)
    const ctx2d = this.canvas.getContext('2d');
    if (!ctx2d) return;
    const img = ctx2d.createImageData(w, h);
    img.data.set(pixels);
    if (validSnap && snapshot) {
      const splitX = Math.floor(w * wipeSplit01);
      const sw = snapshot.width;
      const sh = snapshot.height;
      for (let y = 0; y < h; y++) {
        const sy = Math.min(sh - 1, Math.floor((y / h) * sh));
        for (let x = 0; x < splitX; x++) {
          const sx = Math.min(sw - 1, Math.floor((x / w) * sw));
          const so = (sy * sw + sx) * 4;
          const o = (y * w + x) * 4;
          img.data[o] = snapshot.pixels[so];
          img.data[o + 1] = snapshot.pixels[so + 1];
          img.data[o + 2] = snapshot.pixels[so + 2];
          img.data[o + 3] = snapshot.pixels[so + 3];
        }
      }
    }
    ctx2d.putImageData(img, 0, 0);
  }
}
