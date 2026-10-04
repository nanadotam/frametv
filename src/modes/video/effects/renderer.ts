import { FRAGMENT_SHADERS, VERTEX_SHADER, type VideoEffect } from './shaders';

/** Longest canvas edge we render at — effects are soft by nature, and this
 *  keeps 4K TVs from pushing 4× the fragments for no visible gain. */
const MAX_EDGE = 1920;
/** Effects animate at film/TV rates; no need to burn 60 fps of GPU. */
const FRAME_MS = 1000 / 30;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('createShader failed');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return sh;
}

/**
 * Draws a <video> through one of the effect shaders onto a canvas every
 * frame. Throws from the constructor if WebGL is unavailable; calls
 * `onFail` later if drawing breaks (e.g. a cross-origin video without CORS,
 * or a lost context) so the caller can fall back to the plain element.
 */
export class EffectRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private tex: WebGLTexture;
  private uRes: WebGLUniformLocation | null;
  private uVid: WebGLUniformLocation | null;
  private uTime: WebGLUniformLocation | null;
  private raf = 0;
  private last = 0;
  private start = performance.now();
  private disposed = false;
  private drewFirst = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private video: HTMLVideoElement,
    effect: VideoEffect,
    private onFail: (err: unknown) => void,
    private onFirstFrame?: () => void
  ) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;

    const program = gl.createProgram();
    if (!program) throw new Error('createProgram failed');
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADERS[effect]));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`);
    }
    gl.useProgram(program);
    this.program = program;

    // Full-screen triangle strip
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    if (!tex) throw new Error('createTexture failed');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // NPOT-safe params for WebGL 1
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    this.tex = tex;

    gl.uniform1i(gl.getUniformLocation(program, 'uTex'), 0);
    this.uRes = gl.getUniformLocation(program, 'uRes');
    this.uVid = gl.getUniformLocation(program, 'uVid');
    this.uTime = gl.getUniformLocation(program, 'uTime');

    canvas.addEventListener('webglcontextlost', this.handleLost);
    this.raf = requestAnimationFrame(this.tick);
  }

  private handleLost = (e: Event) => {
    e.preventDefault();
    this.fail(new Error('WebGL context lost'));
  };

  private fail(err: unknown) {
    if (this.disposed) return;
    this.dispose();
    this.onFail(err);
  }

  private resize() {
    const { canvas } = this;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth * dpr;
    const ch = canvas.clientHeight * dpr;
    const scale = Math.min(1, MAX_EDGE / Math.max(cw, ch, 1));
    const w = Math.max(1, Math.round(cw * scale));
    const h = Math.max(1, Math.round(ch * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  private tick = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    if (now - this.last < FRAME_MS) return;
    this.last = now;

    const { gl, video } = this;
    if (video.readyState < 2 || !video.videoWidth) return;

    try {
      this.resize();
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      // Throws SecurityError for a cross-origin video served without CORS
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
      gl.uniform2f(this.uRes, this.canvas.width, this.canvas.height);
      gl.uniform2f(this.uVid, video.videoWidth, video.videoHeight);
      gl.uniform1f(this.uTime, (now - this.start) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!this.drewFirst) {
        this.drewFirst = true;
        this.onFirstFrame?.();
      }
    } catch (err) {
      this.fail(err);
    }
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('webglcontextlost', this.handleLost);
    this.gl.deleteTexture(this.tex);
    this.gl.deleteProgram(this.program);
    // Free the context now rather than waiting for GC — crossfades create
    // a new one per clip and browsers cap live contexts (~16).
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
