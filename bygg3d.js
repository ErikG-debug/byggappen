// ============================================================
// BYGG3D — Genererar 3D-modell som geometri (faces + lines)
// för WebGL-rendering med z-buffer
// ============================================================

// ── Färgpaletter ──
const PALETTER = {
  teknisk: {
    stolpe:    { sidor: ['#e0e0e0','#d0d0d0','#d8d8d8','#ddd'], topp: '#eee', stroke: '#999' },
    regel:     { sidor: ['#d0d0d0','#ddd'], botten: '#c0c0c0', topp: '#e8e8e8', stroke: '#999' },
    trall:     { plankor: ['#eaeaea','#e0e0e0'], stroke: '#bbb', kant: '#d0d0d0', bas: '#f0f0f0', basStroke: '#111' },
    kant:      { fill: '#f5f5f5', stroke: '#333', plankor: ['#eaeaea','#e0e0e0'], plankStroke: '#bbb' },
    undersida: { fill: '#e8e8e8', stroke: '#333' },
    husvagg:   { fill: '#f8f8f8', stroke: '#666' },
    mark:      { fill: '#fafafa', stroke: '#ddd' },
    bakgrund:  'white',
    // Lekstuga-material
    golv:          { plankor: ['#eaeaea','#e0e0e0'], stroke: '#bbb', bas: '#f0f0f0', basStroke: '#111' },
    vagg:          { fill: '#f0f0f0', stroke: '#888', fillInre: '#e0e0e0' },
    tak:           { fill: '#e8e8e8', stroke: '#888', nock: '#999' },
    dorr:          { fill: '#e0d8d0', stroke: '#666', handtag: '#999' },
    fonster:       { fill: '#d0e8f8', stroke: '#666', sprojsar: '#888' },
    stommeRegel:   { sidor: ['#d8d8d8','#ccc','#d0d0d0','#ddd'], topp: '#e0e0e0', stroke: '#aaa' },
  },
  realistisk: {
    stolpe:    { sidor: ['#8a5a20','#7a4a18','#6a3a10','#9a6a28'], topp: '#a07030', stroke: '#4a2808' },
    regel:     { sidor: ['#8a6020','#a07030'], botten: '#704818', topp: '#b08040', stroke: '#5a3010' },
    trall:     { plankor: ['#c89840','#d4a850'], stroke: '#a07020', kant: '#a07030', bas: '#8B5a20', basStroke: '#8B5a20' },
    kant:      { fill: '#c08840', stroke: '#4a2808', plankor: ['#c89840','#b88030'], plankStroke: '#a07020' },
    undersida: { fill: '#7a5020', stroke: '#4a2808' },
    husvagg:   { fill: '#cdc9c4', stroke: '#aaa' },
    mark:      { fill: '#5a9a38', stroke: '#4e8a30' },
    bakgrund:  'gradient',
    // Lekstuga-material
    golv:          { plankor: ['#c89840','#d4a850'], stroke: '#a07020', bas: '#8B5a20', basStroke: '#8B5a20' },
    vagg:          { fill: '#e0dcd0', stroke: '#8a7a60', fillInre: '#c8b89a' },
    tak:           { fill: '#b03020', stroke: '#801a10', nock: '#901510' },
    dorr:          { fill: '#c4904a', stroke: '#8B4513', handtag: '#666' },
    fonster:       { fill: '#a8d4f0', stroke: '#556', sprojsar: '#666' },
    stommeRegel:   { sidor: ['#8a6020','#7a5018','#6a4010','#9a7028'], topp: '#a08030', stroke: '#5a3010' },
  }
};

// ── Altanens bygg3d-funktion (oförändrad — deklarativ) ──
projekt.altan.bygg3d = function(b, l, h) {
  const bPs = stolpArr(b), lPs = stolpArr(l);
  const delar = [];
  const pW = 0.12;
  const kantT = 0.022;
  const kantH = h;
  const hw = pW / 2;
  const wallH = Math.min(2.5, h + 1.6);
  const rH = h > 0.5 ? 0.9 : 0;
  const trallT = 0.028;

  const allPostPos = [
    ...bPs.flatMap(px => [[px, 0], [px, l]]),
    ...lPs.filter(py => py > 0 && py < l).flatMap(py => [[0, py], [b, py]])
  ];
  for (const [px, py] of allPostPos) {
    let sx = px, sy = py;
    if (px <= 0)      sx = kantT + hw;
    else if (px >= b) sx = b - kantT - hw;
    if (py <= 0)      sy = kantT + hw;
    else if (py >= l) sy = l - kantT - hw;
    delar.push({ typ: 'box', pos: [sx, sy, 0], dim: [pW, pW, h - trallT], lager: 'stolpar', material: 'stolpe' });
  }

  const regelTrim = kantT + pW; // Stolpens innerkant (regelsko)
  for (const px of bPs) {
    // Klämma kantreglar inåt så de inte sticker ut förbi kantbrädorna
    const regelPos = px <= 0 ? kantT + 0.0225 : px >= b ? b - kantT - 0.0225 : px;
    delar.push({ typ: 'regel', axis: 'x', pos: regelPos, zBot: h - 0.195, zTop: h - trallT, bredd: 0.045, langd_b: b, langd_l: l, trimStart: regelTrim, trimEnd: regelTrim, lager: 'reglar', material: 'regel' });
  }

  for (const py of lPs) {
    if (py <= 0 || py >= l) continue;
    delar.push({ typ: 'regel', axis: 'y', pos: py, zBot: h - 0.195, zTop: h - trallT, bredd: 0.045, langd_b: b, langd_l: l, trimStart: regelTrim, trimEnd: regelTrim, lager: 'reglar', material: 'regel' });
  }

  delar.push({ typ: 'trall', b: b, l: l, h: h, trallT: 0.028, plankW: 0.12, plankGap: 0.008, lager: 'trall', material: 'trall' });
  delar.push({ typ: 'kantbrader', b: b, l: l, h: h, kantH: kantH, lager: 'reglar', material: 'kant' });
  delar.push({ typ: 'wall', verts: [[0,0,0],[b,0,0],[b,0,wallH],[0,0,wallH]], cx: b/2, cy: 0, cz: wallH/2, wallH: wallH, lager: 'husvagg', material: 'husvagg' });

  if (rH > 0) {
    delar.push({ typ: 'racke', b: b, l: l, h: h, rH: rH, bPs: bPs, lPs: lPs, allPostPos: allPostPos, lager: 'racke', material: 'racke' });
  }

  return delar;
};

// ============================================================
// Face-generatorer — returnerar geometriobjekt
// { verts: [[x,y,z],...], fill: '#hex', stroke: '#hex', sw: number }
// ============================================================

function renderBoxGL(del, palette) {
  const [cx, cy, cz] = del.pos;
  const [dw, dd, dh] = del.dim;
  const hw = dw / 2, hd = dd / 2;
  const x0 = cx - hw, x1 = cx + hw, y0 = cy - hd, y1 = cy + hd;
  const z0 = cz, z1 = cz + dh;
  const pal = palette[del.material];
  const st = pal.stroke;
  const swVal = del.material === 'stommeRegel' ? 0 : 0.5;

  return [
    { verts: [[x0,y0,z0],[x0,y1,z0],[x0,y1,z1],[x0,y0,z1]], fill: pal.sidor[0], stroke: st, sw: swVal },
    { verts: [[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]], fill: pal.sidor[1], stroke: st, sw: swVal },
    { verts: [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]], fill: pal.sidor[2], stroke: st, sw: swVal },
    { verts: [[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]], fill: pal.sidor[3], stroke: st, sw: swVal },
    { verts: [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]], fill: pal.topp, stroke: st, sw: swVal },
  ];
}

