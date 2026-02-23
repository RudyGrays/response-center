(function () {
  if (typeof THREE === 'undefined') return;

  var containerIds = ['hero_bg', 'hero_bg_right'];
  var instances = [];
  var clock = new THREE.Clock();
  var MAX_CLICKS = 10;

  var vertexShader = 'void main() { gl_Position = vec4(position, 1.0); }';
  var fragmentShader = [
    'uniform vec2 uResolution;',
    'uniform float uTime;',
    'uniform float uPixelSize;',
    'uniform vec3 uColor;',
    'const int MAX_CLICKS = 10;',
    'uniform vec2 uClickPos[MAX_CLICKS];',
    'uniform float uClickTimes[MAX_CLICKS];',
    'const int SHAPE_TRIANGLE = 2;',
    'out vec4 fragColor;',
    'float Bayer2(vec2 a) { a = floor(a); return fract(a.x / 2. + a.y * a.y * .75); }',
    '#define Bayer4(a) (Bayer2(.5*(a))*0.25 + Bayer2(a))',
    '#define Bayer8(a) (Bayer4(.5*(a))*0.25 + Bayer2(a))',
    '#define FBM_OCTAVES 5',
    '#define FBM_LACUNARITY 1.25',
    '#define FBM_GAIN 1.0',
    '#define FBM_SCALE 4.0',
    'float hash11(float n) { return fract(sin(n)*43758.5453); }',
    'float vnoise(vec3 p) {',
    '  vec3 ip = floor(p); vec3 fp = fract(p);',
    '  float n000 = hash11(dot(ip, vec3(1.0,57.0,113.0)));',
    '  float n100 = hash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0,57.0,113.0)));',
    '  float n010 = hash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0,57.0,113.0)));',
    '  float n110 = hash11(dot(ip + vec3(1.0,1.0,0.0), vec3(1.0,57.0,113.0)));',
    '  float n001 = hash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0,57.0,113.0)));',
    '  float n101 = hash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0,57.0,113.0)));',
    '  float n011 = hash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0,57.0,113.0)));',
    '  float n111 = hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));',
    '  vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);',
    '  float x00 = mix(n000, n100, w.x); float x10 = mix(n010, n110, w.x);',
    '  float x01 = mix(n001, n101, w.x); float x11 = mix(n011, n111, w.x);',
    '  float y0 = mix(x00, x10, w.y); float y1 = mix(x01, x11, w.y);',
    '  return mix(y0, y1, w.z) * 2.0 - 1.0;',
    '}',
    'float fbm2(vec2 uv, float t) {',
    '  vec3 p = vec3(uv * FBM_SCALE, t);',
    '  float amp = 1.0, freq = 1.0, sum = 1.0;',
    '  for (int i = 0; i < FBM_OCTAVES; ++i) {',
    '    sum += amp * vnoise(p * freq);',
    '    freq *= FBM_LACUNARITY; amp *= FBM_GAIN;',
    '  }',
    '  return sum * 0.5 + 0.5;',
    '}',
    'float maskTriangle(vec2 p, vec2 id, float cov) {',
    '  bool flip = mod(id.x + id.y, 2.0) > 0.5;',
    '  if (flip) p.x = 1.0 - p.x;',
    '  float r = sqrt(cov);',
    '  float d = p.y - r*(1.0 - p.x);',
    '  float aa = fwidth(d);',
    '  return cov * clamp(0.5 - d/aa, 0.0, 1.0);',
    '}',
    'void main() {',
    '  float pixSize = uPixelSize;',
    '  vec2 fragCoord = gl_FragCoord.xy - uResolution * .5;',
    '  float aspectRatio = uResolution.x / uResolution.y;',
    '  vec2 pixelId = floor(fragCoord / pixSize);',
    '  vec2 pixelUV = fract(fragCoord / pixSize);',
    '  float cellPixelSize = 8.0 * pixSize;',
    '  vec2 cellId = floor(fragCoord / cellPixelSize);',
    '  vec2 cellCoord = cellId * cellPixelSize;',
    '  vec2 uv = cellCoord / uResolution * vec2(aspectRatio, 1.0);',
    '  uv += vec2(1.3, 2.4);',
    '  uv += 0.25 * vec2(vnoise(vec3(cellId.x * 0.4, cellId.y * 0.4, 0.0)), vnoise(vec3(cellId.x * 0.4, cellId.y * 0.4, 3.0)));',
    '  float feed = fbm2(uv, uTime * 0.05 + 80.0);',
    '  feed = feed * 0.5 - 0.65;',
    '  const float speed = 0.30;',
    '  const float thickness = 0.10;',
    '  const float dampT = 1.0;',
    '  const float dampR = 10.0;',
    '  for (int i = 0; i < MAX_CLICKS; ++i) {',
    '    vec2 pos = uClickPos[i];',
    '    if (pos.x < 0.0) continue;',
    '    vec2 cuv = (pos - uResolution * .5 - cellPixelSize * .5) / uResolution * vec2(aspectRatio, 1.0);',
    '    float t = max(uTime - uClickTimes[i], 0.0);',
    '    float r = distance(uv, cuv);',
    '    float waveR = speed * t;',
    '    float ring = exp(-pow((r - waveR) / thickness, 2.0));',
    '    float atten = exp(-dampT * t) * exp(-dampR * r);',
    '    feed = max(feed, ring * atten);',
    '  }',
    '  float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;',
    '  float bw = step(0.5, feed + bayer);',
    '  float M = maskTriangle(pixelUV, pixelId, bw);',
    '  fragColor = vec4(uColor, M);',
    '}'
  ].join('\n');

  var gl = null;
  for (var i = 0; i < containerIds.length; i++) {
    var container = document.getElementById(containerIds[i]);
    if (!container) continue;

    var pixelSize = parseFloat(container.getAttribute('data-pixel-size')) || 10;
    var inkHex = (container.getAttribute('data-ink') || '#5ab0ff').replace('#', '');
    var inkColor = new THREE.Color(parseInt(inkHex, 16));

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('webgl2');
    if (!ctx) {
      if (i === 0) console.warn('hero-bg: WebGL2 not available');
      continue;
    }

    var scene = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, context: ctx, antialias: true, alpha: true });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(canvas);

    var clickPos = Array.from({ length: MAX_CLICKS }, function () { return new THREE.Vector2(-1, -1); });
    var clickTimes = new Float32Array(MAX_CLICKS);
    var clickState = { index: 0 };

    var material = new THREE.ShaderMaterial({
      uniforms: {
        uResolution: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uPixelSize: { value: pixelSize },
        uColor: { value: inkColor },
        uClickPos: { value: clickPos },
        uClickTimes: { value: clickTimes }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
      depthWrite: false,
      glslVersion: THREE.GLSL3
    });

    var quad = new THREE.PlaneGeometry(2, 2);
    var mesh = new THREE.Mesh(quad, material);
    scene.add(mesh);

    canvas.addEventListener('pointerdown', function (c, cp, ct, state, clk) {
      return function (e) {
        var r = c.getBoundingClientRect();
        var w = c.width;
        var h = c.height;
        var x = (e.clientX - r.left) / r.width * w;
        var y = h - (e.clientY - r.top) / r.height * h;
        cp[state.index].set(x, y);
        ct[state.index] = clk.getElapsedTime();
        state.index = (state.index + 1) % MAX_CLICKS;
      };
    }(canvas, clickPos, clickTimes, clickState, clock));

    instances.push({
      container: container,
      renderer: renderer,
      material: material,
      scene: scene,
      camera: camera,
      clickPos: clickPos,
      clickTimes: clickTimes
    });
  }

  if (instances.length === 0) return;

  function resize() {
    for (var i = 0; i < instances.length; i++) {
      var w = instances[i].container.offsetWidth;
      var h = instances[i].container.offsetHeight;
      instances[i].renderer.setSize(w, h);
      instances[i].material.uniforms.uResolution.value.set(w, h);
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    var t = clock.getElapsedTime();
    for (var i = 0; i < instances.length; i++) {
      instances[i].material.uniforms.uTime.value = t;
      instances[i].renderer.render(instances[i].scene, instances[i].camera);
    }
  }

  window.addEventListener('resize', resize);
  resize();
  animate();
})();
