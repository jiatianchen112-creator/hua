import { Bloom, Particle, Vector2 } from './visuals';

type Rgba = [number, number, number, number];

const TWO_PI = Math.PI * 2;

const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec4 a_color;
attribute float a_pointSize;
uniform vec2 u_resolution;
varying vec4 v_color;

void main() {
  vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
  gl_PointSize = a_pointSize;
  v_color = a_color;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform float u_usePointShape;
varying vec4 v_color;

void main() {
  if (u_usePointShape > 0.5) {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) {
      discard;
    }
    float glow = smoothstep(0.5, 0.0, dist);
    float core = smoothstep(0.18, 0.0, dist);
    gl_FragColor = vec4(v_color.rgb, v_color.a * (0.3 * glow + 0.7 * core));
  } else {
    gl_FragColor = v_color;
  }
}
`;

export class WebGLRenderer {
  private readonly gl: WebGLRenderingContext;
  private readonly program: WebGLProgram;
  private readonly positionBuffer: WebGLBuffer;
  private readonly colorBuffer: WebGLBuffer;
  private readonly pointSizeBuffer: WebGLBuffer;
  private readonly positionLocation: number;
  private readonly colorLocation: number;
  private readonly pointSizeLocation: number;
  private readonly resolutionLocation: WebGLUniformLocation;
  private readonly usePointShapeLocation: WebGLUniformLocation;
  private width = 1;
  private height = 1;
  private dpr = 1;

  constructor(private readonly canvas: HTMLCanvasElement, maxDpr: number) {
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false,
    });

    if (!gl) {
      throw new Error('WebGL is not supported');
    }

    this.gl = gl;
    this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
    this.positionBuffer = this.createBuffer();
    this.colorBuffer = this.createBuffer();
    this.pointSizeBuffer = this.createBuffer();

    this.positionLocation = gl.getAttribLocation(this.program, 'a_position');
    this.colorLocation = gl.getAttribLocation(this.program, 'a_color');
    this.pointSizeLocation = gl.getAttribLocation(this.program, 'a_pointSize');

    const resolutionLocation = gl.getUniformLocation(this.program, 'u_resolution');
    if (!resolutionLocation) {
      throw new Error('Missing WebGL resolution uniform');
    }
    this.resolutionLocation = resolutionLocation;

    const usePointShapeLocation = gl.getUniformLocation(this.program, 'u_usePointShape');
    if (!usePointShapeLocation) {
      throw new Error('Missing WebGL point-shape uniform');
    }
    this.usePointShapeLocation = usePointShapeLocation;

    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    this.resize(maxDpr);
  }

  resize(maxDpr: number) {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.useProgram(this.program);
    this.gl.uniform2f(this.resolutionLocation, this.width, this.height);
  }

  clear() {
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  drawGrid(time: number) {
    const gridSize = 100;
    const tx = (time * 0.1) % gridSize;
    const ty = (time * 0.2) % gridSize;
    const vertices: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];

    for (let x = tx; x < this.width; x += gridSize) {
      this.pushLine(vertices, colors, sizes, x, 0, x, this.height, [0.58, 0.39, 0.78, 0.12]);
    }
    for (let y = ty; y < this.height; y += gridSize) {
      this.pushLine(vertices, colors, sizes, 0, y, this.width, y, [0.58, 0.39, 0.78, 0.12]);
    }

    this.drawArrays(this.gl.LINES, vertices, colors, sizes);
  }

  drawVine(points: Vector2[]) {
    if (points.length < 2) return;

    const vertices: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];

    for (let i = 1; i < points.length; i++) {
      const alpha = i / points.length;
      this.pushLine(
        vertices,
        colors,
        sizes,
        points[i - 1].x,
        points[i - 1].y,
        points[i].x,
        points[i].y,
        [1, 0.24, 1, 0.16 * alpha],
      );
      this.pushLine(
        vertices,
        colors,
        sizes,
        points[i - 1].x,
        points[i - 1].y,
        points[i].x,
        points[i].y,
        [1, 0.68, 1, 0.65 * alpha],
      );
    }

    this.drawArrays(this.gl.LINES, vertices, colors, sizes);
  }

  drawBlooms(blooms: Bloom[]) {
    if (blooms.length === 0) return;

    const vertices: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];

    for (const bloom of blooms) {
      this.pushBloom(vertices, colors, sizes, bloom);
    }

    this.drawArrays(this.gl.TRIANGLES, vertices, colors, sizes);

    const points: number[] = [];
    const pointColors: number[] = [];
    const pointSizes: number[] = [];
    for (const bloom of blooms) {
      const radius = bloom.maxRadius * bloom.easeOutElastic(bloom.progress);
      this.pushPoint(points, pointColors, pointSizes, bloom.x, bloom.y, radius * 0.42, [1, 0.75, 0.3, 0.8]);
    }
    this.drawArrays(this.gl.POINTS, points, pointColors, pointSizes);
  }

  drawParticles(particles: Particle[]) {
    if (particles.length === 0) return;

    const vertices: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];

    for (const particle of particles) {
      if (particle.life <= 0) continue;
      const alpha = particle.life / particle.maxLife;
      const color = particleColor(particle, alpha);
      this.pushPoint(vertices, colors, sizes, particle.x, particle.y, particle.size * 6, color);
    }

    this.drawArrays(this.gl.POINTS, vertices, colors, sizes);
  }

  private pushBloom(vertices: number[], colors: number[], sizes: number[], bloom: Bloom) {
    if (bloom.progress <= 0) return;

    const radius = bloom.maxRadius * bloom.easeOutElastic(bloom.progress);
    const rotation = bloom.rotation + bloom.progress * 0.5;
    const alpha = 0.34 + bloom.progress * 0.2;

    for (let i = 0; i < bloom.petals; i++) {
      const angle = rotation + (TWO_PI / bloom.petals) * i;
      const center = pointAt(bloom.x, bloom.y, angle, radius);
      const left = pointAt(bloom.x, bloom.y, angle - 0.22, radius * 0.55);
      const right = pointAt(bloom.x, bloom.y, angle + 0.22, radius * 0.55);
      const color: Rgba = i % 2 === 0 ? [0.82, 0.48, 1, alpha] : [1, 0.45, 0.86, alpha];

      this.pushTriangle(vertices, colors, sizes, bloom.x, bloom.y, left.x, left.y, center.x, center.y, color);
      this.pushTriangle(vertices, colors, sizes, bloom.x, bloom.y, center.x, center.y, right.x, right.y, color);

      const facetColor: Rgba = [1, 1, 1, 0.18 * bloom.progress];
      this.pushTriangle(
        vertices,
        colors,
        sizes,
        bloom.x,
        bloom.y,
        pointAt(bloom.x, bloom.y, angle - 0.025, radius * 0.95).x,
        pointAt(bloom.x, bloom.y, angle - 0.025, radius * 0.95).y,
        pointAt(bloom.x, bloom.y, angle + 0.025, radius * 0.95).x,
        pointAt(bloom.x, bloom.y, angle + 0.025, radius * 0.95).y,
        facetColor,
      );
    }
  }

  private pushLine(
    vertices: number[],
    colors: number[],
    sizes: number[],
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: Rgba,
  ) {
    vertices.push(x1, y1, x2, y2);
    colors.push(...color, ...color);
    sizes.push(1, 1);
  }

  private pushPoint(
    vertices: number[],
    colors: number[],
    sizes: number[],
    x: number,
    y: number,
    size: number,
    color: Rgba,
  ) {
    vertices.push(x, y);
    colors.push(...color);
    sizes.push(size * this.dpr);
  }

  private pushTriangle(
    vertices: number[],
    colors: number[],
    sizes: number[],
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    color: Rgba,
  ) {
    vertices.push(x1, y1, x2, y2, x3, y3);
    colors.push(...color, ...color, ...color);
    sizes.push(1, 1, 1);
  }

  private drawArrays(mode: number, vertices: number[], colors: number[], sizes: number[]) {
    if (vertices.length === 0) return;

    const gl = this.gl;
    const vertexCount = vertices.length / 2;

    gl.useProgram(this.program);
    gl.uniform1f(this.usePointShapeLocation, mode === gl.POINTS ? 1 : 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STREAM_DRAW);
    gl.enableVertexAttribArray(this.colorLocation);
    gl.vertexAttribPointer(this.colorLocation, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointSizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sizes), gl.STREAM_DRAW);
    gl.enableVertexAttribArray(this.pointSizeLocation);
    gl.vertexAttribPointer(this.pointSizeLocation, 1, gl.FLOAT, false, 0, 0);

    gl.drawArrays(mode, 0, vertexCount);
  }

  private createBuffer() {
    const buffer = this.gl.createBuffer();
    if (!buffer) {
      throw new Error('Failed to create WebGL buffer');
    }
    return buffer;
  }

  private createProgram(vertexSource: string, fragmentSource: string) {
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource);
    const program = this.gl.createProgram();

    if (!program) {
      throw new Error('Failed to create WebGL program');
    }

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      throw new Error(this.gl.getProgramInfoLog(program) || 'Failed to link WebGL program');
    }

    return program;
  }

  private createShader(type: number, source: string) {
    const shader = this.gl.createShader(type);

    if (!shader) {
      throw new Error('Failed to create WebGL shader');
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error(this.gl.getShaderInfoLog(shader) || 'Failed to compile WebGL shader');
    }

    return shader;
  }
}

function particleColor(particle: Particle, alpha: number): Rgba {
  if (particle.type === 'nebula') {
    return particle.color.startsWith('180') ? [0.45, 1, 0.9, alpha * 0.22] : [1, 0.35, 0.95, alpha * 0.24];
  }

  if (particle.type === 'spore') {
    return [1, 0.3, 0.9, alpha * 0.65];
  }

  return [1, 0.75, 0.18, alpha * 0.75];
}

function pointAt(x: number, y: number, angle: number, radius: number): Vector2 {
  return {
    x: x + Math.cos(angle) * radius,
    y: y + Math.sin(angle) * radius,
  };
}