function renderRegelGL(del, palette) {
  const pal = palette[del.material];
  const rW = del.bredd;
  const rZB = del.zBot, rZT = del.zTop;
  const b = del.langd_b, l = del.langd_l;
  const ox = del._offX || 0, oy = del._offY || 0;
  const tS = del.trimStart || 0, tE = del.trimEnd || 0;

  if (del.axis === 'x') {
    // Bärlina löper i y-led — trimma y-ändarna (regelsko vid stolpar)
    const x0 = del.pos - rW/2 + ox, x1 = del.pos + rW/2 + ox;
    const yA = oy + tS, yB = oy + l - tE;
    return [
      { verts: [[x0,yA,rZB],[x0,yB,rZB],[x0,yB,rZT],[x0,yA,rZT]], fill: pal.sidor[0], stroke: pal.stroke, sw: 0.5 },
      { verts: [[x1,yA,rZB],[x1,yB,rZB],[x1,yB,rZT],[x1,yA,rZT]], fill: pal.sidor[1], stroke: pal.stroke, sw: 0.5 },
      { verts: [[x0,yA,rZB],[x1,yA,rZB],[x1,yB,rZB],[x0,yB,rZB]], fill: pal.botten, stroke: pal.stroke, sw: 0.3 },
      { verts: [[x0,yA,rZT],[x1,yA,rZT],[x1,yB,rZT],[x0,yB,rZT]], fill: pal.topp, stroke: pal.stroke, sw: 0.3 },
      // Ändytor (synliga regeländar vid stolpar)
      { verts: [[x0,yA,rZB],[x1,yA,rZB],[x1,yA,rZT],[x0,yA,rZT]], fill: pal.sidor[0], stroke: pal.stroke, sw: 0.3 },
      { verts: [[x0,yB,rZB],[x1,yB,rZB],[x1,yB,rZT],[x0,yB,rZT]], fill: pal.sidor[0], stroke: pal.stroke, sw: 0.3 },
    ];
  } else {
    // Tvärregel löper i x-led — trimma x-ändarna
    const y0 = del.pos - rW/2 + oy, y1 = del.pos + rW/2 + oy;
    const xA = ox + tS, xB = ox + b - tE;
    return [
      { verts: [[xA,y0,rZB],[xB,y0,rZB],[xB,y0,rZT],[xA,y0,rZT]], fill: pal.sidor[0], stroke: pal.stroke, sw: 0.5 },
      { verts: [[xA,y1,rZB],[xB,y1,rZB],[xB,y1,rZT],[xA,y1,rZT]], fill: pal.sidor[1], stroke: pal.stroke, sw: 0.5 },
      { verts: [[xA,y0,rZB],[xB,y0,rZB],[xB,y1,rZB],[xA,y1,rZB]], fill: pal.botten, stroke: pal.stroke, sw: 0.3 },
      { verts: [[xA,y0,rZT],[xB,y0,rZT],[xB,y1,rZT],[xA,y1,rZT]], fill: pal.topp, stroke: pal.stroke, sw: 0.3 },
      // Ändytor
      { verts: [[xA,y0,rZB],[xA,y1,rZB],[xA,y1,rZT],[xA,y0,rZT]], fill: pal.sidor[0], stroke: pal.stroke, sw: 0.3 },
      { verts: [[xB,y0,rZB],[xB,y1,rZB],[xB,y1,rZT],[xB,y0,rZT]], fill: pal.sidor[0], stroke: pal.stroke, sw: 0.3 },
    ];
  }
}

function renderTrallGL(del, palette) {
  const pal = palette[del.material];
  const b = del.b, l = del.l, h = del.h;
  const ox = del._offX || 0, oy = del._offY || 0;
  const trallT = del.trallT;
  const tZ0 = h - trallT, tZ1 = h;
  const plankW = del.plankW, plankGap = del.plankGap, plankStep = plankW + plankGap;

  const faces = [];

  // Solid basyta vid planknivå — täcker gap mellan plankor så reglar inte syns igenom
  faces.push({ verts: [[ox,oy,tZ1-0.001],[ox+b,oy,tZ1-0.001],[ox+b,oy+l,tZ1-0.001],[ox,oy+l,tZ1-0.001]], fill: pal.bas, stroke: 'none', sw: 0 });

  // Plankor på toppytan
  for (let ty = 0; ty < l; ty += plankStep) {
    const tyEnd = Math.min(ty + plankW, l);
    const shade = Math.floor(ty / plankStep) % 2 === 0 ? pal.plankor[0] : pal.plankor[1];
    faces.push({ verts: [[ox,oy+ty,tZ1],[ox+b,oy+ty,tZ1],[ox+b,oy+tyEnd,tZ1],[ox,oy+tyEnd,tZ1]], fill: shade, stroke: pal.stroke, sw: 0.3 });
  }

  // Bottenyta (stänger volymen underifrån)
  faces.push({ verts: [[ox,oy,tZ0+0.001],[ox+b,oy,tZ0+0.001],[ox+b,oy+l,tZ0+0.001],[ox,oy+l,tZ0+0.001]], fill: pal.bas, stroke: pal.basStroke, sw: 0.5 });

  // 4 sidokanter
  faces.push({ verts: [[ox,oy+l,tZ0],[ox+b,oy+l,tZ0],[ox+b,oy+l,tZ1],[ox,oy+l,tZ1]], fill: pal.kant, stroke: pal.stroke, sw: 0.5 });
  faces.push({ verts: [[ox,oy,tZ0],[ox+b,oy,tZ0],[ox+b,oy,tZ1],[ox,oy,tZ1]], fill: pal.kant, stroke: pal.stroke, sw: 0.5 });
  faces.push({ verts: [[ox+b,oy,tZ0],[ox+b,oy+l,tZ0],[ox+b,oy+l,tZ1],[ox+b,oy,tZ1]], fill: pal.kant, stroke: pal.stroke, sw: 0.5 });
  faces.push({ verts: [[ox,oy,tZ0],[ox,oy+l,tZ0],[ox,oy+l,tZ1],[ox,oy,tZ1]], fill: pal.kant, stroke: pal.stroke, sw: 0.5 });

  return faces;
}

function renderKantbraderGL(del, palette) {
  const pal = palette[del.material];
  const b = del.b, l = del.l, h = del.h, kantH = del.kantH;
  const ox = del._offX || 0, oy = del._offY || 0;
  const kantT = 0.022;
  const plankW = 0.12, plankGap = 0.005;
  const plankStep = plankW + plankGap;
  const z0 = h - kantH, z1 = h;

  const e = 0.001; // Offset för basyta inåt — undviker z-fighting med plankor
  const sidor = [
    { sida: 'syd',  pts: (za, zb) => [[ox,oy+l,za],[ox+b,oy+l,za],[ox+b,oy+l,zb],[ox,oy+l,zb]],
                     bas: (za, zb) => [[ox,oy+l-e,za],[ox+b,oy+l-e,za],[ox+b,oy+l-e,zb],[ox,oy+l-e,zb]] },
    { sida: 'nord', pts: (za, zb) => [[ox,oy,za],[ox+b,oy,za],[ox+b,oy,zb],[ox,oy,zb]],
                     bas: (za, zb) => [[ox,oy+e,za],[ox+b,oy+e,za],[ox+b,oy+e,zb],[ox,oy+e,zb]] },
    { sida: 'ost',  pts: (za, zb) => [[ox+b,oy,za],[ox+b,oy+l,za],[ox+b,oy+l,zb],[ox+b,oy,zb]],
                     bas: (za, zb) => [[ox+b-e,oy,za],[ox+b-e,oy+l,za],[ox+b-e,oy+l,zb],[ox+b-e,oy,zb]] },
    { sida: 'vast', pts: (za, zb) => [[ox,oy,za],[ox,oy+l,za],[ox,oy+l,zb],[ox,oy,zb]],
                     bas: (za, zb) => [[ox+e,oy,za],[ox+e,oy+l,za],[ox+e,oy+l,zb],[ox+e,oy,zb]] },
  ];

  const result = [];
  for (const s of sidor) {
    // Basyta — offsettad 1mm inåt så plankor vinner z-test
    result.push({ verts: s.bas(z0, z1), fill: pal.fill, stroke: pal.stroke, sw: 1, _sida: s.sida });
    // Horisontella plankor
    for (let pz = z0; pz < z1; pz += plankStep) {
      const pzEnd = Math.min(pz + plankW, z1);
      const shade = Math.floor((pz - z0) / plankStep) % 2 === 0 ? pal.plankor[0] : pal.plankor[1];
      result.push({ verts: s.pts(pz, pzEnd), fill: shade, stroke: pal.plankStroke, sw: 0.3, _sida: s.sida });
    }
  }

  // Topplock (horisontella remsor vid z1 runt hela kanten)
  result.push({ verts: [[ox,oy,z1],[ox+b,oy,z1],[ox+b,oy+kantT,z1],[ox,oy+kantT,z1]], fill: pal.fill, stroke: pal.stroke, sw: 0.3, _sida: 'nord' });
  result.push({ verts: [[ox,oy+l-kantT,z1],[ox+b,oy+l-kantT,z1],[ox+b,oy+l,z1],[ox,oy+l,z1]], fill: pal.fill, stroke: pal.stroke, sw: 0.3, _sida: 'syd' });
  result.push({ verts: [[ox+b-kantT,oy,z1],[ox+b,oy,z1],[ox+b,oy+l,z1],[ox+b-kantT,oy+l,z1]], fill: pal.fill, stroke: pal.stroke, sw: 0.3, _sida: 'ost' });
  result.push({ verts: [[ox,oy,z1],[ox+kantT,oy,z1],[ox+kantT,oy+l,z1],[ox,oy+l,z1]], fill: pal.fill, stroke: pal.stroke, sw: 0.3, _sida: 'vast' });

  // Bottenlock (horisontella remsor vid z0)
  result.push({ verts: [[ox,oy,z0],[ox+b,oy,z0],[ox+b,oy+kantT,z0],[ox,oy+kantT,z0]], fill: pal.fill, stroke: pal.stroke, sw: 0.3, _sida: 'nord' });
  result.push({ verts: [[ox,oy+l-kantT,z0],[ox+b,oy+l-kantT,z0],[ox+b,oy+l,z0],[ox,oy+l,z0]], fill: pal.fill, stroke: pal.stroke, sw: 0.3, _sida: 'syd' });
  result.push({ verts: [[ox+b-kantT,oy,z0],[ox+b,oy,z0],[ox+b,oy+l,z0],[ox+b-kantT,oy+l,z0]], fill: pal.fill, stroke: pal.stroke, sw: 0.3, _sida: 'ost' });
  result.push({ verts: [[ox,oy,z0],[ox+kantT,oy,z0],[ox+kantT,oy+l,z0],[ox,oy+l,z0]], fill: pal.fill, stroke: pal.stroke, sw: 0.3, _sida: 'vast' });

  return result;
}

