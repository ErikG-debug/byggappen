// ============================================================
// RENDER3D — Generisk 3D-motor: projektion, kamera, WebGL + SVG-hjälpare
// ============================================================

function stolpArr(max) {
  const arr = []; let p = 0;
  while (true) {
    arr.push(parseFloat(Math.min(p, max).toFixed(3)));
    if (p >= max) break;
    p = Math.min(p + 1.8, max);
  }
  return arr;
}

const Render3D = {

  // Skapar projektionskontext för en given scen
  skapaKontext(b, l, h, rotAz, rotEl, zoomLevel, vW, vH, panX, panY) {
    const s = Math.min(50, 260 / (b + l + 1)) * zoomLevel;
    const cosAz = Math.cos(rotAz), sinAz = Math.sin(rotAz);
    const cosEl = Math.cos(rotEl), sinEl = Math.sin(rotEl);
    const zMid = h / 2;
    const px = panX || 0, py = panY || 0;

    function proj(x3, y3, z3) {
      const dx = x3 - b/2, dy = y3 - l/2, dz = z3 - zMid;
      const xr = dx * cosAz - dy * sinAz;
      const yr = dx * sinAz + dy * cosAz;
      return [
        vW * 0.5 + xr * s + px,
        vH * 0.45 - (dz * cosEl + yr * sinEl) * s + py
      ];
    }

    function pt(x, y, z) {
      const [a, c] = proj(x, y, z);
      return `${a.toFixed(3)},${c.toFixed(3)}`;
    }

    function cameraDepth(x, y, z) {
      const dx = x - b/2, dy = y - l/2, dz = z - zMid;
      const yr = dx * sinAz + dy * cosAz;
      return yr * cosEl - dz * sinEl;
    }

    return { proj, pt, cameraDepth, s, cosAz, sinAz, cosEl, sinEl, b, l, h, vW, vH, zMid };
  },

  // SVG polygon (behålls för planvy + overlay + preview)
  poly(pts, fill, stroke, sw, dash) {
    return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw ?? 1}" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  },

  // SVG linje mellan två 3D-punkter (behålls för planvy + overlay + preview)
  seg(ctx, x1, y1, z1, x2, y2, z2, col, sw, dash) {
    const [ax, ay] = ctx.proj(x1, y1, z1), [bx, by] = ctx.proj(x2, y2, z2);
    return `<line x1="${ax.toFixed(3)}" y1="${ay.toFixed(3)}" x2="${bx.toFixed(3)}" y2="${by.toFixed(3)}" stroke="${col}" stroke-width="${sw ?? 1}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  },

  // ============================================================
  // WebGL-infrastruktur
  // ============================================================

  _glState: null,

  initGL(canvas) {
    const gl = canvas.getContext('webgl', { antialias: true, depth: true, alpha: false });
    if (!gl) { console.error('WebGL ej tillgängligt'); return null; }

    // Kompilera shaders
    const vsSource = `
      attribute vec2 a_position;
      attribute float a_depth;
      attribute vec4 a_color;
      uniform vec2 u_resolution;
      varying vec4 v_color;
      void main() {
        vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
        clip.y = -clip.y;
        gl_Position = vec4(clip, a_depth, 1.0);
        v_color = a_color;
      }
    `;
    const fsSource = `
      precision mediump float;
      varying vec4 v_color;
      void main() { gl_FragColor = v_color; }
    `;

    function compileShader(src, type) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('Shader-fel:', gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    }

    const vs = compileShader(vsSource, gl.VERTEX_SHADER);
    const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return null;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program-fel:', gl.getProgramInfoLog(prog));
      return null;
    }

    const aPos = gl.getAttribLocation(prog, 'a_position');
    const aDepth = gl.getAttribLocation(prog, 'a_depth');
    const aColor = gl.getAttribLocation(prog, 'a_color');
    const uRes = gl.getUniformLocation(prog, 'u_resolution');

    const buf = gl.createBuffer();

    Render3D._glState = { gl, prog, aPos, aDepth, aColor, uRes, buf };
    return gl;
  },

  beginFrame(gl, vW, vH, clearColor) {
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    const c = clearColor || [1, 1, 1, 1];
    gl.clearColor(c[0], c[1], c[2], c[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.BLEND);
    gl.depthMask(true);

    const st = Render3D._glState;
    gl.useProgram(st.prog);
    gl.uniform2f(st.uRes, vW, vH);
  },

  // Hjälpfunktion: parsa hex-färg till [r,g,b,a] 0..1
  _parseColor(hex, alpha) {
    if (!hex || hex === 'none') return [0, 0, 0, 0];
    const a = alpha !== undefined ? alpha : 1;
    if (hex.startsWith('rgba')) {
      const m = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (m) return [+m[1]/255, +m[2]/255, +m[3]/255, m[4] !== undefined ? +m[4] : a];
    }
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255, a];
  },

  // Triangulera en konvex polygon (fan-triangulering)
  _triangulateFan(verts) {
    const tris = [];
    for (let i = 1; i < verts.length - 1; i++) {
      tris.push(verts[0], verts[i], verts[i+1]);
    }
    return tris;
  },

  // Rita fyllda polygoner via WebGL
  // faces: Array<{ verts: [[x,y,z],...], fill: '#hex', stroke: '#hex', sw: number }>
  drawPolygons(gl, ctx, faces, vW, vH) {
    if (faces.length === 0) return;
    const st = Render3D._glState;

    // Samla alla djupvärden för normalisering
    let dMin = Infinity, dMax = -Infinity;
    for (const f of faces) {
      for (const v of f.verts) {
        const d = ctx.cameraDepth(v[0], v[1], v[2]);
        if (d < dMin) dMin = d;
        if (d > dMax) dMax = d;
      }
    }
    const dRange = dMax - dMin || 1;

    // Bygg vertex-data: [x_screen, y_screen, depth_norm, r, g, b, a] per vertex
    // Stride = 7 floats
    const data = [];

    for (const f of faces) {
      const col = Render3D._parseColor(f.fill);
      if (col[3] === 0) continue;

      // Projicera och normalisera djup per vertex
      const projected = f.verts.map(v => {
        const [sx, sy] = ctx.proj(v[0], v[1], v[2]);
        const d = ctx.cameraDepth(v[0], v[1], v[2]);
        // Nära → 0 (framför), långt → 1 (bakom)
        // WebGL: z nära clipplane = -1 (visas), z=1 (bortklippt vid far)
        // Inverterat: objekt med störst cameraDepth är längst bort → higher z
        const zNorm = (d - dMin) / dRange;  // 0=närmast, 1=längst bort
        return { sx, sy, z: zNorm };
      });

      // Fan-triangulering
      for (let i = 1; i < projected.length - 1; i++) {
        const tri = [projected[0], projected[i], projected[i+1]];
        for (const p of tri) {
          data.push(p.sx, p.sy, p.z, col[0], col[1], col[2], col[3]);
        }
      }
    }

    if (data.length === 0) return;

    // Stroke-pass: rita kanter som tunna quads
    const strokeData = [];
    for (const f of faces) {
      if (!f.stroke || f.stroke === 'none' || !f.sw) continue;
      const sCol = Render3D._parseColor(f.stroke);
      if (sCol[3] === 0) continue;
      const hw = (f.sw || 1) * 0.5;

      const projected = f.verts.map(v => {
        const [sx, sy] = ctx.proj(v[0], v[1], v[2]);
        const d = ctx.cameraDepth(v[0], v[1], v[2]);
        const zNorm = (d - dMin) / dRange;
        return { sx, sy, z: zNorm };
      });

      for (let i = 0; i < projected.length; i++) {
        const a = projected[i];
        const b = projected[(i + 1) % projected.length];
        Render3D._pushLineQuad(strokeData, a.sx, a.sy, a.z, b.sx, b.sy, b.z, hw, sCol);
      }
    }

    // Rita fill-trianglar
    const arr = new Float32Array(data);
    gl.bindBuffer(gl.ARRAY_BUFFER, st.buf);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
    const stride = 7 * 4;
    gl.enableVertexAttribArray(st.aPos);
    gl.vertexAttribPointer(st.aPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(st.aDepth);
    gl.vertexAttribPointer(st.aDepth, 1, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(st.aColor);
    gl.vertexAttribPointer(st.aColor, 4, gl.FLOAT, false, stride, 12);
    gl.drawArrays(gl.TRIANGLES, 0, data.length / 7);

    // Rita stroke-quads
    if (strokeData.length > 0) {
      const sArr = new Float32Array(strokeData);
      gl.bufferData(gl.ARRAY_BUFFER, sArr, gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(st.aPos, 2, gl.FLOAT, false, stride, 0);
      gl.vertexAttribPointer(st.aDepth, 1, gl.FLOAT, false, stride, 8);
      gl.vertexAttribPointer(st.aColor, 4, gl.FLOAT, false, stride, 12);
      gl.drawArrays(gl.TRIANGLES, 0, strokeData.length / 7);
    }
  },

  // Rita linjer som screen-space quads
  drawLines(gl, ctx, lines, vW, vH) {
    if (lines.length === 0) return;
    const st = Render3D._glState;

    // Samla djup för normalisering (inkl faces om redan beräknat)
    let dMin = Infinity, dMax = -Infinity;
    for (const ln of lines) {
      for (const p of [ln.p1, ln.p2]) {
        const d = ctx.cameraDepth(p[0], p[1], p[2]);
        if (d < dMin) dMin = d;
        if (d > dMax) dMax = d;
      }
    }
    const dRange = dMax - dMin || 1;

    const data = [];
    for (const ln of lines) {
      const col = Render3D._parseColor(ln.color);
      const hw = (ln.sw || 1) * 0.5;
      const [ax, ay] = ctx.proj(ln.p1[0], ln.p1[1], ln.p1[2]);
      const [bx, by] = ctx.proj(ln.p2[0], ln.p2[1], ln.p2[2]);
      const az = (ctx.cameraDepth(ln.p1[0], ln.p1[1], ln.p1[2]) - dMin) / dRange;
      const bz = (ctx.cameraDepth(ln.p2[0], ln.p2[1], ln.p2[2]) - dMin) / dRange;
      Render3D._pushLineQuad(data, ax, ay, az, bx, by, bz, hw, col);
    }

    if (data.length === 0) return;
    const arr = new Float32Array(data);
    gl.bindBuffer(gl.ARRAY_BUFFER, st.buf);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
    const stride = 7 * 4;
    gl.enableVertexAttribArray(st.aPos);
    gl.vertexAttribPointer(st.aPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(st.aDepth);
    gl.vertexAttribPointer(st.aDepth, 1, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(st.aColor);
    gl.vertexAttribPointer(st.aColor, 4, gl.FLOAT, false, stride, 12);
    gl.drawArrays(gl.TRIANGLES, 0, data.length / 7);
  },

  // Rita transparenta ytor (skugga etc) med blending
  drawTransparent(gl, ctx, faces, vW, vH) {
    if (faces.length === 0) return;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    Render3D.drawPolygons(gl, ctx, faces, vW, vH);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  },

  // Expandera en linje till en tunn quad (2 trianglar) i screen-space
  _pushLineQuad(data, ax, ay, az, bx, by, bz, hw, col) {
    let dx = bx - ax, dy = by - ay;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) return;
    // Normal i screen-space
    const nx = -dy / len * hw, ny = dx / len * hw;
    // 4 hörn
    const v0x = ax + nx, v0y = ay + ny;
    const v1x = ax - nx, v1y = ay - ny;
    const v2x = bx - nx, v2y = by - ny;
    const v3x = bx + nx, v3y = by + ny;
    // Triangel 1
    data.push(v0x, v0y, az, col[0], col[1], col[2], col[3]);
    data.push(v1x, v1y, az, col[0], col[1], col[2], col[3]);
    data.push(v2x, v2y, bz, col[0], col[1], col[2], col[3]);
    // Triangel 2
    data.push(v0x, v0y, az, col[0], col[1], col[2], col[3]);
    data.push(v2x, v2y, bz, col[0], col[1], col[2], col[3]);
    data.push(v3x, v3y, bz, col[0], col[1], col[2], col[3]);
  },

  // Rita alla opaka + strokes + linjer + transparenta i ett anrop
  // med gemensam djupnormalisering
  renderScene(gl, ctx, faces, lines, transparentFaces, vW, vH) {
    const st = Render3D._glState;

    // Gemensam djupnormalisering över ALLA vertex
    let dMin = Infinity, dMax = -Infinity;
    const allSets = [faces, transparentFaces];
    for (const set of allSets) {
      for (const f of set) {
        for (const v of f.verts) {
          const d = ctx.cameraDepth(v[0], v[1], v[2]);
          if (d < dMin) dMin = d;
          if (d > dMax) dMax = d;
        }
      }
    }
    for (const ln of lines) {
      for (const p of [ln.p1, ln.p2]) {
        const d = ctx.cameraDepth(p[0], p[1], p[2]);
        if (d < dMin) dMin = d;
        if (d > dMax) dMax = d;
      }
    }
    if (dMin === Infinity) return; // Ingenting att rita
    const dRange = dMax - dMin || 1;

    function normZ(x, y, z) {
      return (ctx.cameraDepth(x, y, z) - dMin) / dRange;
    }

    // 1. Opaka polygoner (fill + stroke)
    const opaqueData = [];
    const opaqueStrokeData = [];

    for (const f of faces) {
      const col = Render3D._parseColor(f.fill);
      if (col[3] === 0) continue;

      const projected = f.verts.map(v => ({
        sx: ctx.proj(v[0], v[1], v[2])[0],
        sy: ctx.proj(v[0], v[1], v[2])[1],
        z: normZ(v[0], v[1], v[2])
      }));

      for (let i = 1; i < projected.length - 1; i++) {
        for (const p of [projected[0], projected[i], projected[i+1]]) {
          opaqueData.push(p.sx, p.sy, p.z, col[0], col[1], col[2], col[3]);
        }
      }

      // Stroke
      if (f.stroke && f.stroke !== 'none' && f.sw) {
        const sCol = Render3D._parseColor(f.stroke);
        const hw = (f.sw || 1) * 0.5;
        for (let i = 0; i < projected.length; i++) {
          if (f.strokeEdges && !f.strokeEdges[i]) continue;
          const a = projected[i], b = projected[(i+1) % projected.length];
          // Stroke at face depth with small bias toward camera
          Render3D._pushLineQuad(opaqueStrokeData,
            a.sx, a.sy, a.z - 0.0002,
            b.sx, b.sy, b.z - 0.0002, hw, sCol);
        }
      }
    }

    const stride = 7 * 4;

    if (opaqueData.length > 0) {
      const arr = new Float32Array(opaqueData);
      gl.bindBuffer(gl.ARRAY_BUFFER, st.buf);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(st.aPos);
      gl.vertexAttribPointer(st.aPos, 2, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(st.aDepth);
      gl.vertexAttribPointer(st.aDepth, 1, gl.FLOAT, false, stride, 8);
      gl.enableVertexAttribArray(st.aColor);
      gl.vertexAttribPointer(st.aColor, 4, gl.FLOAT, false, stride, 12);
      gl.drawArrays(gl.TRIANGLES, 0, opaqueData.length / 7);
    }

    if (opaqueStrokeData.length > 0) {
      gl.depthMask(false);
      const arr = new Float32Array(opaqueStrokeData);
      gl.bindBuffer(gl.ARRAY_BUFFER, st.buf);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(st.aPos, 2, gl.FLOAT, false, stride, 0);
      gl.vertexAttribPointer(st.aDepth, 1, gl.FLOAT, false, stride, 8);
      gl.vertexAttribPointer(st.aColor, 4, gl.FLOAT, false, stride, 12);
      gl.drawArrays(gl.TRIANGLES, 0, opaqueStrokeData.length / 7);
      gl.depthMask(true);
    }

    // 2. Linjer
    if (lines.length > 0) {
      const lineData = [];
      for (const ln of lines) {
        const col = Render3D._parseColor(ln.color);
        const hw = (ln.sw || 1) * 0.5;
        const [ax, ay] = ctx.proj(ln.p1[0], ln.p1[1], ln.p1[2]);
        const [bx, by] = ctx.proj(ln.p2[0], ln.p2[1], ln.p2[2]);
        const az = normZ(ln.p1[0], ln.p1[1], ln.p1[2]);
        const bz = normZ(ln.p2[0], ln.p2[1], ln.p2[2]);
        Render3D._pushLineQuad(lineData, ax, ay, az - 0.0002, bx, by, bz - 0.0002, hw, col);
      }
      const arr = new Float32Array(lineData);
      gl.bindBuffer(gl.ARRAY_BUFFER, st.buf);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(st.aPos, 2, gl.FLOAT, false, stride, 0);
      gl.vertexAttribPointer(st.aDepth, 1, gl.FLOAT, false, stride, 8);
      gl.vertexAttribPointer(st.aColor, 4, gl.FLOAT, false, stride, 12);
      gl.drawArrays(gl.TRIANGLES, 0, lineData.length / 7);
    }

    // 3. Transparenta ytor
    if (transparentFaces.length > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);

      const transData = [];
      for (const f of transparentFaces) {
        const col = Render3D._parseColor(f.fill, f.alpha !== undefined ? f.alpha : 0.5);

        const projected = f.verts.map(v => ({
          sx: ctx.proj(v[0], v[1], v[2])[0],
          sy: ctx.proj(v[0], v[1], v[2])[1],
          z: normZ(v[0], v[1], v[2])
        }));

        for (let i = 1; i < projected.length - 1; i++) {
          for (const p of [projected[0], projected[i], projected[i+1]]) {
            transData.push(p.sx, p.sy, p.z, col[0], col[1], col[2], col[3]);
          }
        }
      }

      if (transData.length > 0) {
        const arr = new Float32Array(transData);
        gl.bindBuffer(gl.ARRAY_BUFFER, st.buf);
        gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(st.aPos, 2, gl.FLOAT, false, stride, 0);
        gl.vertexAttribPointer(st.aDepth, 1, gl.FLOAT, false, stride, 8);
        gl.vertexAttribPointer(st.aColor, 4, gl.FLOAT, false, stride, 12);
        gl.drawArrays(gl.TRIANGLES, 0, transData.length / 7);
      }

      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
  }
};