function renderWallGL(del, palette, style, ctxB) {
  const pal = palette[del.material];
  const b = ctxB;
  const z0 = 0;
  const z1 = del.wallH;

  const wT = 0.15; // 15cm husväggtjocklek
  const faces = [];
  const lines = [];
  const overlay = [];

  // Huvudvägg (ytteryta)
  faces.push({ verts: [[0,0,z0],[b,0,z0],[b,0,z1],[0,0,z1]], fill: pal.fill, stroke: pal.stroke, sw: 0.8,
    _dash: style === 'teknisk' ? '6,3' : undefined });
  // Inneryta — skippa vertikala kanter vid x=0 och x=b (öst/väst-väggar ritar dem)
  faces.push({ verts: [[0,-wT,z0],[b,-wT,z0],[b,-wT,z1],[0,-wT,z1]], fill: pal.fill, stroke: pal.stroke, sw: 0.5, strokeEdges: [true, false, true, false] });
  // Topplock — skippa kanter vid x=0 och x=b
  faces.push({ verts: [[0,0,z1],[b,0,z1],[b,-wT,z1],[0,-wT,z1]], fill: pal.fill, stroke: pal.stroke, sw: 0.3, strokeEdges: [true, false, true, false] });

  if (style === 'teknisk') {
    // "HUS"-text → overlay
    if (z1 > del._ctxH) {
      overlay.push({ type: 'text', pos: [b/2, 0, (z0 + z1) * 0.6], text: 'HUS',
        anchor: 'middle', size: 10, fill: '#999' });
    }
  } else {
    // Tegellinjer
    for (let bz = Math.ceil(z0 / 0.25) * 0.25; bz < z1; bz += 0.25) {
      lines.push({ type: 'line', p1: [0,0,bz], p2: [b,0,bz], color: '#bbb', sw: 0.4 });
    }
    // Fönster på husvägg
    if (z1 > del._ctxH) {
      const wx = b * 0.25;
      const h = del._ctxH;
      faces.push({ verts: [[wx,0,h+0.3],[wx+0.7,0,h+0.3],[wx+0.7,0,h+1.0],[wx,0,h+1.0]], fill: '#a8d4f0', stroke: '#666', sw: 0.8 });
      lines.push({ type: 'line', p1: [wx+0.35,0,h+0.3], p2: [wx+0.35,0,h+1.0], color: '#666', sw: 0.5 });
      lines.push({ type: 'line', p1: [wx,0,h+0.65], p2: [wx+0.7,0,h+0.65], color: '#666', sw: 0.5 });
    }
  }

  return { faces, lines, overlay };
}

function renderRackeGL(del, palette, style) {
  const b = del.b, l = del.l, h = del.h, rH = del.rH;
  const ox = del._offX || 0, oy = del._offY || 0;
  const isTek = style === 'teknisk';
  const rc = isTek ? '#333' : '#5a3010';
  const rw = isTek ? 1.5 : 3;

  const lines = [];

  // Räckesstolpar
  for (const [px, py] of del.allPostPos) {
    lines.push({ type: 'line', p1: [px, py, h], p2: [px, py, h + rH], color: rc, sw: rw });
  }

  // Ledstänger — alla 4 sidor
  const sides = [
    [[ox,oy+l], [ox+b,oy+l]],
    [[ox,oy], [ox+b,oy]],
    [[ox+b,oy], [ox+b,oy+l]],
    [[ox,oy], [ox,oy+l]],
  ];
  for (const [a, b2] of sides) {
    lines.push({ type: 'line', p1: [a[0],a[1],h+rH], p2: [b2[0],b2[1],h+rH], color: rc, sw: rw+1 });
    lines.push({ type: 'line', p1: [a[0],a[1],h+rH*0.5], p2: [b2[0],b2[1],h+rH*0.5], color: isTek ? '#888' : rc, sw: isTek ? 0.8 : 1.5 });
  }

  return lines;
}


// ── Lekstuga-renderare (geometri) ──

function renderGolvGL(del, palette) {
  const pal = palette[del.material];
  const b = del.b, l = del.l;
  const ox = del._offX || 0, oy = del._offY || 0;
  const golvT = del.golvT;
  const plankW = del.plankW, plankGap = del.plankGap, plankStep = plankW + plankGap;

  const faces = [];

  // Bottenyta vid z=0 (stänger volymen underifrån)
  faces.push({ verts: [[ox,oy,0],[ox+b,oy,0],[ox+b,oy+l,0],[ox,oy+l,0]], fill: pal.bas, stroke: pal.basStroke, sw: 0.5 });

  // Solid basyta vid golvnivå — täcker gap mellan plankor
  faces.push({ verts: [[ox,oy,golvT-0.001],[ox+b,oy,golvT-0.001],[ox+b,oy+l,golvT-0.001],[ox,oy+l,golvT-0.001]], fill: pal.bas, stroke: 'none', sw: 0 });

  // Toppyta med plankor
  for (let ty = 0; ty < l; ty += plankStep) {
    const tyEnd = Math.min(ty + plankW, l);
    const shade = Math.floor(ty / plankStep) % 2 === 0 ? pal.plankor[0] : pal.plankor[1];
    faces.push({ verts: [[ox,oy+ty,golvT],[ox+b,oy+ty,golvT],[ox+b,oy+tyEnd,golvT],[ox,oy+tyEnd,golvT]], fill: shade, stroke: pal.stroke, sw: 0.3 });
  }
  return faces;
}

function renderVaggGL(del, palette) {
  const pal = palette[del.material];
  const b = del.b, l = del.l, h = del.h;
  const ox = del._offX || 0, oy = del._offY || 0;
  const wT = 0.1; // 10cm väggtjocklek

  const faces = [];

  if (del.sida === 'nord' || del.sida === 'syd') {
    const nH = del.nockHojd || h;
    const yOuter = del.sida === 'nord' ? oy : oy + l;
    const yInner = del.sida === 'nord' ? oy + wT : oy + l - wT;

    // Yttervägg — skippa vertikala hörnkanter (edges 1,3) — de ritas av öst/väst-väggarna
    faces.push({ verts: [[ox,yOuter,0],[ox+b,yOuter,0],[ox+b,yOuter,h],[ox,yOuter,h]], fill: pal.fill, stroke: pal.stroke, sw: 1, strokeEdges: [true, false, true, false] });
    // Innervägg
    faces.push({ verts: [[ox,yInner,0],[ox+b,yInner,0],[ox+b,yInner,h],[ox,yInner,h]], fill: pal.fillInre, stroke: pal.stroke, sw: 0.5, strokeEdges: [true, false, true, false] });
    // Topplock (remsa)
    faces.push({ verts: [[ox,yOuter,h],[ox+b,yOuter,h],[ox+b,yInner,h],[ox,yInner,h]], fill: pal.fill, stroke: pal.stroke, sw: 0.3 });
    // Bottenlock
    faces.push({ verts: [[ox,yOuter,0],[ox+b,yOuter,0],[ox+b,yInner,0],[ox,yInner,0]], fill: pal.fillInre, stroke: pal.stroke, sw: 0.3 });

    if (del.harNock) {
      // Yttre nock-triangel (med offset)
      faces.push({ verts: [[ox,yOuter,h],[ox+b,yOuter,h],[ox+b/2,yOuter,nH]], fill: pal.fill, stroke: pal.stroke, sw: 1 });
      // Inre nock-triangel
      faces.push({ verts: [[ox,yInner,h],[ox+b,yInner,h],[ox+b/2,yInner,nH]], fill: pal.fillInre, stroke: pal.stroke, sw: 0.5 });
      // Nock-topplock — skippa hörnkant (edge 0) vid väggmöte
      faces.push({ verts: [[ox,yOuter,h],[ox,yInner,h],[ox+b/2,yInner,nH],[ox+b/2,yOuter,nH]], fill: pal.fill, stroke: pal.stroke, sw: 0.3, strokeEdges: [false, true, true, true] });
      faces.push({ verts: [[ox+b,yOuter,h],[ox+b,yInner,h],[ox+b/2,yInner,nH],[ox+b/2,yOuter,nH]], fill: pal.fill, stroke: pal.stroke, sw: 0.3, strokeEdges: [false, true, true, true] });
    }

    if (del.dorrX !== undefined && del.sida === 'syd') {
      faces.push({ verts: [
        [ox+del.dorrX,yOuter-0.01,0],[ox+del.dorrX+del.dorrB,yOuter-0.01,0],
        [ox+del.dorrX+del.dorrB,yOuter-0.01,del.dorrH],[ox+del.dorrX,yOuter-0.01,del.dorrH]
      ], fill: pal.fillInre, stroke: pal.stroke, sw: 0.8 });
    }
  } else {
    const xOuter = del.sida === 'vast' ? ox : ox + b;
    const xInner = del.sida === 'vast' ? ox + wT : ox + b - wT;

    // Yttervägg
    faces.push({ verts: [[xOuter,oy,0],[xOuter,oy+l,0],[xOuter,oy+l,h],[xOuter,oy,h]], fill: pal.fill, stroke: pal.stroke, sw: 1 });
    // Innervägg
    faces.push({ verts: [[xInner,oy,0],[xInner,oy+l,0],[xInner,oy+l,h],[xInner,oy,h]], fill: pal.fillInre, stroke: pal.stroke, sw: 0.5 });
    // Topplock
    faces.push({ verts: [[xOuter,oy,h],[xOuter,oy+l,h],[xInner,oy+l,h],[xInner,oy,h]], fill: pal.fill, stroke: pal.stroke, sw: 0.3 });
    // Bottenlock
    faces.push({ verts: [[xOuter,oy,0],[xOuter,oy+l,0],[xInner,oy+l,0],[xInner,oy,0]], fill: pal.fillInre, stroke: pal.stroke, sw: 0.3 });

    if (del.fonsterY !== undefined && del.sida === 'ost') {
      faces.push({ verts: [
        [xOuter-0.01,oy+del.fonsterY,del.fonsterZ],[xOuter-0.01,oy+del.fonsterY+del.fonsterB,del.fonsterZ],
        [xOuter-0.01,oy+del.fonsterY+del.fonsterB,del.fonsterZ+del.fonsterH],[xOuter-0.01,oy+del.fonsterY,del.fonsterZ+del.fonsterH]
      ], fill: pal.fillInre, stroke: pal.stroke, sw: 0.8 });
    }
  }

  return faces;
}

function renderSadeltakGL(del, palette) {
  const pal = palette[del.material];
  const b = del.b, l = del.l, h = del.h;
  const nH = del.nockHojd;
  const ut = del.takUtsprang;
  const ox = del._offX || 0, oy = del._offY || 0;
  const takT = 0.04; // 4cm brädtjocklek

  // Beräkna offset nedåt längs takets normal
  const takRise = nH + ut * 0.05 - h;
  const takRun = b / 2 + ut;
  const takLen = Math.sqrt(takRise * takRise + takRun * takRun);
  const nz = takRun / takLen * takT;  // z-komponent av normaloffset
  const nx = takRise / takLen * takT; // x-komponent av normaloffset

  const nockZ = nH + ut * 0.05;
  const nockZi = nockZ - takT;

  const faces = [
    // Ovansida vänster
    { verts: [[ox-ut,oy-ut,h],[ox+b/2,oy-ut,nockZ],[ox+b/2,oy+l+ut,nockZ],[ox-ut,oy+l+ut,h]], fill: pal.fill, stroke: pal.stroke, sw: 1 },
    // Ovansida höger
    { verts: [[ox+b/2,oy-ut,nockZ],[ox+b+ut,oy-ut,h],[ox+b+ut,oy+l+ut,h],[ox+b/2,oy+l+ut,nockZ]], fill: pal.fill, stroke: pal.stroke, sw: 1 },
    // Undersida vänster (offset nedåt/inåt)
    { verts: [[ox-ut+nx,oy-ut,h-nz],[ox+b/2,oy-ut,nockZi],[ox+b/2,oy+l+ut,nockZi],[ox-ut+nx,oy+l+ut,h-nz]], fill: pal.fill, stroke: pal.stroke, sw: 0.5 },
    // Undersida höger
    { verts: [[ox+b/2,oy-ut,nockZi],[ox+b+ut-nx,oy-ut,h-nz],[ox+b+ut-nx,oy+l+ut,h-nz],[ox+b/2,oy+l+ut,nockZi]], fill: pal.fill, stroke: pal.stroke, sw: 0.5 },
    // Takfotskant vänster (binder ytter- och undersida vid takfoten)
    { verts: [[ox-ut,oy-ut,h],[ox-ut,oy+l+ut,h],[ox-ut+nx,oy+l+ut,h-nz],[ox-ut+nx,oy-ut,h-nz]], fill: pal.fill, stroke: pal.stroke, sw: 0.3 },
    // Takfotskant höger
    { verts: [[ox+b+ut,oy-ut,h],[ox+b+ut,oy+l+ut,h],[ox+b+ut-nx,oy+l+ut,h-nz],[ox+b+ut-nx,oy-ut,h-nz]], fill: pal.fill, stroke: pal.stroke, sw: 0.3 },

    // Gavelskivor — nord (y=oy-ut)
    // Yttre gaveltriangel
    { verts: [[ox-ut,oy-ut,h],[ox+b+ut,oy-ut,h],[ox+b/2,oy-ut,nockZ]], fill: pal.fill, stroke: pal.stroke, sw: 1 },
    // Inre gaveltriangel
    { verts: [[ox-ut+nx,oy-ut,h-nz],[ox+b+ut-nx,oy-ut,h-nz],[ox+b/2,oy-ut,nockZi]], fill: pal.fill, stroke: pal.stroke, sw: 0.5 },

    // Gavelskivor — syd (y=oy+l+ut)
    // Yttre gaveltriangel
    { verts: [[ox-ut,oy+l+ut,h],[ox+b+ut,oy+l+ut,h],[ox+b/2,oy+l+ut,nockZ]], fill: pal.fill, stroke: pal.stroke, sw: 1 },
    // Inre gaveltriangel
    { verts: [[ox-ut+nx,oy+l+ut,h-nz],[ox+b+ut-nx,oy+l+ut,h-nz],[ox+b/2,oy+l+ut,nockZi]], fill: pal.fill, stroke: pal.stroke, sw: 0.5 },
  ];
  const lines = [
    { type: 'line', p1: [ox+b/2,oy-ut,nH+ut*0.05], p2: [ox+b/2,oy+l+ut,nH+ut*0.05], color: pal.nock, sw: 2 },
  ];

  return { faces, lines };
}

function renderDorrGL(del, palette) {
  const pal = palette[del.material];
  const l = del.l, dorrX = del.dorrX, dorrB = del.dorrB, dorrH = del.dorrH;
  const ox = del._offX || 0, oy = del._offY || 0;
  const y = oy + l + 0.001; // 1mm utanför väggytan — undviker z-fighting

  const faces = [
    { verts: [
      [ox+dorrX+0.02,y,0.02],[ox+dorrX+dorrB-0.02,y,0.02],
      [ox+dorrX+dorrB-0.02,y,dorrH-0.02],[ox+dorrX+0.02,y,dorrH-0.02]
    ], fill: pal.fill, stroke: pal.stroke, sw: 1 }
  ];
  const hx = ox + dorrX + dorrB * 0.8;
  const hz = dorrH * 0.5;
  const lines = [
    { type: 'line', p1: [hx,y,hz-0.03], p2: [hx,y,hz+0.03], color: pal.handtag, sw: 3 }
  ];

  return { faces, lines };
}

function renderFonsterGL(del, palette) {
  const pal = palette[del.material];
  const b = del.b;
  const fY = del.fonsterY, fB = del.fonsterB, fH = del.fonsterH, fZ = del.fonsterZ;
  const ox = del._offX || 0, oy = del._offY || 0;
  const x = ox + b + 0.001; // 1mm utanför väggytan — undviker z-fighting

  const faces = [
    { verts: [
      [x,oy+fY+0.02,fZ+0.02],[x,oy+fY+fB-0.02,fZ+0.02],
      [x,oy+fY+fB-0.02,fZ+fH-0.02],[x,oy+fY+0.02,fZ+fH-0.02]
    ], fill: pal.fill, stroke: pal.stroke, sw: 1 }
  ];
  const midY = oy + fY + fB / 2;
  const midZ = fZ + fH / 2;
  const lines = [
    { type: 'line', p1: [x,midY,fZ+0.02], p2: [x,midY,fZ+fH-0.02], color: pal.sprojsar, sw: 1.5 },
    { type: 'line', p1: [x,oy+fY+0.02,midZ], p2: [x,oy+fY+fB-0.02,midZ], color: pal.sprojsar, sw: 1.5 },
  ];

  return { faces, lines };
}


// ============================================================
// byggModellGL — Returnerar { faces, lines, overlay, transparent }
// Ingen sortering — z-buffern hanterar djup per pixel
// ============================================================

function byggModellGL(delar, ctx, palette, style) {
  const faces = [];
  const lines = [];
  const overlay = [];
  const transparent = [];

  const cosAz = ctx.cosAz, sinAz = ctx.sinAz;

  for (const del of delar) {
    if (lager[del.lager] === undefined) lager[del.lager] = true;
    if (!lager[del.lager]) continue;

    if (del.typ === 'racke') {
      lines.push(...renderRackeGL(del, palette, style));
      continue;
    }

    if (del.typ === 'sadeltak') {
      const r = renderSadeltakGL(del, palette);
      faces.push(...r.faces);
      lines.push(...r.lines);
      continue;
    }

    if (del.typ === 'box') {
      faces.push(...renderBoxGL(del, palette));

    } else if (del.typ === 'regel') {
      faces.push(...renderRegelGL(del, palette));

    } else if (del.typ === 'trall') {
      faces.push(...renderTrallGL(del, palette));

    } else if (del.typ === 'golv') {
      faces.push(...renderGolvGL(del, palette));

    } else if (del.typ === 'vagg') {
      // Backface culling
      let faceDot = 0;
      if (del.sida === 'nord') faceDot = cosAz;
      else if (del.sida === 'syd') faceDot = -cosAz;
      else if (del.sida === 'vast') faceDot = sinAz;
      else if (del.sida === 'ost') faceDot = -sinAz;
      if (faceDot < -0.12) continue;

      faces.push(...renderVaggGL(del, palette));

    } else if (del.typ === 'dorr') {
      if (-cosAz < -0.12) continue;
      const r = renderDorrGL(del, palette);
      faces.push(...r.faces);
      lines.push(...r.lines);

    } else if (del.typ === 'fonster') {
      if (-sinAz < -0.12) continue;
      const r = renderFonsterGL(del, palette);
      faces.push(...r.faces);
      lines.push(...r.lines);

    } else if (del.typ === 'kantbrader') {
      for (const f of renderKantbraderGL(del, palette)) {
        // Backface culling
        let faceDot = 0;
        if (f._sida === 'nord') faceDot = cosAz;
        else if (f._sida === 'syd') faceDot = -cosAz;
        else if (f._sida === 'vast') faceDot = sinAz;
        else if (f._sida === 'ost') faceDot = -sinAz;
        if (faceDot < -0.12) continue;
        faces.push(f);
      }

    } else if (del.typ === 'wall') {
      del._ctxH = ctx.h;
      const r = renderWallGL(del, palette, style, ctx.b);
      // Husvägg med streckad kontur → tecken till overlay
      for (const f of r.faces) {
        if (f._dash) {
          // Streckad polygon: fill i WebGL, streckad stroke i overlay
          overlay.push({ type: 'dashedPoly', verts: f.verts, stroke: f.stroke, sw: f.sw, dash: f._dash });
          faces.push({ verts: f.verts, fill: f.fill, stroke: 'none', sw: 0 });
        } else {
          faces.push(f);
        }
      }
      lines.push(...r.lines);
      overlay.push(...r.overlay);

    } else if (del.typ === 'face') {
      const pal = palette[del.material];
      faces.push({ verts: del.verts, fill: pal.fill, stroke: pal.stroke, sw: 1 });
    }
  }

  return { faces, lines, overlay, transparent };
}


// ============================================================
// byggModell — Legacy SVG-pipeline (för preview + planvy)
// Behåller gamla painter's algorithm
// ============================================================

function byggModell(delar, ctx, palette, style) {
  const allItems = [];
  let rackeSvg = '';

  const cosAz = ctx.cosAz, sinAz = ctx.sinAz;
  const wallDepthMap = {};

  for (const del of delar) {
    if (lager[del.lager] === undefined) lager[del.lager] = true;
    if (!lager[del.lager]) continue;

    if (del.typ === 'racke') {
      rackeSvg += _renderRackeSVG(del, ctx, palette, style);
      continue;
    }

    if (del.typ === 'sadeltak') {
      allItems.push(..._renderSadeltakSVG(del, ctx, palette));
      continue;
    }

    if (del.typ === 'box') {
      allItems.push(..._renderBoxSVG(del, ctx, palette));
    } else if (del.typ === 'regel') {
      allItems.push(..._renderRegelSVG(del, ctx, palette));
    } else if (del.typ === 'trall') {
      allItems.push(..._renderTrallSVG(del, ctx, palette));
    } else if (del.typ === 'golv') {
      allItems.push(..._renderGolvSVG(del, ctx, palette));
    } else if (del.typ === 'vagg') {
      let faceDot = 0;
      if (del.sida === 'nord') faceDot = cosAz;
      else if (del.sida === 'syd') faceDot = -cosAz;
      else if (del.sida === 'vast') faceDot = sinAz;
      else if (del.sida === 'ost') faceDot = -sinAz;
      if (faceDot < -0.12) continue;
      const items = _renderVaggSVG(del, ctx, palette, style);
      wallDepthMap[del.sida] = items[0].depth;
      allItems.push(...items);
    } else if (del.typ === 'dorr') {
      if (-cosAz < -0.12) continue;
      const dox = del._offX || 0, doy = del._offY || 0;
      let parentD = wallDepthMap['syd'];
      if (parentD === undefined) parentD = ctx.cameraDepth(dox + del.dorrX + del.dorrB / 2, doy + del.l, del.dorrH / 2);
      allItems.push(..._renderDorrSVG(del, ctx, palette, parentD));
    } else if (del.typ === 'fonster') {
      if (-sinAz < -0.12) continue;
      const fox = del._offX || 0, foy = del._offY || 0;
      let parentD = wallDepthMap['ost'];
      if (parentD === undefined) parentD = ctx.cameraDepth(fox + del.b, foy + del.fonsterY + del.fonsterB / 2, del.fonsterZ + del.fonsterH / 2);
      allItems.push(..._renderFonsterSVG(del, ctx, palette, parentD));
    } else if (del.typ === 'kantbrader') {
      for (const f of _renderKantbraderSVG(del, ctx, palette)) {
        let faceDot = 0;
        if (f.sida === 'nord') faceDot = cosAz;
        else if (f.sida === 'syd') faceDot = -cosAz;
        else if (f.sida === 'vast') faceDot = sinAz;
        else if (f.sida === 'ost') faceDot = -sinAz;
        if (faceDot < -0.12) continue;
        allItems.push({ depth: f.depth, svg: f.svg });
      }
    } else if (del.typ === 'wall') {
      allItems.push(..._renderWallSVG(del, ctx, palette, style));
    } else if (del.typ === 'face') {
      const pal = palette[del.material];
      allItems.push({
        depth: ctx.cameraDepth(del.cx, del.cy, del.cz),
        svg: Render3D.poly(del.verts.map(v => ctx.pt(...v)), pal.fill, pal.stroke, 1)
      });
    }
  }

  allItems.sort((a, b) => b.depth - a.depth);
  return allItems.map(item => item.svg).join('') + rackeSvg;
}

// ── Wireframe-variant: samma SVG-pipeline men allt fill=none, stroke=white ──
function _wireframeify(obj) {
  if (Array.isArray(obj)) return obj.map(_wireframeify);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k in obj) {
      if (/stroke/i.test(k)) out[k] = '#ffffff';
      else out[k] = _wireframeify(obj[k]);
    }
    return out;
  }
  if (typeof obj === 'string') return 'none';
  return obj;
}

const _WIREFRAME_PALETTE = _wireframeify(PALETTER.teknisk);

function byggModellWireframe(delar, ctx) {
  return byggModell(delar, ctx, _WIREFRAME_PALETTE, 'teknisk');
}

// Silhuett: samma geometri men fyllda vita ytor (för auto-mask)
const _SILHOUETTE_PALETTE = (function () {
  function fill(obj) {
    if (Array.isArray(obj)) return obj.map(fill);
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const k in obj) out[k] = fill(obj[k]);
      return out;
    }
    if (typeof obj === 'string') return '#ffffff';
    return obj;
  }
  return fill(PALETTER.teknisk);
})();

function byggModellSilhouette(delar, ctx) {
  return byggModell(delar, ctx, _SILHOUETTE_PALETTE, 'teknisk');
}

// ── Legacy SVG render-hjälpare (privata, för preview) ──

function _renderBoxSVG(del, ctx, palette) {
  const [cx, cy, cz] = del.pos;
  const [dw, dd, dh] = del.dim;
  const hw = dw / 2, hd = dd / 2;
  const x0 = cx - hw, x1 = cx + hw, y0 = cy - hd, y1 = cy + hd;
  const z0 = cz, z1 = cz + dh;
  const pal = palette[del.material];
  const st = pal.stroke;
  return [
    { depth: ctx.cameraDepth(x0, cy, (z0+z1)/2), svg: Render3D.poly([[x0,y0,z0],[x0,y1,z0],[x0,y1,z1],[x0,y0,z1]].map(v => ctx.pt(...v)), pal.sidor[0], st, 0.5) },
    { depth: ctx.cameraDepth(x1, cy, (z0+z1)/2), svg: Render3D.poly([[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]].map(v => ctx.pt(...v)), pal.sidor[1], st, 0.5) },
    { depth: ctx.cameraDepth(cx, y0, (z0+z1)/2), svg: Render3D.poly([[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]].map(v => ctx.pt(...v)), pal.sidor[2], st, 0.5) },
    { depth: ctx.cameraDepth(cx, y1, (z0+z1)/2), svg: Render3D.poly([[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]].map(v => ctx.pt(...v)), pal.sidor[3], st, 0.5) },
    { depth: ctx.cameraDepth(cx, cy, z1), svg: Render3D.poly([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]].map(v => ctx.pt(...v)), pal.topp, st, 0.5) },
  ];
}

function _renderRegelSVG(del, ctx, palette) {
  const pal = palette[del.material];
  const rW = del.bredd;
  const rZB = del.zBot, rZT = del.zTop;
  const b = del.langd_b, l = del.langd_l;
  const ox = del._offX || 0, oy = del._offY || 0;
  if (del.axis === 'x') {
    const x0 = del.pos - rW/2 + ox, x1 = del.pos + rW/2 + ox;
    return [
      { depth: ctx.cameraDepth(x0, oy+l/2, (rZT+rZB)/2), svg: Render3D.poly([[x0,oy,rZB],[x0,oy+l,rZB],[x0,oy+l,rZT],[x0,oy,rZT]].map(v => ctx.pt(...v)), pal.sidor[0], pal.stroke, 0.5) },
      { depth: ctx.cameraDepth(x1, oy+l/2, (rZT+rZB)/2), svg: Render3D.poly([[x1,oy,rZB],[x1,oy+l,rZB],[x1,oy+l,rZT],[x1,oy,rZT]].map(v => ctx.pt(...v)), pal.sidor[1], pal.stroke, 0.5) },
      { depth: ctx.cameraDepth((x0+x1)/2, oy+l/2, rZB), svg: Render3D.poly([[x0,oy,rZB],[x1,oy,rZB],[x1,oy+l,rZB],[x0,oy+l,rZB]].map(v => ctx.pt(...v)), pal.botten, pal.stroke, 0.3) },
      { depth: ctx.cameraDepth((x0+x1)/2, oy+l/2, rZT), svg: Render3D.poly([[x0,oy,rZT],[x1,oy,rZT],[x1,oy+l,rZT],[x0,oy+l,rZT]].map(v => ctx.pt(...v)), pal.topp, pal.stroke, 0.3) },
    ];
  } else {
    const y0 = del.pos - rW/2 + oy, y1 = del.pos + rW/2 + oy;
    return [
      { depth: ctx.cameraDepth(ox+b/2, y0, (rZT+rZB)/2), svg: Render3D.poly([[ox,y0,rZB],[ox+b,y0,rZB],[ox+b,y0,rZT],[ox,y0,rZT]].map(v => ctx.pt(...v)), pal.sidor[0], pal.stroke, 0.5) },
      { depth: ctx.cameraDepth(ox+b/2, y1, (rZT+rZB)/2), svg: Render3D.poly([[ox,y1,rZB],[ox+b,y1,rZB],[ox+b,y1,rZT],[ox,y1,rZT]].map(v => ctx.pt(...v)), pal.sidor[1], pal.stroke, 0.5) },
      { depth: ctx.cameraDepth(ox+b/2, (y0+y1)/2, rZB), svg: Render3D.poly([[ox,y0,rZB],[ox+b,y0,rZB],[ox+b,y1,rZB],[ox,y1,rZB]].map(v => ctx.pt(...v)), pal.botten, pal.stroke, 0.3) },
      { depth: ctx.cameraDepth(ox+b/2, (y0+y1)/2, rZT), svg: Render3D.poly([[ox,y0,rZT],[ox+b,y0,rZT],[ox+b,y1,rZT],[ox,y1,rZT]].map(v => ctx.pt(...v)), pal.topp, pal.stroke, 0.3) },
    ];
  }
}

function _renderTrallSVG(del, ctx, palette) {
  const pal = palette[del.material];
  const b = del.b, l = del.l, h = del.h;
  const ox = del._offX || 0, oy = del._offY || 0;
  const trallT = del.trallT;
  const tZ0 = h - trallT, tZ1 = h;
  const plankW = del.plankW, plankGap = del.plankGap, plankStep = plankW + plankGap;
  let topSvg = Render3D.poly([[ox,oy,h],[ox+b,oy,h],[ox+b,oy+l,h],[ox,oy+l,h]].map(v => ctx.pt(...v)), pal.bas, pal.basStroke, 1.5);
  for (let ty = 0; ty < l; ty += plankStep) {
    const tyEnd = Math.min(ty + plankW, l);
    const shade = Math.floor(ty / plankStep) % 2 === 0 ? pal.plankor[0] : pal.plankor[1];
    topSvg += `<polygon points="${[ctx.pt(ox,oy+ty,tZ1),ctx.pt(ox+b,oy+ty,tZ1),ctx.pt(ox+b,oy+tyEnd,tZ1),ctx.pt(ox,oy+tyEnd,tZ1)].join(' ')}" fill="${shade}" stroke="${pal.stroke}" stroke-width="0.3"/>`;
  }
  return [
    { depth: ctx.cameraDepth(ox+b/2, oy+l/2, h), svg: topSvg },
    { depth: ctx.cameraDepth(ox+b/2, oy+l, h), svg: Render3D.poly([[ox,oy+l,tZ0],[ox+b,oy+l,tZ0],[ox+b,oy+l,tZ1],[ox,oy+l,tZ1]].map(v => ctx.pt(...v)), pal.kant, pal.stroke, 0.5) },
    { depth: ctx.cameraDepth(ox+b/2, oy, h), svg: Render3D.poly([[ox,oy,tZ0],[ox+b,oy,tZ0],[ox+b,oy,tZ1],[ox,oy,tZ1]].map(v => ctx.pt(...v)), pal.kant, pal.stroke, 0.5) },
    { depth: ctx.cameraDepth(ox+b, oy+l/2, h), svg: Render3D.poly([[ox+b,oy,tZ0],[ox+b,oy+l,tZ0],[ox+b,oy+l,tZ1],[ox+b,oy,tZ1]].map(v => ctx.pt(...v)), pal.kant, pal.stroke, 0.5) },
    { depth: ctx.cameraDepth(ox, oy+l/2, h), svg: Render3D.poly([[ox,oy,tZ0],[ox,oy+l,tZ0],[ox,oy+l,tZ1],[ox,oy,tZ1]].map(v => ctx.pt(...v)), pal.kant, pal.stroke, 0.5) },
  ];
}

function _renderKantbraderSVG(del, ctx, palette) {
  const pal = palette[del.material];
  const b = del.b, l = del.l, h = del.h, kantH = del.kantH;
  const ox = del._offX || 0, oy = del._offY || 0;
  const plankW = 0.12, plankGap = 0.005, plankStep = plankW + plankGap;
  const z0 = h - kantH, z1 = h;
  const sidor = [
    { sida: 'syd',  pts: (za, zb) => [[ox,oy+l,za],[ox+b,oy+l,za],[ox+b,oy+l,zb],[ox,oy+l,zb]] },
    { sida: 'nord', pts: (za, zb) => [[ox,oy,za],[ox+b,oy,za],[ox+b,oy,zb],[ox,oy,zb]] },
    { sida: 'ost',  pts: (za, zb) => [[ox+b,oy,za],[ox+b,oy+l,za],[ox+b,oy+l,zb],[ox+b,oy,zb]] },
    { sida: 'vast', pts: (za, zb) => [[ox,oy,za],[ox,oy+l,za],[ox,oy+l,zb],[ox,oy,zb]] },
  ];
  return sidor.map(s => {
    let svg = Render3D.poly(s.pts(z0, z1).map(v => ctx.pt(...v)), pal.fill, pal.stroke, 1);
    for (let pz = z0; pz < z1; pz += plankStep) {
      const pzEnd = Math.min(pz + plankW, z1);
      const shade = Math.floor((pz - z0) / plankStep) % 2 === 0 ? pal.plankor[0] : pal.plankor[1];
      svg += Render3D.poly(s.pts(pz, pzEnd).map(v => ctx.pt(...v)), shade, pal.plankStroke, 0.3);
    }
    const corners = s.pts(z0, z1);
    const depth = Math.min(...corners.map(v => ctx.cameraDepth(...v)));
    return { depth, svg, sida: s.sida };
  });
}

function _renderWallSVG(del, ctx, palette, style) {
  const pal = palette[del.material];
  const b = ctx.b;
  const z0 = 0, z1 = del.wallH;
  const verts = [[0,0,z0],[b,0,z0],[b,0,z1],[0,0,z1]];
  let svg = Render3D.poly(verts.map(v => ctx.pt(...v)), pal.fill, pal.stroke, 0.8, style === 'teknisk' ? '6,3' : undefined);
  if (style === 'teknisk') {
    if (z1 > ctx.h) {
      const [htx, hty] = ctx.proj(b/2, 0, (z0 + z1) * 0.6);
      svg += `<text x="${htx.toFixed(1)}" y="${hty.toFixed(1)}" text-anchor="middle" font-size="10" fill="#999" font-family="Arial">HUS</text>`;
    }
  } else {
    for (let bz = Math.ceil(z0 / 0.25) * 0.25; bz < z1; bz += 0.25) {
      svg += Render3D.seg(ctx, 0, 0, bz, b, 0, bz, '#bbb', 0.4);
    }
    if (z1 > ctx.h) {
      const wx = b * 0.25, h = ctx.h;
      svg += Render3D.poly([ctx.pt(wx,0,h+0.3),ctx.pt(wx+0.7,0,h+0.3),ctx.pt(wx+0.7,0,h+1.0),ctx.pt(wx,0,h+1.0)], '#a8d4f0', '#666', 0.8);
      svg += Render3D.seg(ctx, wx+0.35,0,h+0.3, wx+0.35,0,h+1.0, '#666', 0.5);
      svg += Render3D.seg(ctx, wx,0,h+0.65, wx+0.7,0,h+0.65, '#666', 0.5);
    }
  }
  return [{ depth: ctx.cameraDepth(b / 2, 0, z1 / 2), svg }];
}

function _renderRackeSVG(del, ctx, palette, style) {
  const b = del.b, l = del.l, h = del.h, rH = del.rH;
  const ox = del._offX || 0, oy = del._offY || 0;
  const isTek = style === 'teknisk';
  const rc = isTek ? '#333' : '#5a3010';
  const rw = isTek ? 1.5 : 3;
  let svg = '';
  for (const [px, py] of del.allPostPos) {
    svg += Render3D.seg(ctx, px, py, h, px, py, h + rH, rc, rw);
  }
  const rails = [
    { cy: ctx.cameraDepth(ox+b/2, oy+l, h+rH), draw: () => Render3D.seg(ctx, ox,oy+l,h+rH, ox+b,oy+l,h+rH, rc, rw+1) + Render3D.seg(ctx, ox,oy+l,h+rH*0.5, ox+b,oy+l,h+rH*0.5, isTek ? '#888' : rc, isTek ? 0.8 : 1.5) },
    { cy: ctx.cameraDepth(ox+b/2, oy, h+rH), draw: () => Render3D.seg(ctx, ox,oy,h+rH, ox+b,oy,h+rH, rc, rw+1) + Render3D.seg(ctx, ox,oy,h+rH*0.5, ox+b,oy,h+rH*0.5, isTek ? '#888' : rc, isTek ? 0.8 : 1.5) },
    { cy: ctx.cameraDepth(ox+b, oy+l/2, h+rH), draw: () => Render3D.seg(ctx, ox+b,oy,h+rH, ox+b,oy+l,h+rH, rc, rw+1) + Render3D.seg(ctx, ox+b,oy,h+rH*0.5, ox+b,oy+l,h+rH*0.5, isTek ? '#888' : rc, isTek ? 0.8 : 1.5) },
    { cy: ctx.cameraDepth(ox, oy+l/2, h+rH), draw: () => Render3D.seg(ctx, ox,oy,h+rH, ox,oy+l,h+rH, rc, rw+1) + Render3D.seg(ctx, ox,oy,h+rH*0.5, ox,oy+l,h+rH*0.5, isTek ? '#888' : rc, isTek ? 0.8 : 1.5) },
  ].sort((a, b) => b.cy - a.cy);
  for (const r of rails) svg += r.draw();
  return svg;
}

function _renderSadeltakSVG(del, ctx, palette) {
  const pal = palette[del.material];
  const b = del.b, l = del.l, h = del.h;
  const nH = del.nockHojd, ut = del.takUtsprang;
  const ox = del._offX || 0, oy = del._offY || 0;
  const vansterTak = [[ox-ut,oy-ut,h],[ox+b/2,oy-ut,nH+ut*0.05],[ox+b/2,oy+l+ut,nH+ut*0.05],[ox-ut,oy+l+ut,h]];
  const hogerTak = [[ox+b/2,oy-ut,nH+ut*0.05],[ox+b+ut,oy-ut,h],[ox+b+ut,oy+l+ut,h],[ox+b/2,oy+l+ut,nH+ut*0.05]];
  return [
    { depth: ctx.cameraDepth(ox+b*0.25,oy+l/2,(h+nH)/2), svg: Render3D.poly(vansterTak.map(v => ctx.pt(...v)), pal.fill, pal.stroke, 1) },
    { depth: ctx.cameraDepth(ox+b*0.75,oy+l/2,(h+nH)/2), svg: Render3D.poly(hogerTak.map(v => ctx.pt(...v)), pal.fill, pal.stroke, 1) },
    { depth: ctx.cameraDepth(ox+b/2,oy+l/2,nH), svg: Render3D.seg(ctx, ox+b/2,oy-ut,nH+ut*0.05, ox+b/2,oy+l+ut,nH+ut*0.05, pal.nock, 2) },
  ];
}

function _renderGolvSVG(del, ctx, palette) {
  const pal = palette[del.material];
  const b = del.b, l = del.l;
  const ox = del._offX || 0, oy = del._offY || 0;
  const golvT = del.golvT;
  const plankW = del.plankW, plankGap = del.plankGap, plankStep = plankW + plankGap;
  let svg = Render3D.poly([[ox,oy,0],[ox+b,oy,0],[ox+b,oy+l,0],[ox,oy+l,0]].map(v => ctx.pt(...v)), pal.bas, pal.basStroke, 1);
  for (let ty = 0; ty < l; ty += plankStep) {
    const tyEnd = Math.min(ty + plankW, l);
    const shade = Math.floor(ty / plankStep) % 2 === 0 ? pal.plankor[0] : pal.plankor[1];
    svg += `<polygon points="${[ctx.pt(ox,oy+ty,golvT),ctx.pt(ox+b,oy+ty,golvT),ctx.pt(ox+b,oy+tyEnd,golvT),ctx.pt(ox,oy+tyEnd,golvT)].join(' ')}" fill="${shade}" stroke="${pal.stroke}" stroke-width="0.3"/>`;
  }
  return [{ depth: ctx.cameraDepth(ox+b/2, oy+l/2, 0), svg }];
}

function _renderVaggSVG(del, ctx, palette, style) {
  const pal = palette[del.material];
  const b = del.b, l = del.l, h = del.h;
  const ox = del._offX || 0, oy = del._offY || 0;
  let svg = '';
  if (del.sida === 'nord' || del.sida === 'syd') {
    const y = del.sida === 'nord' ? oy : oy + l;
    const nH = del.nockHojd || h;
    if (del.harNock) {
      svg += Render3D.poly([[ox,y,0],[ox+b,y,0],[ox+b,y,h],[ox,y,h]].map(v => ctx.pt(...v)), pal.fill, pal.stroke, 1);
      svg += Render3D.poly([[ox,y,h],[ox+b,y,h],[ox+b/2,y,nH]].map(v => ctx.pt(...v)), pal.fill, pal.stroke, 1);
    } else {
      svg += Render3D.poly([[ox,y,0],[ox+b,y,0],[ox+b,y,h],[ox,y,h]].map(v => ctx.pt(...v)), pal.fill, pal.stroke, 1);
    }
    if (del.dorrX !== undefined && del.sida === 'syd') {
      svg += Render3D.poly([[ox+del.dorrX,y,0],[ox+del.dorrX+del.dorrB,y,0],[ox+del.dorrX+del.dorrB,y,del.dorrH],[ox+del.dorrX,y,del.dorrH]].map(v => ctx.pt(...v)), pal.fillInre, pal.stroke, 0.8);
    }
  } else {
    const x = del.sida === 'vast' ? ox : ox + b;
    svg += Render3D.poly([[x,oy,0],[x,oy+l,0],[x,oy+l,h],[x,oy,h]].map(v => ctx.pt(...v)), pal.fill, pal.stroke, 1);
    if (del.fonsterY !== undefined && del.sida === 'ost') {
      svg += Render3D.poly([[x,oy+del.fonsterY,del.fonsterZ],[x,oy+del.fonsterY+del.fonsterB,del.fonsterZ],[x,oy+del.fonsterY+del.fonsterB,del.fonsterZ+del.fonsterH],[x,oy+del.fonsterY,del.fonsterZ+del.fonsterH]].map(v => ctx.pt(...v)), pal.fillInre, pal.stroke, 0.8);
    }
  }
  let corners;
  if (del.sida === 'nord') corners = [[ox,oy,0],[ox+b,oy,0],[ox+b,oy,h],[ox,oy,h]];
  else if (del.sida === 'syd') corners = [[ox,oy+l,0],[ox+b,oy+l,0],[ox+b,oy+l,h],[ox,oy+l,h]];
  else if (del.sida === 'vast') corners = [[ox,oy,0],[ox,oy+l,0],[ox,oy+l,h],[ox,oy,h]];
  else corners = [[ox+b,oy,0],[ox+b,oy+l,0],[ox+b,oy+l,h],[ox+b,oy,h]];
  return [{ depth: Math.min(...corners.map(v => ctx.cameraDepth(...v))), svg }];
}

function _renderDorrSVG(del, ctx, palette, parentDepth) {
  const pal = palette[del.material];
  const l = del.l, dorrX = del.dorrX, dorrB = del.dorrB, dorrH = del.dorrH;
  const ox = del._offX || 0, oy = del._offY || 0;
  const y = oy + l;
  let svg = Render3D.poly([[ox+dorrX+0.02,y,0.02],[ox+dorrX+dorrB-0.02,y,0.02],[ox+dorrX+dorrB-0.02,y,dorrH-0.02],[ox+dorrX+0.02,y,dorrH-0.02]].map(v => ctx.pt(...v)), pal.fill, pal.stroke, 1);
  const hx = ox + dorrX + dorrB * 0.8, hz = dorrH * 0.5;
  svg += Render3D.seg(ctx, hx, y, hz - 0.03, hx, y, hz + 0.03, pal.handtag, 3);
  return [{ depth: parentDepth - 0.01, svg }];
}

function _renderFonsterSVG(del, ctx, palette, parentDepth) {
  const pal = palette[del.material];
  const b = del.b;
  const fY = del.fonsterY, fB = del.fonsterB, fH = del.fonsterH, fZ = del.fonsterZ;
  const ox = del._offX || 0, oy = del._offY || 0;
  const x = ox + b;
  let svg = Render3D.poly([[x,oy+fY+0.02,fZ+0.02],[x,oy+fY+fB-0.02,fZ+0.02],[x,oy+fY+fB-0.02,fZ+fH-0.02],[x,oy+fY+0.02,fZ+fH-0.02]].map(v => ctx.pt(...v)), pal.fill, pal.stroke, 1);
  const midY = oy + fY + fB / 2, midZ = fZ + fH / 2;
  svg += Render3D.seg(ctx, x, midY, fZ + 0.02, x, midY, fZ + fH - 0.02, pal.sprojsar, 1.5);
  svg += Render3D.seg(ctx, x, oy + fY + 0.02, midZ, x, oy + fY + fB - 0.02, midZ, pal.sprojsar, 1.5);
  return [{ depth: parentDepth - 0.01, svg }];
}
