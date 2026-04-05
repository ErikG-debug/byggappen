// ============================================================
// DIMENSIONER (generisk)
// ============================================================

let aktuellaB = 4, aktuellaL = 3;
let uploadedImage = null;
let currentMask = null;

// ── Designmodell ──
let aktuelltDesign = null;
let aktuelltBerakning = null;

function synkaDesign() {
  if (!aktuelltDesign || aktuelltDesign.sektioner.length === 0) return;
  var sek = aktuelltDesign.sektioner[0];
  DesignModell.andraSektion(aktuelltDesign, sek.id, {
    b: aktuellaB,
    l: aktuellaL,
    egenskaper: { h: aktuellaH }
  });
  var r = ByggRegler.tillampa(aktuelltDesign);
  aktuelltBerakning = r.berakning;
}

// ============================================================
// PREVIEW-REGISTER
// ============================================================

var _previewRegister = {};

function registreraPreview(projektTyp, renderFn) {
  _previewRegister[projektTyp] = renderFn;
}

function uppdateraPreview() {
  if (!valtProjekt) return;
  var fn = _previewRegister[valtProjekt];
  if (fn) fn(aktuellaB, aktuellaL, aktuellaH);
  uppdateraVisualisering();
}

function uppdateraVisualisering() {
  var svg = document.getElementById('preview-3d-svg');
  if (!svg || !valtProjekt) return;

  // Spara nuvarande vy-state
  var sparAz = rotAz, sparEl = rotEl, sparZoom = zoomLevel, sparPanX = panX, sparPanY = panY;

  // Fast snygg vinkel for visualiseringen
  rotAz = Math.PI / 4.5;
  rotEl = Math.PI / 5.5;
  zoomLevel = 1.0;
  panX = 0; panY = 0;

  var vW = 600, vH = 400;
  svg.setAttribute('viewBox', '0 0 ' + vW + ' ' + vH);

  svg.innerHTML = rita3DPreview(aktuellaB, aktuellaL, aktuellaH, vW, vH);

  // Aterstall vy-state
  rotAz = sparAz; rotEl = sparEl; zoomLevel = sparZoom; panX = sparPanX; panY = sparPanY;
}



// ============================================================
// DYNAMISKA SLIDERS
// ============================================================

function byggSliders(projektTyp) {
  var regler = ByggRegler.hamta(projektTyp);
  if (!regler || !regler.ui) return;

  var ui = regler.ui;
  var dim = regler.dim;
  var std = regler.standard;
  var container = document.getElementById('pv-dim-layout');
  if (!container) return;

  var html = '';

  // 3D-visualisering
  html += '<div class="pv-visualisering">';
  html += '<svg id="preview-3d-svg" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg"></svg>';
  html += '</div>';

  // Sammanfattning + knapp
  html += '<div class="pv-info-panel">';

  var p = projekt[projektTyp];
  if (p && p.sammanfattning) {
    html += '<p class="pv-sammanfattning">' + p.sammanfattning + '</p>';
  }

  html += '<button class="ritvy-knapp" id="btn-ritvy" onclick="oppnaRitvy()">\u{1F4D0} Anpassa och visa detaljritning</button>';
  if (uploadedImage) {
    html += '<button class="ai-uppdatera-knapp" onclick="bytVy(\'ai\'); startaAIGenerering()">Uppdatera AI-bild med nya mått</button>';
  }
  html += '</div>';

  container.innerHTML = html;
}


// ============================================================
// DYNAMISK LAGERPANEL
// ============================================================

function uppdateraLagerPanel(projektTyp) {
  var panel = document.getElementById('lager-panel');
  if (!panel) return;

  var regler = ByggRegler.hamta(projektTyp);
  var defs = (regler && regler.lager) || [];

  // Se till att alla lager for denna projekttyp har ett varde
  for (var i = 0; i < defs.length; i++) {
    if (lager[defs[i].nyckel] === undefined) lager[defs[i].nyckel] = true;
  }

  var html = '<span class="lager-rubrik">Visa:</span>';
  for (var j = 0; j < defs.length; j++) {
    var d = defs[j];
    var av = lager[d.nyckel] === false ? ' lager-av' : '';
    html += '<button class="lager-knapp' + av + '" id="lager-' + d.nyckel + '" onclick="toggleLager(\'' + d.nyckel + '\')">' + d.etikett + '</button>';
  }
  panel.innerHTML = html;
}


// ── Multisektion-funktioner ──

function uppdateraFranDesign() {
  if (!aktuelltDesign) return;
  var r = ByggRegler.tillampa(aktuelltDesign);
  aktuelltBerakning = r.berakning;

  var regler = ByggRegler.hamta(valtProjekt);
  var ui = regler ? regler.ui : null;

  // Synka globaler med forsta sektionen
  var sek0 = aktuelltDesign.sektioner[0];
  aktuellaB = sek0.b;
  aktuellaL = sek0.l;
  aktuellaH = sek0.egenskaper.h || (regler ? regler.standard.h : 0.6);

  // Uppdatera slider-display for vald sektion
  var valdId = Editor.valdSektionId();
  var valdSek = aktuelltDesign.sektioner.find(function (s) { return s.id === valdId; }) || sek0;

  // Uppdatera alla vanliga sliders
  if (ui) {
    for (var i = 0; i < ui.sliders.length; i++) {
      var s = ui.sliders[i];
      var val = s.nyckel === 'h' ? valdSek.egenskaper.h : valdSek[s.nyckel];
      var sliderEl = document.getElementById('slider-' + s.nyckel);
      var valEl = document.getElementById('slider-val-' + s.nyckel);
      if (sliderEl) sliderEl.value = val;
      if (valEl) valEl.textContent = s.format(val);
    }
  }

  // Total yta
  var totalYta = aktuelltDesign.sektioner.reduce(function (s, sek) { return s + sek.b * sek.l; }, 0);
  var ytaEl = document.getElementById('yta-val');
  if (ytaEl) ytaEl.textContent = totalYta.toFixed(1) + ' m\u00b2';

  uppdateraPreview();
  renderRitvy();
  uppdateraDimTip(aktuellaB, aktuellaL);
  uppdateraKostnadDisplay();
}

function valjSektionGlobal(id) {
  Editor.valjSektion(id);
  if (!aktuelltDesign) return;
  var sek = aktuelltDesign.sektioner.find(function (s) { return s.id === id; });
  if (!sek) return;

  var regler = ByggRegler.hamta(valtProjekt);
  var ui = regler ? regler.ui : null;
  if (ui) {
    for (var i = 0; i < ui.sliders.length; i++) {
      var s = ui.sliders[i];
      var val = s.nyckel === 'h' ? sek.egenskaper.h : sek[s.nyckel];
      var sliderEl = document.getElementById('slider-' + s.nyckel);
      var valEl = document.getElementById('slider-val-' + s.nyckel);
      if (sliderEl) sliderEl.value = val;
      if (valEl) valEl.textContent = s.format(val);
    }
  }

  renderRitvy();
}

function laggTillNySektion(sida, pos, start, slut) {
  if (!aktuelltDesign) return;
  var regler = ByggRegler.hamta(aktuelltDesign.projektTyp);
  var kantLangd = slut - start;
  var sektionstyp = (regler && regler.ui) ? regler.ui.sektionstyp : aktuelltDesign.sektioner[0].typ;

  var nyB, nyL, nyX, nyY;
  if (sida === 'syd' || sida === 'nord') {
    nyB = Math.min(kantLangd, regler ? regler.dim.b.max : 6);
    nyL = 2.0;
    nyX = start;
    nyY = sida === 'syd' ? pos : pos - nyL;
  } else {
    nyB = 2.0;
    nyL = Math.min(kantLangd, regler ? regler.dim.l.max : 6);
    nyX = sida === 'ost' ? pos : pos - nyB;
    nyY = start;
  }

  if (regler) {
    nyB = ByggRegler.klamma(nyB, regler.dim.b.min, regler.dim.b.max, regler.dim.b.steg);
    nyL = ByggRegler.klamma(nyL, regler.dim.l.min, regler.dim.l.max, regler.dim.l.steg);
  }

  var h0 = aktuelltDesign.sektioner[0] ? aktuelltDesign.sektioner[0].egenskaper.h : (regler ? regler.standard.h : 0.6);

  var nySek = DesignModell.laggTillSektion(aktuelltDesign, {
    typ: sektionstyp,
    x: nyX,
    y: nyY,
    b: nyB,
    l: nyL,
    egenskaper: { h: h0 }
  });

  if (nySek) {
    Editor.valjSektion(nySek.id);
    uppdateraFranDesign();
  }
}

function taBortNySektion(id) {
  if (!aktuelltDesign) return;
  if (DesignModell.taBortSektion(aktuelltDesign, id)) {
    Editor.valjSektion(aktuelltDesign.sektioner[0].id);
    uppdateraFranDesign();
  }
}

function faktor(skala, b, l) {
  var regler = ByggRegler.hamta(valtProjekt);
  var std = regler ? regler.standard : { b: 4, l: 3 };
  var basB = std.b, basL = std.l;
  if (skala === 'area')      return (b * l) / (basB * basL);
  if (skala === 'perimeter') return (2 * (b + l)) / (2 * (basB + basL));
  return 1;
}

function skalaAntal(base, skala, b, l) {
  return Math.max(1, Math.ceil(base * faktor(skala, b, l)));
}

function skalaTotalt(base, skala, b, l) {
  return Math.round(base * faktor(skala, b, l));
}


function uppdateraDimensioner() {
  var regler = ByggRegler.hamta(valtProjekt);
  if (!regler) return;
  var ui = regler.ui;

  // Las alla slider-varden
  var varden = {};
  var allaSliders = (ui.sliders || []).concat(ui.avancerat || []);
  for (var i = 0; i < allaSliders.length; i++) {
    var s = allaSliders[i];
    var el = document.getElementById('slider-' + s.nyckel);
    if (el) {
      varden[s.nyckel] = parseFloat(el.value);
      var valEl = document.getElementById('slider-val-' + s.nyckel);
      if (valEl) valEl.textContent = s.format(varden[s.nyckel]);
    }
  }

  var newB = varden.b !== undefined ? varden.b : aktuellaB;
  var newL = varden.l !== undefined ? varden.l : aktuellaL;
  var newH = varden.h !== undefined ? varden.h : aktuellaH;

  // Uppdatera vald sektion om multisektion
  if (aktuelltDesign && aktuelltDesign.sektioner.length > 1) {
    var valdId = Editor.valdSektionId();
    if (valdId) {
      DesignModell.andraSektion(aktuelltDesign, valdId, { b: newB, l: newL, egenskaper: { h: newH } });
    }
    aktuellaB = aktuelltDesign.sektioner[0].b;
    aktuellaL = aktuelltDesign.sektioner[0].l;
  } else {
    aktuellaB = newB;
    aktuellaL = newL;
  }
  aktuellaH = newH;

  // Total yta
  var ytaEl = document.getElementById('yta-val');
  if (ytaEl) {
    if (aktuelltDesign && aktuelltDesign.sektioner.length > 1) {
      var totalYta = aktuelltDesign.sektioner.reduce(function (s, sek) { return s + sek.b * sek.l; }, 0);
      ytaEl.textContent = totalYta.toFixed(1) + ' m\u00b2';
    } else {
      ytaEl.textContent = (aktuellaB * aktuellaL).toFixed(1) + ' m\u00b2';
    }
  }

  synkaDesign();
  uppdateraPreview();
  renderRitvy();
  uppdateraDimTip(aktuellaB, aktuellaL);
  uppdateraKostnadDisplay();

  var p = projekt[valtProjekt];
  if (p) {
    renderInkopslista(p, aktuellaB, aktuellaL);
    if (oppetSteg !== -1) renderInstruktioner(p);
  }
}

// ============================================================
// RITVY
// ============================================================

let ritvyOpen  = false;
let ritvyStyle = 'cad-iso';
let aktuellaH  = 0.6;
let rotAz      = Math.PI / 5;
let rotEl      = Math.PI / 4;
let zoomLevel  = 1.0;
let panX       = 0;
let panY       = 0;
let dragActive = false, dragMode = 'rotate', dragX0, dragY0, dragAz0, dragEl0, dragPanX0, dragPanY0;

// Synlighetslager for 3D-ritning
const lager = {
  trall:   true,
  reglar:  true,
  stolpar: true,
  racke:   true,
  husvagg: true,
  matt:    true
};

function toggleLager(namn) {
  lager[namn] = !lager[namn];
  const btn = document.getElementById('lager-' + namn);
  if (btn) btn.classList.toggle('lager-av', !lager[namn]);
  renderRitvy();
}

function oppnaRitvy() {
  ritvyOpen = !ritvyOpen;
  document.getElementById('ritvy-sektion').classList.toggle('dold', !ritvyOpen);
  document.getElementById('btn-ritvy').textContent = ritvyOpen ? '\u{1F4D0} St\u00e4ng detaljritning' : '\u{1F4D0} Anpassa och visa detaljritning';
  if (ritvyOpen) {
    byggRitvyKontroller(valtProjekt);
    uppdateraLagerPanel(valtProjekt);
    renderRitvy();
    initRitvyDrag();
  }
}

function byggRitvyKontroller(projektTyp) {
  var container = document.getElementById('ritvy-kontroller');
  if (!container) return;
  var regler = ByggRegler.hamta(projektTyp);
  if (!regler || !regler.ui) { container.innerHTML = ''; return; }

  var ui = regler.ui;
  var dim = regler.dim;
  var std = regler.standard;
  var html = '<h3 class="ritvy-kontroller-rubrik">Anpassa storleken</h3>';
  html += '<div class="ritvy-slider-grid">';

  // Vanliga sliders
  for (var i = 0; i < ui.sliders.length; i++) {
    var s = ui.sliders[i];
    var d = dim[s.nyckel];
    var val = s.nyckel === 'b' ? aktuellaB : s.nyckel === 'l' ? aktuellaL : s.nyckel === 'h' ? aktuellaH : std[s.nyckel];
    html += '<div class="pv-slider-block">';
    html += '<div class="pv-slider-header">';
    html += '<span class="pv-slider-label">' + s.etikett + '</span>';
    html += '<span class="pv-slider-val" id="slider-val-' + s.nyckel + '">' + s.format(val) + '</span>';
    html += '</div>';
    html += '<input type="range" id="slider-' + s.nyckel + '" min="' + d.min + '" max="' + d.max + '" step="' + d.steg + '" value="' + val + '" oninput="uppdateraDimensioner()">';
    html += '<div class="pv-slider-minmax"><span>' + s.format(d.min) + '</span><span>' + s.format(d.max) + '</span></div>';
    html += '</div>';
  }

  // Yta-sammanfattning
  if (ui.visaYta) {
    html += '<div class="pv-dim-summary">';
    html += '<div class="pv-yta-rad">';
    html += '<span>' + (ui.ytaEtikett || 'Yta') + '</span>';
    html += '<strong id="yta-val">' + (aktuellaB * aktuellaL).toFixed(1) + ' m\u00b2</strong>';
    html += '</div>';
    html += '<div class="pv-dim-tip" id="pv-dim-tip"></div>';
    html += '</div>';
  }

  // Avancerat
  if (ui.avancerat && ui.avancerat.length > 0) {
    html += '<div class="pv-slider-block">';
    html += '<button class="avancerat-toggle" id="avancerat-toggle" onclick="toggleAvancerat()">';
    html += '<span class="avancerat-pil" id="avancerat-pil">\u25b8</span>';
    html += ' Avancerade inst\u00e4llningar';
    html += '</button>';
    html += '<div id="avancerade-inst" class="avancerade-inst">';

    for (var j = 0; j < ui.avancerat.length; j++) {
      var a = ui.avancerat[j];
      var da = dim[a.nyckel];
      var va = a.nyckel === 'h' ? aktuellaH : std[a.nyckel];
      html += '<div class="pv-slider-block">';
      html += '<div class="pv-slider-header">';
      html += '<span class="pv-slider-label">' + a.etikett + '</span>';
      html += '<span class="pv-slider-val" id="slider-val-' + a.nyckel + '">' + a.format(va) + '</span>';
      html += '</div>';
      html += '<input type="range" id="slider-' + a.nyckel + '" min="' + da.min + '" max="' + da.max + '" step="' + da.steg + '" value="' + va + '" oninput="uppdateraHojd()">';
      html += '<div class="pv-slider-minmax"><span>' + a.format(da.min) + '</span><span>' + a.format(da.max) + '</span></div>';
      html += '</div>';
    }

    html += '<div class="avancerat-info" id="avancerat-racke-info"></div>';
    html += '</div>';
    html += '</div>';
  }

  html += '</div>';
  container.innerHTML = html;

  uppdateraDimTip(aktuellaB, aktuellaL);
  uppdateraRackeInfo(aktuellaH);
}

function uppdateraHojd() {
  var regler = ByggRegler.hamta(valtProjekt);
  var ui = regler ? regler.ui : null;

  // Las hojd fran ratt slider (vanlig eller avancerad)
  var hSlider = document.getElementById('slider-h');
  if (hSlider) {
    aktuellaH = parseFloat(hSlider.value);
    var hValEl = document.getElementById('slider-val-h');
    if (hValEl && ui) {
      // Hitta format-funktionen
      var alla = (ui.sliders || []).concat(ui.avancerat || []);
      for (var i = 0; i < alla.length; i++) {
        if (alla[i].nyckel === 'h') {
          hValEl.textContent = alla[i].format(aktuellaH);
          break;
        }
      }
    }
  }

  // Uppdatera hojd pa alla sektioner
  if (aktuelltDesign) {
    for (var j = 0; j < aktuelltDesign.sektioner.length; j++) {
      aktuelltDesign.sektioner[j].egenskaper.h = aktuellaH;
    }
  }
  synkaDesign();
  renderRitvy();
  uppdateraRackeInfo(aktuellaH);
  uppdateraKostnadDisplay();
}

function bytRitvyStyle(stil) {
  ritvyStyle = stil;
  document.querySelectorAll('.stil-knapp').forEach(k => k.classList.remove('aktiv-stil'));
  var btn = document.getElementById('stil-' + stil);
  if (btn) btn.classList.add('aktiv-stil');
  const lp = document.getElementById('lager-panel');
  if (lp) lp.style.display = stil === 'plan' || stil.startsWith('cad-') ? 'none' : 'flex';
  renderRitvy();
}

function aterStallVy() {
  rotAz = Math.PI / 5; rotEl = Math.PI / 4; zoomLevel = 1.0; panX = 0; panY = 0;
  renderRitvy();
}

function renderRitvy() {
  if (!ritvyOpen) return;
  const glCanvas = document.getElementById('ritvy-gl');
  const overlay = document.getElementById('ritvy-overlay');
  const planSvg = document.getElementById('ritvy-svg');
  const cadSvgContainer = document.getElementById('cad-svg-container');
  const cad3dContainer = document.getElementById('cad-3d-container');

  // Dölj allt först
  if (glCanvas) glCanvas.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
  if (planSvg) { planSvg.classList.add('dold'); planSvg.style.display = 'none'; }
  if (cadSvgContainer) { cadSvgContainer.classList.add('dold'); cadSvgContainer.style.display = 'none'; }
  if (cad3dContainer) { cad3dContainer.classList.add('dold'); cad3dContainer.style.display = 'none'; }

  if (ritvyStyle === 'cad-iso') {
    // Interaktiv 3D via Three.js
    if (cad3dContainer) {
      cad3dContainer.classList.remove('dold');
      cad3dContainer.style.display = 'block';
    }
    laddaCad3D();
  } else {
    // Statiska 2D SVG-vyer
    if (cadSvgContainer) {
      cadSvgContainer.classList.remove('dold');
      cadSvgContainer.style.display = 'flex';
    }
    hamtaCadSvg(ritvyStyle.replace('cad-', ''));
  }

  const canvasEl = document.querySelector('.ritvy-canvas');
  if (canvasEl) canvasEl.style.cursor = ritvyStyle === 'cad-iso' ? 'grab' : 'default';
}

// 3D-modell via Three.js
var cad3dLaddad = '';

function laddaCad3D() {
  if (!valtProjekt || !window.CadViewer) return;

  var url = cadServerUrl + '/cad/' + valtProjekt + '/3d?bredd=' + aktuellaB + '&langd=' + aktuellaL + '&hojd=' + aktuellaH;
  var key = valtProjekt + '_' + aktuellaB + '_' + aktuellaL + '_' + aktuellaH;

  CadViewer.init('cad-3d-container');

  if (cad3dLaddad !== key) {
    cad3dLaddad = key;
    CadViewer.load(url);
  }
}

// CAD-server integration
var cadCache = {};
var cadServerUrl = 'http://localhost:3002';

function hamtaCadSvg(vy) {
  var container = document.getElementById('cad-svg-container');
  if (!container || !valtProjekt) return;

  var cacheKey = valtProjekt + '_' + vy + '_' + aktuellaB + '_' + aktuellaL + '_' + aktuellaH;
  if (cadCache[cacheKey]) {
    container.innerHTML = cadCache[cacheKey];
    return;
  }

  container.innerHTML = '<p style="color:#888;font-style:italic">Laddar CAD-ritning...</p>';

  var url = cadServerUrl + '/cad/' + valtProjekt + '?bredd=' + aktuellaB + '&langd=' + aktuellaL + '&hojd=' + aktuellaH;

  fetch(url)
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.svgs && data.svgs[vy]) {
        cadCache[cacheKey] = data.svgs[vy];
        container.innerHTML = data.svgs[vy];
        // Skala SVG:en att fylla containern
        var svg = container.querySelector('svg');
        if (svg) {
          svg.style.width = '100%';
          svg.style.height = 'auto';
          svg.style.maxHeight = '600px';
        }
      } else {
        container.innerHTML = '<p style="color:red">Kunde inte ladda ritning</p>';
      }
    })
    .catch(function(err) {
      container.innerHTML = '<p style="color:red">CAD-server ej tillgänglig: ' + err.message + '</p>';
    });
}

function initRitvyDrag() {
  const canvas = document.querySelector('.ritvy-canvas');
  if (!canvas || canvas.dataset.dragInit) return;
  canvas.dataset.dragInit = '1';

  const down = (e) => {
    if (ritvyStyle === 'plan') return;
    dragActive = true;
    const t = e.touches?.[0] ?? e;
    dragX0 = t.clientX; dragY0 = t.clientY;
    // Shift+klick, mittenknapp eller tva fingrar → panorera
    const isPan = e.shiftKey || e.button === 1 || (e.touches && e.touches.length >= 2);
    dragMode = isPan ? 'pan' : 'rotate';
    dragAz0 = rotAz;    dragEl0 = rotEl;
    dragPanX0 = panX;   dragPanY0 = panY;
    canvas.style.cursor = isPan ? 'move' : 'grabbing';
    e.preventDefault();
  };
  const move = (e) => {
    if (!dragActive) return;
    const t = e.touches?.[0] ?? e;
    const dx = t.clientX - dragX0, dy = t.clientY - dragY0;
    if (dragMode === 'pan') {
      // Skala CSS-pixlar till virtuella koordinater (600x420)
      const cssW = canvas.clientWidth || 600;
      const scale = 600 / cssW;
      panX = dragPanX0 + dx * scale;
      panY = dragPanY0 + dy * scale;
    } else {
      rotAz = dragAz0 - dx * 0.013;
      rotEl = Math.max(-1.0, Math.min(1.3, dragEl0 + dy * 0.008));
    }
    renderRitvy();
    e.preventDefault();
  };
  const up = () => {
    dragActive = false;
    canvas.style.cursor = ritvyStyle === 'plan' ? 'default' : 'grab';
  };

  const wheel = (e) => {
    if (ritvyStyle === 'plan') return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    zoomLevel = Math.max(0.3, Math.min(8.0, zoomLevel + delta));
    renderRitvy();
  };

  canvas.addEventListener('mousedown',  down, { passive: false });
  canvas.addEventListener('touchstart', down, { passive: false });
  canvas.addEventListener('wheel',      wheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('mousemove',  move, { passive: false });
  window.addEventListener('touchmove',  move, { passive: false });
  window.addEventListener('mouseup',    up);
  window.addEventListener('touchend',   up);
}

// ----------------------------------------------------------------
// RITA3D WebGL — Ny 3D-rendering med z-buffer
// ----------------------------------------------------------------
let _glInitialized = false;

function rita3DWebGL(b, l, h, style) {
  const vW = 600, vH = 420;
  const palette = PALETTER[style];
  const glCanvas = document.getElementById('ritvy-gl');
  const overlayEl = document.getElementById('ritvy-overlay');
  if (!glCanvas || !overlayEl) return;

  // Hantera devicePixelRatio
  const dpr = window.devicePixelRatio || 1;
  if (glCanvas.width !== vW * dpr || glCanvas.height !== vH * dpr) {
    glCanvas.width = vW * dpr;
    glCanvas.height = vH * dpr;
  }

  // Initiera WebGL vid behov, eller återinitiera om kontext förlorad
  if (!_glInitialized || (Render3D._glState && Render3D._glState.gl.isContextLost())) {
    _glInitialized = false;
    Render3D._glState = null;
    if (!Render3D.initGL(glCanvas)) {
      // Fallback: rendera via SVG (gammal pipeline)
      overlayEl.setAttribute('viewBox', `0 0 ${vW} ${vH}`);
      overlayEl.innerHTML = rita3D(b, l, h, style);
      return;
    }
    _glInitialized = true;
  }
  const gl = Render3D._glState.gl;

  // Beräkna kontext-dimensioner
  var ctxB = b, ctxL = l, ctxH = h;
  if (aktuelltDesign && aktuelltDesign.sektioner.length > 1) {
    var bnds3d = DesignModell.bounds(aktuelltDesign);
    ctxB = bnds3d.b;
    ctxL = bnds3d.l;
  }
  if (aktuelltBerakning && aktuelltDesign) {
    var sek0 = aktuelltDesign.sektioner[0];
    var ber0 = aktuelltBerakning.perSektion[sek0.id];
    if (ber0 && ber0.nockHojd) ctxH = ber0.nockHojd;
  }

  const ctx = Render3D.skapaKontext(ctxB, ctxL, ctxH, rotAz, rotEl, zoomLevel, vW, vH, panX, panY);

  // Börja frame
  const clearColor = style === 'realistisk' ? [0.29, 0.62, 0.78, 1] : [1, 1, 1, 1];
  Render3D.beginFrame(gl, vW, vH, clearColor);

  // Bakgrundsgeometri
  const bgFaces = [];
  const bgLines = [];
  const bgTransparent = [];

  if (style === 'realistisk') {
    // Himmelgradient som två trianglar (top=mörkare, botten=ljusare)
    // Redan clearad med himmelsfärg, lägg till mark
    const gE = 12;
    bgFaces.push({ verts: [[-gE,-gE,0],[ctxB+gE,-gE,0],[ctxB+gE,ctxL+gE,0],[-gE,ctxL+gE,0]], fill: palette.mark.fill, stroke: 'none', sw: 0 });

    // Grid-linjer
    for (let gx = -gE; gx <= ctxB+gE; gx += 1.5) {
      bgLines.push({ type: 'line', p1: [gx,-gE,0], p2: [gx,ctxL+gE,0], color: palette.mark.stroke, sw: 0.3 });
    }

    // Skugga (transparent)
    bgTransparent.push({ verts: [[-0.5,-0.5,-0.001],[ctxB+0.5,-0.5,-0.001],[ctxB+0.5,ctxL+0.5,-0.001],[-0.5,ctxL+0.5,-0.001]], fill: '#000000', alpha: 0.18, stroke: 'none', sw: 0 });

  } else {
    // Teknisk: mark-polygon med streckad kant → overlay
    const gE = 3;
    bgFaces.push({ verts: [[-gE,-gE,0],[ctxB+gE,-gE,0],[ctxB+gE,ctxL+gE,0],[-gE,ctxL+gE,0]], fill: palette.mark.fill, stroke: 'none', sw: 0 });
  }

  // Hämta deklarativ modell och bygg geometri
  const p = projekt[valtProjekt];
  let modell = { faces: [], lines: [], overlay: [], transparent: [] };
  if (p && p.bygg3d) {
    var delar;
    if (aktuelltDesign && aktuelltBerakning) {
      delar = ByggGenerator.delar(aktuelltDesign, aktuelltBerakning);
    } else {
      delar = p.bygg3d(b, l, h);
    }
    modell = byggModellGL(delar, ctx, palette, style);
  }

  // Slå ihop bakgrund + modell
  const allFaces = bgFaces.concat(modell.faces);
  const allLines = bgLines.concat(modell.lines);
  const allTransparent = bgTransparent.concat(modell.transparent);

  // Rita allt via WebGL med gemensam djupnormalisering
  Render3D.renderScene(gl, ctx, allFaces, allLines, allTransparent, vW, vH);

  // Bygg SVG-overlay (text, mått, streckade linjer)
  overlayEl.setAttribute('viewBox', `0 0 ${vW} ${vH}`);
  let ov = '';

  // Streckade konturer från teknisk husvägg
  if (style === 'teknisk') {
    // Teknisk mark-kontur (streckad)
    const gE = 3;
    ov += Render3D.poly([[-gE,-gE,0],[ctxB+gE,-gE,0],[ctxB+gE,ctxL+gE,0],[-gE,ctxL+gE,0]].map(v => ctx.pt(...v)), 'none', palette.mark.stroke, 0.5, '4,3');
    ov += Render3D.poly([[0,0,0],[ctxB,0,0],[ctxB,ctxL,0],[0,ctxL,0]].map(v => ctx.pt(...v)), 'none', '#ccc', 0.5, '4,3');
  }

  // Overlay-element från modell
  for (const item of modell.overlay) {
    if (item.type === 'text') {
      const [tx, ty] = ctx.proj(item.pos[0], item.pos[1], item.pos[2]);
      ov += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${item.anchor || 'middle'}" font-size="${item.size || 10}" fill="${item.fill || '#999'}" font-family="Arial">${item.text}</text>`;
    } else if (item.type === 'dashedPoly') {
      ov += Render3D.poly(item.verts.map(v => ctx.pt(...v)), 'none', item.stroke, item.sw, item.dash);
    }
  }

  // Mått
  if (lager.matt) {
    const [blx, bly] = ctx.proj(ctxB/2, ctxL, h);
    const mattFarg = style === 'realistisk' ? '#222' : '#111';
    ov += `<text x="${blx.toFixed(3)}" y="${(bly+20).toFixed(3)}" text-anchor="middle" font-size="13" fill="${mattFarg}" font-family="Arial" font-weight="bold">${ctxB} m</text>`;
    const [dlx, dly] = ctx.proj(ctxB, ctxL/2, h);
    ov += `<text x="${(dlx+13).toFixed(3)}" y="${(dly+4).toFixed(3)}" font-size="13" fill="${mattFarg}" font-family="Arial" font-weight="bold">${ctxL} m</text>`;

    const [hx1, hy1] = ctx.proj(ctxB, ctxL, 0), [, hy2] = ctx.proj(ctxB, ctxL, h);
    if (style === 'teknisk') {
      ov += `<line x1="${(hx1+10).toFixed(3)}" y1="${hy1.toFixed(3)}" x2="${(hx1+10).toFixed(3)}" y2="${hy2.toFixed(3)}" stroke="#333" stroke-width="1"/>`;
      ov += `<line x1="${(hx1+6).toFixed(3)}" y1="${hy1.toFixed(3)}" x2="${(hx1+14).toFixed(3)}" y2="${hy1.toFixed(3)}" stroke="#333" stroke-width="1"/>`;
      ov += `<line x1="${(hx1+6).toFixed(3)}" y1="${hy2.toFixed(3)}" x2="${(hx1+14).toFixed(3)}" y2="${hy2.toFixed(3)}" stroke="#333" stroke-width="1"/>`;
      ov += `<text x="${(hx1+18).toFixed(3)}" y="${((hy1+hy2)/2+4).toFixed(3)}" font-size="11" fill="#333" font-family="Arial">${Math.round(h*100)} cm</text>`;
    } else {
      ov += `<line x1="${(hx1+10).toFixed(3)}" y1="${hy1.toFixed(3)}" x2="${(hx1+10).toFixed(3)}" y2="${hy2.toFixed(3)}" stroke="#555" stroke-width="1" stroke-dasharray="3,2"/>`;
      ov += `<text x="${(hx1+16).toFixed(3)}" y="${((hy1+hy2)/2+4).toFixed(3)}" font-size="11" fill="#444" font-family="Arial">${Math.round(h*100)} cm</text>`;
    }
  }

  // Titelrad
  var projektNamn = (p ? p.namn : valtProjekt).toUpperCase();
  if (style === 'teknisk') {
    ov += `<text x="${vW/2}" y="${vH-10}" text-anchor="middle" font-size="10" fill="#999" font-family="Arial">TEKNISK 3D — ${projektNamn} ${ctxB} × ${ctxL} m  |  Höjd ${Math.round(h*100)} cm</text>`;
  }
  ov += `<text x="${vW/2}" y="${vH - (style === 'teknisk' ? 24 : 8)}" text-anchor="middle" font-size="10" fill="rgba(0,0,0,0.3)" font-family="Arial">Dra = rotera · Shift+dra = panorera · Scroll = zooma</text>`;

  overlayEl.innerHTML = ov;
}


// ----------------------------------------------------------------
// RITA3D — Legacy SVG-rendering (för preview)
// ----------------------------------------------------------------
function rita3D(b, l, h, style) {
  const vW = 600, vH = 420;
  const palette = PALETTER[style];
  var ctxB = b, ctxL = l, ctxH = h;
  if (aktuelltDesign && aktuelltDesign.sektioner.length > 1) {
    var bnds3d = DesignModell.bounds(aktuelltDesign);
    ctxB = bnds3d.b;
    ctxL = bnds3d.l;
  }

  // For lekstuga: inkludera nockhojd i kontexthojden
  var regler = ByggRegler.hamta(valtProjekt);
  if (aktuelltBerakning && aktuelltDesign) {
    var sek0 = aktuelltDesign.sektioner[0];
    var ber0 = aktuelltBerakning.perSektion[sek0.id];
    if (ber0 && ber0.nockHojd) {
      ctxH = ber0.nockHojd;
    }
  }

  const ctx = Render3D.skapaKontext(ctxB, ctxL, ctxH, rotAz, rotEl, zoomLevel, vW, vH, panX, panY);

  let o = '';

  if (style === 'realistisk') {
    o += `<defs>
      <linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4a9fc8"/><stop offset="100%" stop-color="#c0e4f5"/>
      </linearGradient>
    </defs>`;
    o += `<rect width="${vW}" height="${vH}" fill="url(#gSky)"/>`;

    const gE = 12;
    const gPts = [ctx.pt(-gE, -gE, 0), ctx.pt(ctxB+gE, -gE, 0), ctx.pt(ctxB+gE, ctxL+gE, 0), ctx.pt(-gE, ctxL+gE, 0)];
    o += `<polygon points="${gPts.join(' ')}" fill="${palette.mark.fill}" stroke="none"/>`;

    for (let gx = -gE; gx <= ctxB+gE; gx += 1.5) {
      const [ax, ay] = ctx.proj(gx, -gE, 0), [bx2, by2] = ctx.proj(gx, ctxL+gE, 0);
      o += `<line x1="${ax.toFixed(3)}" y1="${ay.toFixed(3)}" x2="${bx2.toFixed(3)}" y2="${by2.toFixed(3)}" stroke="${palette.mark.stroke}" stroke-width="0.3" opacity="0.4"/>`;
    }

    const [scx, scy] = ctx.proj(ctxB/2, ctxL/2, 0);
    o += `<ellipse cx="${scx.toFixed(3)}" cy="${(scy + h*ctx.s*0.05).toFixed(3)}" rx="${((ctxB+ctxL)*ctx.s*0.28).toFixed(3)}" ry="${((ctxB+ctxL)*ctx.s*0.055).toFixed(3)}" fill="rgba(0,0,0,0.18)"/>`;
  } else {
    o += `<rect width="${vW}" height="${vH}" fill="white"/>`;
    const gE = 3;
    o += Render3D.poly([[-gE,-gE,0],[ctxB+gE,-gE,0],[ctxB+gE,ctxL+gE,0],[-gE,ctxL+gE,0]].map(v => ctx.pt(...v)), palette.mark.fill, palette.mark.stroke, 0.5, '4,3');
    o += Render3D.poly([[0,0,0],[ctxB,0,0],[ctxB,ctxL,0],[0,ctxL,0]].map(v => ctx.pt(...v)), 'none', '#ccc', 0.5, '4,3');
  }

  // Hamta deklarativ modell och bygg SVG
  const p = projekt[valtProjekt];
  if (p && p.bygg3d) {
    var delar;
    if (aktuelltDesign && aktuelltDesign.sektioner.length > 1 && aktuelltBerakning) {
      delar = ByggGenerator.delar(aktuelltDesign, aktuelltBerakning);
    } else if (aktuelltDesign && aktuelltBerakning) {
      delar = ByggGenerator.delar(aktuelltDesign, aktuelltBerakning);
    } else {
      delar = p.bygg3d(b, l, h);
    }
    o += byggModell(delar, ctx, palette, style);
  }

  // Matt
  if (lager.matt) {
    const [blx, bly] = ctx.proj(ctxB/2, ctxL, h);
    const mattFarg = style === 'realistisk' ? '#222' : '#111';
    o += `<text x="${blx.toFixed(3)}" y="${(bly+20).toFixed(3)}" text-anchor="middle" font-size="13" fill="${mattFarg}" font-family="Arial" font-weight="bold">${ctxB} m</text>`;
    const [dlx, dly] = ctx.proj(ctxB, ctxL/2, h);
    o += `<text x="${(dlx+13).toFixed(3)}" y="${(dly+4).toFixed(3)}" font-size="13" fill="${mattFarg}" font-family="Arial" font-weight="bold">${ctxL} m</text>`;

    const [hx1, hy1] = ctx.proj(ctxB, ctxL, 0), [, hy2] = ctx.proj(ctxB, ctxL, h);
    if (style === 'teknisk') {
      o += `<line x1="${(hx1+10).toFixed(3)}" y1="${hy1.toFixed(3)}" x2="${(hx1+10).toFixed(3)}" y2="${hy2.toFixed(3)}" stroke="#333" stroke-width="1"/>`;
      o += `<line x1="${(hx1+6).toFixed(3)}" y1="${hy1.toFixed(3)}" x2="${(hx1+14).toFixed(3)}" y2="${hy1.toFixed(3)}" stroke="#333" stroke-width="1"/>`;
      o += `<line x1="${(hx1+6).toFixed(3)}" y1="${hy2.toFixed(3)}" x2="${(hx1+14).toFixed(3)}" y2="${hy2.toFixed(3)}" stroke="#333" stroke-width="1"/>`;
      o += `<text x="${(hx1+18).toFixed(3)}" y="${((hy1+hy2)/2+4).toFixed(3)}" font-size="11" fill="#333" font-family="Arial">${Math.round(h*100)} cm</text>`;
    } else {
      o += `<line x1="${(hx1+10).toFixed(3)}" y1="${hy1.toFixed(3)}" x2="${(hx1+10).toFixed(3)}" y2="${hy2.toFixed(3)}" stroke="#555" stroke-width="1" stroke-dasharray="3,2"/>`;
      o += `<text x="${(hx1+16).toFixed(3)}" y="${((hy1+hy2)/2+4).toFixed(3)}" font-size="11" fill="#444" font-family="Arial">${Math.round(h*100)} cm</text>`;
    }
  }

  // Titelrad — generisk
  var projektNamn = (p ? p.namn : valtProjekt).toUpperCase();
  if (style === 'teknisk') {
    o += `<text x="${vW/2}" y="${vH-10}" text-anchor="middle" font-size="10" fill="#999" font-family="Arial">TEKNISK 3D \u2014 ${projektNamn} ${ctxB} \u00d7 ${ctxL} m  |  H\u00f6jd ${Math.round(h*100)} cm</text>`;
  }
  o += `<text x="${vW/2}" y="${vH - (style === 'teknisk' ? 24 : 8)}" text-anchor="middle" font-size="10" fill="rgba(0,0,0,0.3)" font-family="Arial">Dra = rotera \u00b7 Shift+dra = panorera \u00b7 Scroll = zooma</text>`;

  return o;
}

// ----------------------------------------------------------------
// 3D PREVIEW — Fotorealistisk vy utan matt/titlar
// ----------------------------------------------------------------
function rita3DPreview(b, l, h, vW, vH) {
  const palette = PALETTER.realistisk;
  var ctxB = b, ctxL = l, ctxH = h;
  if (aktuelltDesign && aktuelltDesign.sektioner.length > 1) {
    var bnds3d = DesignModell.bounds(aktuelltDesign);
    ctxB = bnds3d.b;
    ctxL = bnds3d.l;
  }
  if (aktuelltBerakning && aktuelltDesign) {
    var sek0 = aktuelltDesign.sektioner[0];
    var ber0 = aktuelltBerakning.perSektion[sek0.id];
    if (ber0 && ber0.nockHojd) ctxH = ber0.nockHojd;
  }

  const ctx = Render3D.skapaKontext(ctxB, ctxL, ctxH, rotAz, rotEl, zoomLevel, vW, vH, panX, panY);

  // Defs: himmel, gras, skugga, vinjett
  let o = `<defs>
    <linearGradient id="pvSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3b8ec2"/>
      <stop offset="45%" stop-color="#7bbde8"/>
      <stop offset="72%" stop-color="#b8ddf5"/>
      <stop offset="88%" stop-color="#daeef9"/>
      <stop offset="100%" stop-color="#e8ebe0"/>
    </linearGradient>
    <linearGradient id="pvGrass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5a9a38"/>
      <stop offset="100%" stop-color="#4a8830"/>
    </linearGradient>
    <pattern id="pvGrassTex" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="#5a9a38"/>
      <line x1="1" y1="0" x2="0.5" y2="3" stroke="#4e8e2e" stroke-width="0.5" opacity="0.5"/>
      <line x1="3.5" y1="1" x2="3" y2="4.5" stroke="#68a840" stroke-width="0.4" opacity="0.4"/>
      <line x1="5" y1="0.5" x2="4.5" y2="3.5" stroke="#4e8e2e" stroke-width="0.3" opacity="0.3"/>
    </pattern>
    <filter id="pvShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur"/>
      <feOffset dx="3" dy="5" result="off"/>
      <feFlood flood-color="#000" flood-opacity="0.25" result="color"/>
      <feComposite in="color" in2="off" operator="in" result="shadow"/>
      <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="pvVign" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.15)"/>
    </radialGradient>
  </defs>`;

  // Himmel
  o += `<rect width="${vW}" height="${vH}" fill="url(#pvSky)"/>`;

  // Moln
  var mY = vH * 0.15;
  o += `<ellipse cx="${vW*0.2}" cy="${mY}" rx="50" ry="14" fill="white" opacity="0.5"/>`;
  o += `<ellipse cx="${vW*0.22}" cy="${mY-4}" rx="35" ry="11" fill="white" opacity="0.6"/>`;
  o += `<ellipse cx="${vW*0.7}" cy="${mY+15}" rx="60" ry="12" fill="white" opacity="0.35"/>`;
  o += `<ellipse cx="${vW*0.73}" cy="${mY+10}" rx="40" ry="10" fill="white" opacity="0.45"/>`;

  // Mark (gras)
  const gE = 14;
  const gPts = [ctx.pt(-gE, -gE, 0), ctx.pt(ctxB+gE, -gE, 0), ctx.pt(ctxB+gE, ctxL+gE, 0), ctx.pt(-gE, ctxL+gE, 0)];
  o += `<polygon points="${gPts.join(' ')}" fill="url(#pvGrass)"/>`;
  o += `<polygon points="${gPts.join(' ')}" fill="url(#pvGrassTex)" opacity="0.6"/>`;

  // Mjuk markskugga under konstruktionen
  const sOff = 0.3;
  const sPts = [ctx.pt(-sOff, -sOff, 0), ctx.pt(ctxB+sOff, -sOff, 0), ctx.pt(ctxB+sOff, ctxL+sOff, 0), ctx.pt(-sOff, ctxL+sOff, 0)];
  o += `<polygon points="${sPts.join(' ')}" fill="rgba(0,0,0,0.22)" filter="url(#pvShadow)"/>`;

  // 3D-modell
  const p = projekt[valtProjekt];
  if (p && p.bygg3d) {
    var delar;
    if (aktuelltDesign && aktuelltBerakning) {
      delar = ByggGenerator.delar(aktuelltDesign, aktuelltBerakning);
    } else {
      delar = p.bygg3d(b, l, h);
    }
    o += byggModell(delar, ctx, palette, 'realistisk');
  }

  // Vinjett-overlay
  o += `<rect width="${vW}" height="${vH}" fill="url(#pvVign)" pointer-events="none"/>`;

  return o;
}

// ----------------------------------------------------------------
// PLANRITNING
// ----------------------------------------------------------------
function planRitning(b, l, h) {
  if (aktuelltDesign && aktuelltDesign.sektioner.length > 1) {
    var valdId = Editor.valdSektionId();
    var valdSek = aktuelltDesign.sektioner.find(function (s) { return s.id === valdId; });
    if (valdSek) {
      b = valdSek.b;
      l = valdSek.l;
      h = valdSek.egenskaper.h || h;
    }
  }

  const vW = 840, vH = 680;
  const rH = h > 0.5 ? 0.9 : 0;
  const totalH = h + rH;
  const bP = stolpArr(b), lP = stolpArr(l);
  const ps = 6;

  const planW = 420, planH = 280;
  const elevW = 420, elevH = 180;
  const sideW = 280, sideH = 280;

  const sc = Math.min(
    (planW - 80) / b, (planH - 60) / l,
    (elevW - 80) / b, (elevH - 60) / totalH,
    (sideW - 80) / l, (sideH - 60) / totalH
  );

  let o = `<rect width="${vW}" height="${vH}" fill="white"/>`;

  function dimH(x0, x1, y, label) {
    let d = '';
    d += `<line x1="${x0.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#333" stroke-width="0.8"/>`;
    d += `<line x1="${x0.toFixed(1)}" y1="${(y-4).toFixed(1)}" x2="${x0.toFixed(1)}" y2="${(y+4).toFixed(1)}" stroke="#333" stroke-width="0.8"/>`;
    d += `<line x1="${x1.toFixed(1)}" y1="${(y-4).toFixed(1)}" x2="${x1.toFixed(1)}" y2="${(y+4).toFixed(1)}" stroke="#333" stroke-width="0.8"/>`;
    d += `<text x="${((x0+x1)/2).toFixed(1)}" y="${(y-5).toFixed(1)}" text-anchor="middle" font-size="10" fill="#111" font-family="Arial">${label}</text>`;
    return d;
  }
  function dimV(x, y0, y1, label) {
    let d = '';
    d += `<line x1="${x.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="#333" stroke-width="0.8"/>`;
    d += `<line x1="${(x-4).toFixed(1)}" y1="${y0.toFixed(1)}" x2="${(x+4).toFixed(1)}" y2="${y0.toFixed(1)}" stroke="#333" stroke-width="0.8"/>`;
    d += `<line x1="${(x-4).toFixed(1)}" y1="${y1.toFixed(1)}" x2="${(x+4).toFixed(1)}" y2="${y1.toFixed(1)}" stroke="#333" stroke-width="0.8"/>`;
    d += `<text x="${(x-6).toFixed(1)}" y="${((y0+y1)/2+3).toFixed(1)}" text-anchor="end" font-size="10" fill="#111" font-family="Arial" transform="rotate(-90,${(x-6).toFixed(1)},${((y0+y1)/2+3).toFixed(1)})">${label}</text>`;
    return d;
  }
  function sectionLabel(x, y, label) {
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="12" fill="#333" font-family="Arial" font-weight="bold">${label}</text>`;
  }

  const divX = 470;
  const divY = 370;
  o += `<line x1="${divX}" y1="0" x2="${divX}" y2="${divY}" stroke="#bbb" stroke-width="0.5" stroke-dasharray="4,3"/>`;
  o += `<line x1="0" y1="${divY}" x2="${vW}" y2="${divY}" stroke="#bbb" stroke-width="0.5" stroke-dasharray="4,3"/>`;
  o += `<line x1="${divX}" y1="${divY}" x2="${divX}" y2="${vH-50}" stroke="#bbb" stroke-width="0.5" stroke-dasharray="4,3"/>`;

  // 1. PLANVY
  {
    var sektioner = aktuelltDesign ? aktuelltDesign.sektioner : [{ x: 0, y: 0, b: b, l: l, id: '_', egenskaper: { h: h } }];
    var bnds = aktuelltDesign ? DesignModell.bounds(aktuelltDesign) : { x: 0, y: 0, b: b, l: l };
    var planB = bnds.b, planL = bnds.l;

    var planAvailW = planW - 80, planAvailH = planH - 60;
    var planSc = Math.min(planAvailW / planB, planAvailH / planL, sc);
    var ox = 70 + (planAvailW - planB * planSc) / 2 - bnds.x * planSc;
    var oy = 45 + (planAvailH - planL * planSc) / 2 - bnds.y * planSc;

    var psc = planSc;
    var planCenterX = ox + bnds.x * psc + planB * psc / 2;
    o += sectionLabel(planCenterX, oy + bnds.y * psc - 22, 'PLAN');

    var cutY = oy + bnds.y * psc + planL * psc * 0.5;
    var cutX0 = ox + bnds.x * psc - 20;
    var cutX1 = ox + (bnds.x + planB) * psc + 20;
    o += `<line x1="${cutX0.toFixed(1)}" y1="${cutY.toFixed(1)}" x2="${cutX1.toFixed(1)}" y2="${cutY.toFixed(1)}" stroke="#c00" stroke-width="0.8" stroke-dasharray="8,3,2,3"/>`;
    o += `<text x="${(cutX0-4).toFixed(1)}" y="${(cutY+4).toFixed(1)}" text-anchor="end" font-size="10" fill="#c00" font-family="Arial" font-weight="bold">A</text>`;
    o += `<text x="${(cutX1+4).toFixed(1)}" y="${(cutY+4).toFixed(1)}" font-size="10" fill="#c00" font-family="Arial" font-weight="bold">A</text>`;

    for (var si = 0; si < sektioner.length; si++) {
      var sek = sektioner[si];
      var sx = ox + sek.x * psc;
      var sy = oy + sek.y * psc;
      var dW = sek.b * psc;
      var dH = sek.l * psc;

      o += `<rect x="${sx.toFixed(1)}" y="${sy.toFixed(1)}" width="${dW.toFixed(1)}" height="${dH.toFixed(1)}" fill="#f9f9f9"/>`;

      var tSp = 0.125 * psc;
      for (var ty = tSp * 0.5; ty < dH; ty += tSp)
        o += `<line x1="${(sx+2).toFixed(1)}" y1="${(sy+ty).toFixed(1)}" x2="${(sx+dW-2).toFixed(1)}" y2="${(sy+ty).toFixed(1)}" stroke="#ddd" stroke-width="0.6"/>`;

      o += `<rect x="${sx.toFixed(1)}" y="${sy.toFixed(1)}" width="${dW.toFixed(1)}" height="${dH.toFixed(1)}" fill="none" stroke="#000" stroke-width="2.5"/>`;
      o += `<rect x="${(sx+4).toFixed(1)}" y="${(sy+4).toFixed(1)}" width="${(dW-8).toFixed(1)}" height="${(dH-8).toFixed(1)}" fill="none" stroke="#555" stroke-width="0.6" stroke-dasharray="3,2"/>`;

      var sekBP = aktuelltBerakning && aktuelltBerakning.perSektion[sek.id]
        ? aktuelltBerakning.perSektion[sek.id].stolpPosB
        : stolpArr(sek.b);
      var sekLP = aktuelltBerakning && aktuelltBerakning.perSektion[sek.id]
        ? aktuelltBerakning.perSektion[sek.id].stolpPosL
        : stolpArr(sek.l);

      for (var pi = 0; pi < sekBP.length; pi++) {
        for (var pj = 0; pj < 2; pj++) {
          var py2 = pj === 0 ? 0 : sek.l;
          var spx = sx + sekBP[pi] * psc - ps / 2;
          var spy = sy + py2 * psc - ps / 2;
          o += `<rect x="${spx.toFixed(1)}" y="${spy.toFixed(1)}" width="${ps}" height="${ps}" fill="#111"/>`;
          o += `<rect x="${(spx+1.5).toFixed(1)}" y="${(spy+1.5).toFixed(1)}" width="${ps-3}" height="${ps-3}" fill="none" stroke="white" stroke-width="0.5"/>`;
        }
      }
      for (var pi2 = 0; pi2 < sekLP.length; pi2++) {
        if (sekLP[pi2] > 0 && sekLP[pi2] < sek.l) {
          for (var pj2 = 0; pj2 < 2; pj2++) {
            var px2 = pj2 === 0 ? 0 : sek.b;
            var spx2 = sx + px2 * psc - ps / 2;
            var spy2 = sy + sekLP[pi2] * psc - ps / 2;
            o += `<rect x="${spx2.toFixed(1)}" y="${spy2.toFixed(1)}" width="${ps}" height="${ps}" fill="#111"/>`;
          }
        }
      }

      for (var bi = 0; bi < sekBP.length; bi++) {
        var lx = sx + sekBP[bi] * psc;
        o += `<line x1="${lx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${lx.toFixed(1)}" y2="${(sy+dH).toFixed(1)}" stroke="#888" stroke-width="0.8" stroke-dasharray="4,3"/>`;
      }
    }

    // Husmur (om projektreglerna anger husvagg)
    var regler = ByggRegler.hamta(valtProjekt); if (regler && regler.planExtras && regler.planExtras.husvagg) {
      var husX0 = ox + bnds.x * psc - 10;
      var husBW = planB * psc + 20;
      var husH = 14;
      var husY0 = oy + bnds.y * psc - husH;
      o += `<rect x="${husX0.toFixed(1)}" y="${husY0.toFixed(1)}" width="${husBW.toFixed(1)}" height="${husH}" fill="#e8e8e8" stroke="#333" stroke-width="1.2"/>`;
      for (var hx = -3; hx < husBW; hx += 6)
        o += `<line x1="${(husX0+hx).toFixed(1)}" y1="${husY0.toFixed(1)}" x2="${(husX0+hx+husH).toFixed(1)}" y2="${(husY0+husH).toFixed(1)}" stroke="#ccc" stroke-width="0.6"/>`;
      o += `<rect x="${husX0.toFixed(1)}" y="${husY0.toFixed(1)}" width="${husBW.toFixed(1)}" height="${husH}" fill="none" stroke="#333" stroke-width="1.2"/>`;
      o += `<text x="${(husX0+husBW/2).toFixed(1)}" y="${(husY0+husH-4).toFixed(1)}" text-anchor="middle" font-size="8" fill="#444" font-family="Arial" font-weight="bold">HUS</text>`;
    }

    var dimOx = ox + bnds.x * psc;
    var dimOy = oy + bnds.y * psc;
    o += dimH(dimOx, dimOx + planB * psc, dimOy + planL * psc + 20, `${planB} m`);
    o += dimV(dimOx - 22, dimOy, dimOy + planL * psc, `${planL} m`);

    if (sektioner.length === 1 && sekBP && sekBP.length > 1) {
      var cc = (sekBP[1] - sekBP[0]) * 1000;
      o += dimH(dimOx + sekBP[0]*psc, dimOx + sekBP[1]*psc, dimOy + planL * psc + 36, `c/c ${cc.toFixed(0)} mm`);
    }

    Editor.setPlanInfo(ox, oy, psc);
    o += Editor.planHandles();
  }

  // 2. FRAMSIDA
  {
    const ox = 70, oy = divY + 35;
    const dW = b * sc, dTotalH = totalH * sc;
    const dH = h * sc;
    const baseY = oy + dTotalH;

    o += sectionLabel(ox + dW/2, oy - 12, 'FRAMSIDA');

    o += `<line x1="${(ox-15).toFixed(1)}" y1="${baseY.toFixed(1)}" x2="${(ox+dW+15).toFixed(1)}" y2="${baseY.toFixed(1)}" stroke="#333" stroke-width="1.5"/>`;
    for (let mx = -15; mx < dW + 15; mx += 8)
      o += `<line x1="${(ox+mx).toFixed(1)}" y1="${baseY.toFixed(1)}" x2="${(ox+mx-5).toFixed(1)}" y2="${(baseY+5).toFixed(1)}" stroke="#666" stroke-width="0.6"/>`;

    for (const px of bP) {
      const sx = ox + px * sc;
      o += `<rect x="${(sx-3).toFixed(1)}" y="${(baseY-dH).toFixed(1)}" width="6" height="${dH.toFixed(1)}" fill="#ddd" stroke="#333" stroke-width="1"/>`;
    }

    o += `<rect x="${ox.toFixed(1)}" y="${(baseY-dH-3).toFixed(1)}" width="${dW.toFixed(1)}" height="6" fill="#ccc" stroke="#333" stroke-width="1"/>`;
    for (let tx = 5; tx < dW; tx += 0.125 * sc) {
      o += `<line x1="${(ox+tx).toFixed(1)}" y1="${(baseY-dH-3).toFixed(1)}" x2="${(ox+tx).toFixed(1)}" y2="${(baseY-dH+3).toFixed(1)}" stroke="#999" stroke-width="0.4"/>`;
    }

    if (rH > 0) {
      const rHpx = rH * sc;
      for (const px of bP) {
        const sx = ox + px * sc;
        o += `<rect x="${(sx-2).toFixed(1)}" y="${(baseY-dH-rHpx).toFixed(1)}" width="4" height="${rHpx.toFixed(1)}" fill="none" stroke="#333" stroke-width="1"/>`;
      }
      o += `<rect x="${ox.toFixed(1)}" y="${(baseY-dH-rHpx).toFixed(1)}" width="${dW.toFixed(1)}" height="4" fill="#ddd" stroke="#333" stroke-width="1"/>`;
      o += `<line x1="${ox.toFixed(1)}" y1="${(baseY-dH-rHpx*0.5).toFixed(1)}" x2="${(ox+dW).toFixed(1)}" y2="${(baseY-dH-rHpx*0.5).toFixed(1)}" stroke="#333" stroke-width="0.8"/>`;
    }

    o += dimH(ox, ox + dW, baseY + 16, `${b} m`);
    o += dimV(ox - 22, baseY - dH, baseY, `${Math.round(h*100)} cm`);
    if (rH > 0)
      o += dimV(ox + dW + 14, baseY - dH - rH*sc, baseY - dH, `${Math.round(rH*100)} cm`);
  }

  // 3. GAVELSIDA
  {
    const ox = divX + 55, oy = 45;
    const dW = l * sc, dTotalH = totalH * sc;
    const dH = h * sc;
    const baseY = oy + dTotalH;

    o += sectionLabel(ox + dW/2, oy - 22, 'GAVELSIDA');

    o += `<line x1="${(ox-15).toFixed(1)}" y1="${baseY.toFixed(1)}" x2="${(ox+dW+15).toFixed(1)}" y2="${baseY.toFixed(1)}" stroke="#333" stroke-width="1.5"/>`;
    for (let mx = -15; mx < dW + 15; mx += 8)
      o += `<line x1="${(ox+mx).toFixed(1)}" y1="${baseY.toFixed(1)}" x2="${(ox+mx-5).toFixed(1)}" y2="${(baseY+5).toFixed(1)}" stroke="#666" stroke-width="0.6"/>`;

    const wallHpx = Math.min(2.5, h + 1.6) * sc;
    var regler2 = ByggRegler.hamta(valtProjekt); if (regler2 && regler2.planExtras && regler2.planExtras.husvagg) {
      o += `<rect x="${(ox-12).toFixed(1)}" y="${(baseY-wallHpx).toFixed(1)}" width="12" height="${wallHpx.toFixed(1)}" fill="#e8e8e8" stroke="#333" stroke-width="1.2"/>`;
      for (let wy = 0; wy < wallHpx; wy += 8)
        o += `<line x1="${(ox-12).toFixed(1)}" y1="${(baseY-wy).toFixed(1)}" x2="${ox.toFixed(1)}" y2="${(baseY-wy).toFixed(1)}" stroke="#ccc" stroke-width="0.5"/>`;
      o += `<text x="${(ox-6).toFixed(1)}" y="${(baseY-wallHpx-4).toFixed(1)}" text-anchor="middle" font-size="7" fill="#666" font-family="Arial">HUS</text>`;
    }

    for (const py of lP) {
      const sx = ox + py * sc;
      o += `<rect x="${(sx-3).toFixed(1)}" y="${(baseY-dH).toFixed(1)}" width="6" height="${dH.toFixed(1)}" fill="#ddd" stroke="#333" stroke-width="1"/>`;
    }

    o += `<rect x="${ox.toFixed(1)}" y="${(baseY-dH-3).toFixed(1)}" width="${dW.toFixed(1)}" height="6" fill="#ccc" stroke="#333" stroke-width="1"/>`;

    if (rH > 0) {
      const rHpx = rH * sc;
      for (const py of lP) {
        const sx = ox + py * sc;
        o += `<rect x="${(sx-2).toFixed(1)}" y="${(baseY-dH-rHpx).toFixed(1)}" width="4" height="${rHpx.toFixed(1)}" fill="none" stroke="#333" stroke-width="1"/>`;
      }
      o += `<rect x="${ox.toFixed(1)}" y="${(baseY-dH-rHpx).toFixed(1)}" width="${dW.toFixed(1)}" height="4" fill="#ddd" stroke="#333" stroke-width="1"/>`;
      o += `<line x1="${ox.toFixed(1)}" y1="${(baseY-dH-rHpx*0.5).toFixed(1)}" x2="${(ox+dW).toFixed(1)}" y2="${(baseY-dH-rHpx*0.5).toFixed(1)}" stroke="#333" stroke-width="0.8"/>`;
    }

    if (h > 0.3) {
      const nSteps = Math.max(1, Math.round(h / 0.18));
      const stepH = dH / nSteps;
      const stepD = 18;
      for (let si2 = 0; si2 < nSteps; si2++) {
        const sy2 = baseY - stepH * (si2 + 1);
        const sx2 = ox + dW + si2 * stepD;
        o += `<rect x="${sx2.toFixed(1)}" y="${sy2.toFixed(1)}" width="${stepD}" height="${stepH.toFixed(1)}" fill="#eee" stroke="#333" stroke-width="0.8"/>`;
      }
    }

    o += dimH(ox, ox + dW, baseY + 16, `${l} m`);
    o += dimV(ox + dW + (h > 0.3 ? 50 : 14), baseY - dH, baseY, `${Math.round(h*100)} cm`);
  }

  // 4. SNITT A-A
  {
    const ox = divX + 55, oy = divY + 35;
    const dW = b * sc, dTotalH = totalH * sc;
    const dH = h * sc;
    const baseY = oy + dTotalH;

    o += sectionLabel(ox + dW/2, oy - 12, 'SNITT A\u2013A');

    o += `<line x1="${(ox-15).toFixed(1)}" y1="${baseY.toFixed(1)}" x2="${(ox+dW+15).toFixed(1)}" y2="${baseY.toFixed(1)}" stroke="#333" stroke-width="1.5"/>`;
    for (let mx = -15; mx < dW + 15; mx += 8)
      o += `<line x1="${(ox+mx).toFixed(1)}" y1="${baseY.toFixed(1)}" x2="${(ox+mx-5).toFixed(1)}" y2="${(baseY+5).toFixed(1)}" stroke="#666" stroke-width="0.6"/>`;

    for (const px of bP) {
      const sx = ox + px * sc;
      o += `<rect x="${(sx-8).toFixed(1)}" y="${baseY.toFixed(1)}" width="16" height="10" fill="#ccc" stroke="#999" stroke-width="0.8"/>`;
    }

    for (const px of bP) {
      const sx = ox + px * sc;
      const sW = 8, sH2 = dH;
      o += `<rect x="${(sx-sW/2).toFixed(1)}" y="${(baseY-sH2).toFixed(1)}" width="${sW}" height="${sH2.toFixed(1)}" fill="#e0e0e0" stroke="#333" stroke-width="1"/>`;
      o += `<line x1="${(sx-sW/2).toFixed(1)}" y1="${(baseY-sH2).toFixed(1)}" x2="${(sx+sW/2).toFixed(1)}" y2="${baseY.toFixed(1)}" stroke="#999" stroke-width="0.5"/>`;
      o += `<line x1="${(sx+sW/2).toFixed(1)}" y1="${(baseY-sH2).toFixed(1)}" x2="${(sx-sW/2).toFixed(1)}" y2="${baseY.toFixed(1)}" stroke="#999" stroke-width="0.5"/>`;
    }

    o += `<rect x="${ox.toFixed(1)}" y="${(baseY-dH-5).toFixed(1)}" width="${dW.toFixed(1)}" height="5" fill="#d0d0d0" stroke="#333" stroke-width="1"/>`;
    o += `<text x="${(ox+dW/2).toFixed(1)}" y="${(baseY-dH-8).toFixed(1)}" text-anchor="middle" font-size="7" fill="#666" font-family="Arial">45\u00d7195 b\u00e4rlina</text>`;

    o += `<rect x="${ox.toFixed(1)}" y="${(baseY-dH-8).toFixed(1)}" width="${dW.toFixed(1)}" height="3" fill="#bbb" stroke="#333" stroke-width="0.8"/>`;
    o += `<text x="${(ox+dW+6).toFixed(1)}" y="${(baseY-dH-5).toFixed(1)}" font-size="7" fill="#666" font-family="Arial">28\u00d7120 trall</text>`;

    if (rH > 0) {
      const rHpx = rH * sc;
      o += `<rect x="${(ox-2).toFixed(1)}" y="${(baseY-dH-rHpx).toFixed(1)}" width="4" height="${rHpx.toFixed(1)}" fill="none" stroke="#333" stroke-width="1"/>`;
      o += `<rect x="${(ox+dW-2).toFixed(1)}" y="${(baseY-dH-rHpx).toFixed(1)}" width="4" height="${rHpx.toFixed(1)}" fill="none" stroke="#333" stroke-width="1"/>`;
      o += `<line x1="${ox.toFixed(1)}" y1="${(baseY-dH-rHpx).toFixed(1)}" x2="${(ox+dW).toFixed(1)}" y2="${(baseY-dH-rHpx).toFixed(1)}" stroke="#333" stroke-width="1.5"/>`;
      o += `<line x1="${ox.toFixed(1)}" y1="${(baseY-dH-rHpx*0.5).toFixed(1)}" x2="${(ox+dW).toFixed(1)}" y2="${(baseY-dH-rHpx*0.5).toFixed(1)}" stroke="#333" stroke-width="0.8"/>`;
      o += dimV(ox + dW + 14, baseY - dH - rHpx, baseY - dH, `${Math.round(rH*100)} cm`);
    }

    o += dimH(ox, ox + dW, baseY + 18, `${b} m`);
    o += dimV(ox - 20, baseY - dH, baseY, `${Math.round(h*100)} cm`);

    if (bP.length > 1)
      o += dimH(ox + bP[0]*sc, ox + bP[1]*sc, baseY + 32, `c/c ${((bP[1]-bP[0])*1000).toFixed(0)}`);
  }

  // TITELRUTA
  {
    var projektNamn = projekt[valtProjekt] ? projekt[valtProjekt].namn.toUpperCase() : 'PROJEKT';
    const tbY = vH - 50, tbH = 50;
    o += `<rect x="0" y="${tbY}" width="${vW}" height="${tbH}" fill="#f8f8f8" stroke="#333" stroke-width="1"/>`;
    o += `<line x1="200" y1="${tbY}" x2="200" y2="${vH}" stroke="#333" stroke-width="0.5"/>`;
    o += `<line x1="440" y1="${tbY}" x2="440" y2="${vH}" stroke="#333" stroke-width="0.5"/>`;
    o += `<line x1="620" y1="${tbY}" x2="620" y2="${vH}" stroke="#333" stroke-width="0.5"/>`;
    o += `<line x1="0" y1="${tbY+25}" x2="200" y2="${tbY+25}" stroke="#333" stroke-width="0.5"/>`;

    o += `<text x="10" y="${tbY+16}" font-size="9" fill="#888" font-family="Arial">PROJEKT</text>`;
    o += `<text x="10" y="${tbY+40}" font-size="12" fill="#111" font-family="Arial" font-weight="bold">${projektNamn} ${b} \u00d7 ${l} m</text>`;

    o += `<text x="210" y="${tbY+16}" font-size="9" fill="#888" font-family="Arial">RITNING</text>`;
    o += `<text x="210" y="${tbY+34}" font-size="11" fill="#111" font-family="Arial">Konstruktionsritning</text>`;

    o += `<text x="450" y="${tbY+16}" font-size="9" fill="#888" font-family="Arial">SKALA</text>`;
    o += `<text x="450" y="${tbY+34}" font-size="11" fill="#111" font-family="Arial">1:${Math.round(100/sc)}</text>`;

    o += `<text x="630" y="${tbY+16}" font-size="9" fill="#888" font-family="Arial">INFORMATION</text>`;
    o += `<text x="630" y="${tbY+34}" font-size="10" fill="#555" font-family="Arial">H\u00f6jd ${Math.round(h*100)} cm | ${rH > 0 ? 'R\u00e4cke ' + Math.round(rH*100) + ' cm' : 'Utan r\u00e4cke'}</text>`;

    const sbM = Math.min(2, Math.round(b/2));
    const sbPx = sbM * sc, sbX = 450, sbY2 = tbY + 42;
    o += `<rect x="${sbX}" y="${sbY2}" width="${sbPx.toFixed(1)}" height="4" fill="none" stroke="#666" stroke-width="0.8"/>`;
    o += `<rect x="${sbX}" y="${sbY2}" width="${(sbPx/2).toFixed(1)}" height="4" fill="#666"/>`;
    o += `<text x="${sbX}" y="${sbY2-2}" font-size="7" fill="#666" font-family="Arial">0</text>`;
    o += `<text x="${(sbX+sbPx).toFixed(1)}" y="${sbY2-2}" text-anchor="end" font-size="7" fill="#666" font-family="Arial">${sbM} m</text>`;
  }

  // Teckenforklaring
  {
    const lx = divX + 20, ly = divY - 15;
    o += `<rect x="${lx}" y="${ly}" width="6" height="6" fill="#111"/>`;
    o += `<text x="${(lx+10)}" y="${ly+5}" font-size="8" fill="#555" font-family="Arial">Stolpe 120\u00d7120</text>`;
    o += `<rect x="${(lx+90)}" y="${ly}" width="10" height="4" fill="none" stroke="#000" stroke-width="1.5"/>`;
    o += `<text x="${(lx+104)}" y="${ly+5}" font-size="8" fill="#555" font-family="Arial">R\u00e4cke</text>`;
    o += `<line x1="${(lx+145)}" y1="${(ly+3)}" x2="${(lx+160)}" y2="${(ly+3)}" stroke="#888" stroke-width="0.8" stroke-dasharray="4,3"/>`;
    o += `<text x="${(lx+164)}" y="${ly+5}" font-size="8" fill="#555" font-family="Arial">B\u00e4rlina</text>`;
  }

  return o;
}

// ============================================================
// RENDERING
// ============================================================

let valtProjekt = null;

const projektGradients = {
  lekstuga: ['#f5e6d3', '#d4a574'],
  altan:    ['#e8d5b7', '#8b7355'],
  pergola:  ['#d4edda', '#87CEEB'],
  _default: ['#e0e0e0', '#c0c0c0']
};

function byggKort() {
  const grid = document.getElementById('kort-grid');
  grid.innerHTML = sokbara.map((p, i) => {
    const colors = p.gradientColors || projektGradients[p.id] || projektGradients._default;
    const grad = `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
    return `
    <div class="kort ${p.kommande ? 'kommande' : ''}" style="--i:${i}" id="kort-${p.id}" ${!p.kommande ? `onclick="visaProjekt('${p.id}')"` : ''}>
      <div class="kort-bild" style="background: ${grad}">
        <span class="kort-bild-ikon">${p.ikon}</span>
      </div>
      <div class="kort-info">
        <h3>${p.namn}</h3>
        <p>${p.beskrivning}</p>
        ${p.kostnadRange ? `<div class="kort-kostnad">${p.kostnadRange}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function beraknaKostnad(p, b, l) {
  if (!p || !p.inkop) return 0;
  return p.inkop.reduce((sum, r) => {
    if (r.kategori || !r.totalt) return sum;
    const v = (b !== undefined && l !== undefined && r.skala)
      ? skalaTotalt(r.totalt, r.skala, b, l)
      : r.totalt;
    return sum + (v || 0);
  }, 0);
}

function uppdateraKostnadDisplay() {
  if (!valtProjekt) return;
  const p = projekt[valtProjekt];
  if (!p) return;
  // Anvand dimensioner for alla projekt som har regler
  var regler = ByggRegler.hamta(valtProjekt);
  var b = regler ? aktuellaB : undefined;
  var l = regler ? aktuellaL : undefined;
  const kr = beraknaKostnad(p, b, l);
  const el = document.getElementById('pv-kostnad');
  if (el) el.textContent = kr.toLocaleString('sv-SE') + ' kr';
}

function uppdateraDimTip(b, l) {
  const yta = b * l;
  const el = document.getElementById('pv-dim-tip');
  if (!el) return;
  var regler = ByggRegler.hamta(valtProjekt);
  if (regler && regler.ytaTips) {
    for (var i = 0; i < regler.ytaTips.length; i++) {
      if (yta < regler.ytaTips[i].max || i === regler.ytaTips.length - 1) {
        el.textContent = regler.ytaTips[i].text;
        return;
      }
    }
  }
  el.textContent = '';
}

function uppdateraRackeInfo(h) {
  const el = document.getElementById('avancerat-racke-info');
  if (!el) return;
  var regler = ByggRegler.hamta(valtProjekt);
  var msg = regler && regler.varningar ? regler.varningar(h) : null;
  if (msg) {
    el.textContent = msg;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}

let avanceratOpen = false;
function toggleAvancerat() {
  avanceratOpen = !avanceratOpen;
  const inst = document.getElementById('avancerade-inst');
  const pil  = document.getElementById('avancerat-pil');
  const tog  = document.getElementById('avancerat-toggle');
  if (inst) inst.classList.toggle('open', avanceratOpen);
  if (pil)  pil.classList.toggle('open', avanceratOpen);
  if (tog)  tog.classList.toggle('aktiv', avanceratOpen);
}

function visaProjekt(id) {
  valtProjekt = id;
  oppetSteg = -1;
  const p = projekt[id];
  const meta = sokbara.find(s => s.id === id);

  // Fade ut kortlistan + dölj hero
  const lista = document.getElementById('projekt-lista');
  const heroLanding = document.getElementById('hero-landing');
  lista.classList.add('fade-ut');
  setTimeout(() => {
    lista.classList.add('dold');
    if (heroLanding) heroLanding.classList.add('dold');
  }, 200);

  // Fyll hero
  document.getElementById('pv-ikon').textContent        = meta?.ikon ?? p.ikon ?? '';
  document.getElementById('pv-namn').textContent        = p.namn;
  document.getElementById('pv-beskrivning').textContent = meta?.beskrivning ?? '';
  document.getElementById('pv-badges').innerHTML = '';

  // Dölj dimensioner tills upload-steget är klart
  document.getElementById('pv-dim-sektion').classList.add('dold');

  // Stang ritvy
  ritvyOpen = false;
  document.getElementById('ritvy-sektion').classList.add('dold');
  var ritvyBtn = document.getElementById('btn-ritvy');
  if (ritvyBtn) ritvyBtn.textContent = '\u{1F4D0} Anpassa och visa detaljritning';

  // Stang avancerat
  avanceratOpen = false;
  const inst = document.getElementById('avancerade-inst');
  const pil  = document.getElementById('avancerat-pil');
  const tog  = document.getElementById('avancerat-toggle');
  if (inst) inst.classList.remove('open');
  if (pil)  pil.classList.remove('open');
  if (tog)  tog.classList.remove('aktiv');

  // Rendera flikinnehall
  renderInstruktioner(p);
  renderInkopslista(p);
  renderVerktyg(p);
  uppdateraKostnadDisplay();

  // Visa projektvyn med smooth transition
  const innehall = document.getElementById('projekt-innehall');
  innehall.classList.remove('dold');
  requestAnimationFrame(() => {
    innehall.classList.add('synlig');
  });
  byttFlik('instruktioner');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Visa inspirationsfas istället för upload direkt
  visaInspirationFas(id);
}

// ============================================================
// INSPIRATION & STEGINDIKATOR
// ============================================================

function visaInspirationFas(id) {
  const p = projekt[id];
  if (!p || !p.inspiration) {
    // Inget inspirationsdata — hoppa direkt till upload
    document.querySelector('.projekt-hero').classList.remove('dold');
    document.querySelector('.flikar').classList.remove('dold');
    visaUploadSteg();
    return;
  }

  const insp = p.inspiration;
  const sek = document.getElementById('pv-inspiration');

  // Fyll hero-gradient
  document.getElementById('insp-hero-bild').style.background =
    'linear-gradient(135deg, ' + insp.gradientColors[0] + ', ' + insp.gradientColors[1] + ')';

  // Namn och budskap
  document.getElementById('insp-namn').textContent = p.namn;
  document.getElementById('insp-budskap').textContent = insp.budskap;

  // Galleri (bilder eller placeholder-gradienter)
  var galleri = document.getElementById('insp-galleri');
  galleri.innerHTML = insp.galleri.map(function(g) {
    if (g.bild) {
      return '<div class="insp-galleri-bild" style="background-image: url(' + g.bild + '); background-size: cover; background-position: center"></div>';
    }
    return '<div class="insp-galleri-bild" style="background: ' + g.gradient + '">' +
      '<span class="insp-galleri-text">' + g.text + '</span></div>';
  }).join('');

  // Features (vad som ingår)
  document.getElementById('insp-features').innerHTML = insp.inkluderar.map(function(f) {
    return '<div class="insp-feature">\u2713 ' + f + '</div>';
  }).join('');

  // Fakta-badges
  document.getElementById('insp-fakta').innerHTML =
    '<span class="hero-badge">\u{1F4B0} ' + insp.kostnadRange + '</span>';

  // Visa inspiration, dölj tekniska sektioner
  sek.classList.remove('dold');
  document.querySelector('.projekt-hero').classList.add('dold');
  document.querySelector('.flikar').classList.add('dold');
  document.getElementById('instruktioner').classList.add('dold');
  document.getElementById('inkopslista').classList.add('dold');
  document.getElementById('verktyg').classList.add('dold');

  // Stegindikator
  document.getElementById('pv-steg-indikator').classList.remove('dold');
  uppdateraStegIndikator(1);
}

function startaProjektFranInspiration() {
  // Dölj inspiration
  document.getElementById('pv-inspiration').classList.add('dold');

  // Visa projekt-hero, flikar och upload
  document.querySelector('.projekt-hero').classList.remove('dold');
  document.querySelector('.flikar').classList.remove('dold');

  // Återställ flikinnehåll
  byttFlik('instruktioner');

  visaUploadSteg();
  uppdateraStegIndikator(2);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function uppdateraStegIndikator(aktivtSteg) {
  document.querySelectorAll('.steg-indikator-item').forEach(function(item) {
    var steg = parseInt(item.dataset.steg);
    item.classList.toggle('aktivt-steg', steg === aktivtSteg);
    item.classList.toggle('klart-steg', steg < aktivtSteg);
  });
  // Uppdatera linjer
  document.querySelectorAll('.steg-indikator-linje').forEach(function(linje, idx) {
    linje.classList.toggle('klar-linje', idx < aktivtSteg - 1);
  });
}

// ============================================================
// BILDUPPLADDNING
// ============================================================

function visaUploadSteg() {
  uploadedImage = null;
  const sek = document.getElementById('pv-upload-sektion');
  const preview = document.getElementById('upload-preview');
  const dropzone = document.getElementById('upload-dropzone');
  const fortsatt = document.getElementById('upload-fortsatt');
  sek.classList.remove('dold');
  preview.classList.add('dold');
  dropzone.classList.remove('dold');
  fortsatt.disabled = true;
  document.getElementById('upload-input').value = '';
  // Ta bort eventuellt felmeddelande
  const fel = sek.querySelector('.upload-fel');
  if (fel) fel.remove();
}

function hoppaOverUpload() {
  document.getElementById('pv-upload-sektion').classList.add('dold');
  visaVyTabs(false);
  bytVy('3d');
  uppdateraStegIndikator(3);
}

function gaVidare() {
  document.getElementById('pv-upload-sektion').classList.add('dold');
  visaVyTabs(true);
  bytVy('ai');
  visaMaskEditor();
  uppdateraStegIndikator(3);
}

function visaVyTabs(medAI) {
  const tabs = document.getElementById('pv-vy-tabs');
  const aiTab = document.getElementById('vy-ai');
  tabs.classList.remove('dold');
  if (medAI) {
    aiTab.disabled = false;
    aiTab.style.display = '';
  } else {
    aiTab.disabled = true;
    aiTab.style.display = 'none';
  }
}

function bytVy(vy) {
  // Uppdatera tab-knappar
  document.querySelectorAll('.vy-tab').forEach(t => t.classList.remove('aktiv-vy'));
  const tab = document.getElementById('vy-' + vy);
  if (tab) tab.classList.add('aktiv-vy');

  // Dölj alla vy-sektioner
  document.getElementById('pv-ai-sektion').classList.add('dold');
  document.getElementById('pv-dim-sektion').classList.add('dold');
  document.getElementById('ritvy-sektion').classList.add('dold');

  if (vy === 'ai') {
    document.getElementById('pv-ai-sektion').classList.remove('dold');
  } else if (vy === '3d') {
    visaDimensioner();
  } else if (vy === 'ritning') {
    visaDimensioner();
    if (!ritvyOpen) {
      ritvyOpen = true;
      document.getElementById('ritvy-sektion').classList.remove('dold');
      byggRitvyKontroller(valtProjekt);
      uppdateraLagerPanel(valtProjekt);
      renderRitvy();
      initRitvyDrag();
    } else {
      document.getElementById('ritvy-sektion').classList.remove('dold');
    }
  }
}

function visaMaskEditor() {
  if (typeof AIVisualisering === 'undefined' || !uploadedImage) return;
  AIVisualisering.init();
  const container = document.getElementById('ai-bild-container');
  const kontroller = document.getElementById('ai-kontroller');

  if (!AIVisualisering.kontrolleraKostnad()) {
    AIVisualisering.renderSektion();
    return;
  }

  kontroller.innerHTML = '<p class="ai-kostnad-info">' + AIVisualisering._config.todayCount + ' av ' + AIVisualisering._config.maxPerDag + ' genereringar idag</p>';

  AIVisualisering.renderMaskEditor(container, uploadedImage, function (maskBase64) {
    startaAIGenerering(maskBase64);
  });
}

function startaAIGenerering(maskBase64) {
  if (typeof AIVisualisering === 'undefined') return;
  AIVisualisering.init();
  const container = document.getElementById('ai-bild-container');
  const kontroller = document.getElementById('ai-kontroller');

  if (maskBase64) {
    currentMask = maskBase64;
  }

  if (!currentMask) {
    visaMaskEditor();
    return;
  }

  if (!AIVisualisering.kontrolleraKostnad()) {
    AIVisualisering.renderSektion();
    return;
  }

  AIVisualisering.renderLaddning(container);
  kontroller.innerHTML = '<p class="ai-kostnad-info">' + AIVisualisering._config.todayCount + ' av ' + AIVisualisering._config.maxPerDag + ' genereringar idag</p>';

  var dim = { b: aktuellaB, l: aktuellaL, h: aktuellaH };

  AIVisualisering.generera(valtProjekt, dim, uploadedImage, currentMask).then(function(result) {
    if (result.ok) {
      AIVisualisering.renderBild(container, result.url);
    } else {
      AIVisualisering.renderFel(container, result.error);
    }
    kontroller.innerHTML = '<p class="ai-kostnad-info">' + AIVisualisering._config.todayCount + ' av ' + AIVisualisering._config.maxPerDag + ' genereringar idag</p>';
  });
}

function visaDimensioner() {
  const id = valtProjekt;
  const p = projekt[id];
  var regler = ByggRegler.hamta(id);
  const dimSek = document.getElementById('pv-dim-sektion');

  if (regler) {
    var std = regler.standard;
    aktuellaB = std.b;
    aktuellaL = std.l;
    aktuellaH = std.h;

    byggSliders(id);

    aktuelltDesign = ByggGenerator.standardDesign(id, { b: aktuellaB, l: aktuellaL, h: aktuellaH });
    var dr = ByggRegler.tillampa(aktuelltDesign);
    aktuelltBerakning = dr.berakning;

    dimSek.classList.remove('dold');
    uppdateraPreview();
    uppdateraDimTip(aktuellaB, aktuellaL);
    uppdateraRackeInfo(aktuellaH);
  } else {
    aktuelltDesign = null;
    aktuelltBerakning = null;
    dimSek.classList.add('dold');
  }

  renderInkopslista(p, regler ? aktuellaB : undefined, regler ? aktuellaL : undefined);
  uppdateraKostnadDisplay();
}

function bytUploadBild() {
  const preview = document.getElementById('upload-preview');
  const dropzone = document.getElementById('upload-dropzone');
  const fortsatt = document.getElementById('upload-fortsatt');
  preview.classList.add('dold');
  dropzone.classList.remove('dold');
  fortsatt.disabled = true;
  uploadedImage = null;
  document.getElementById('upload-input').value = '';
}

function hanteraUpload(file) {
  const sek = document.getElementById('pv-upload-sektion');
  // Ta bort tidigare felmeddelande
  const gammalFel = sek.querySelector('.upload-fel');
  if (gammalFel) gammalFel.remove();

  // Validera typ
  if (!file.type.startsWith('image/')) {
    const fel = document.createElement('p');
    fel.className = 'upload-fel';
    fel.textContent = 'Filen måste vara en bild (JPG, PNG).';
    sek.querySelector('.upload-yta').after(fel);
    return;
  }

  // Validera storlek (10 MB)
  if (file.size > 10 * 1024 * 1024) {
    const fel = document.createElement('p');
    fel.className = 'upload-fel';
    fel.textContent = 'Bilden får vara max 10 MB.';
    sek.querySelector('.upload-yta').after(fel);
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    // Normalisera EXIF-orientering genom att rita om via canvas
    var tmpImg = new Image();
    tmpImg.onload = function() {
      var c = document.createElement('canvas');
      c.width = tmpImg.naturalWidth;
      c.height = tmpImg.naturalHeight;
      c.getContext('2d').drawImage(tmpImg, 0, 0);
      uploadedImage = c.toDataURL('image/jpeg', 0.92);
      document.getElementById('upload-bild').src = uploadedImage;
      document.getElementById('upload-dropzone').classList.add('dold');
      document.getElementById('upload-preview').classList.remove('dold');
      document.getElementById('upload-fortsatt').disabled = false;
    };
    tmpImg.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function gaaTillbaka() {
  const innehall = document.getElementById('projekt-innehall');
  innehall.classList.remove('synlig');

  setTimeout(() => {
    innehall.classList.add('dold');
    document.getElementById('pv-upload-sektion').classList.add('dold');
    document.getElementById('pv-vy-tabs').classList.add('dold');
    document.getElementById('pv-ai-sektion').classList.add('dold');
    uploadedImage = null;
    currentMask = null;
    ritvyOpen = false;
    document.getElementById('ritvy-sektion').classList.add('dold');
    // Nollställ AI-bild-container
    var aiCont = document.getElementById('ai-bild-container');
    if (aiCont) aiCont.innerHTML = '<div class="ai-placeholder"><span class="ai-placeholder-ikon">\u2728</span><p>Din AI-visualisering visas här</p></div>';

    // Dölj inspiration och stegindikator
    document.getElementById('pv-inspiration').classList.add('dold');
    document.getElementById('pv-steg-indikator').classList.add('dold');
    // Återställ hero och flikar till synliga (för nästa projektbesök)
    document.querySelector('.projekt-hero').classList.remove('dold');
    document.querySelector('.flikar').classList.remove('dold');
    document.getElementById('instruktioner').classList.remove('dold');

    // Visa hero + kortlista
    const heroLanding = document.getElementById('hero-landing');
    if (heroLanding) heroLanding.classList.remove('dold');
    const lista = document.getElementById('projekt-lista');
    lista.classList.remove('dold');
    requestAnimationFrame(() => lista.classList.remove('fade-ut'));

    // Kort redan synliga (ingen re-animation)
    document.querySelectorAll('.kort').forEach(k => k.classList.add('synlig'));

    // Rensa sökfilter
    rensaSok();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 400);
}

// ============================================================
// INSTRUKTIONER
// ============================================================

let oppetSteg = -1;

function hamtaProgress(projektId) {
  try {
    return JSON.parse(localStorage.getItem('bygg_progress_' + projektId)) || {};
  } catch { return {}; }
}

function sparaProgress(projektId, stegIndex, klar) {
  const prog = hamtaProgress(projektId);
  prog[stegIndex] = klar;
  localStorage.setItem('bygg_progress_' + projektId, JSON.stringify(prog));
}

function toggleStegKlar(projektId, stegIndex, e) {
  e.stopPropagation();
  const prog = hamtaProgress(projektId);
  const nyStatus = !prog[stegIndex];
  sparaProgress(projektId, stegIndex, nyStatus);
  renderInstruktioner(projekt[projektId]);
}

function visaStegDetalj(index) {
  oppetSteg = oppetSteg === index ? -1 : index;
  renderInstruktioner(projekt[valtProjekt]);
}

function stegNavigera(riktning, antalSteg) {
  const nytt = oppetSteg + riktning;
  if (nytt >= 0 && nytt < antalSteg) {
    oppetSteg = nytt;
    renderInstruktioner(projekt[valtProjekt]);
    document.getElementById('instruktioner').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function renderInstruktioner(p) {
  const el = document.getElementById('instruktioner');
  const prog = hamtaProgress(valtProjekt);
  const antalKlara = p.steg.filter((_, i) => prog[i]).length;
  const procent = Math.round((antalKlara / p.steg.length) * 100);

  el.innerHTML = `
    <h2 class="projekt-rubrik">Bygginstruktioner \u2014 ${p.namn}</h2>
    <div class="info-rad"></div>

    <div class="steg-progress">
      <div class="steg-progress-bar">
        <div class="steg-progress-fill" style="width: ${procent}%"></div>
      </div>
      <span class="steg-progress-text">${antalKlara} av ${p.steg.length} moment klara</span>
    </div>

    ${oppetSteg === -1 ? renderOverblick(p, prog) : renderDetalj(p, prog)}
  `;
}

function renderOverblick(p, prog) {
  return `
    <div class="steg-overblick">
      ${p.steg.map((steg, i) => {
        const klar = !!prog[i];
        return `
          <div class="steg-rad ${klar ? 'steg-klar' : ''}" onclick="visaStegDetalj(${i})">
            <button class="steg-check ${klar ? 'checked' : ''}"
                    onclick="toggleStegKlar('${valtProjekt}', ${i}, event)"
                    title="${klar ? 'Markera som ej klar' : 'Markera som klar'}">
              ${klar ? '&#10003;' : ''}
            </button>
            <div class="steg-rad-nummer">${i + 1}</div>
            <div class="steg-rad-info">
              <h3>${steg.rubrik}</h3>
            </div>
            <span class="steg-rad-pil">&#8250;</span>
          </div>`;
      }).join('')}
    </div>`;
}

function losSubsteg(steg) {
  // Generiskt: skicka dimensioner for alla projekt som har regler
  var regler = ByggRegler.hamta(valtProjekt);
  var b = regler ? aktuellaB : undefined;
  var l = regler ? aktuellaL : undefined;
  var h = regler ? aktuellaH : undefined;
  var substeg = typeof steg.substeg === 'function' ? steg.substeg(b, l, h) : steg.substeg;
  if (Array.isArray(substeg)) {
    return `<ol class="steg-substeg">${substeg.map(s => `<li>${s}</li>`).join('')}</ol>`;
  }
  return `<p>${steg.text || ''}</p>`;
}

function renderDetalj(p, prog) {
  const i = oppetSteg;
  const steg = p.steg[i];
  const klar = !!prog[i];
  const harSvg = p.svgar && p.svgar[i];

  return `
    <div class="steg-detalj">
      <button class="steg-detalj-tillbaka" onclick="oppetSteg=-1; renderInstruktioner(projekt[valtProjekt]);">
        &#8592; Alla moment
      </button>

      <div class="steg-detalj-header">
        <div class="steg-nummer">${i + 1}</div>
        <h3>${steg.rubrik}</h3>
        <button class="steg-check stor ${klar ? 'checked' : ''}"
                onclick="toggleStegKlar('${valtProjekt}', ${i}, event)"
                title="${klar ? 'Markera som ej klar' : 'Markera som klar'}">
          ${klar ? '&#10003;' : ''}
        </button>
      </div>

      ${harSvg ? `<div class="steg-detalj-skiss">${p.svgar[i]}</div>` : ''}

      <div class="steg-detalj-text">
        ${losSubsteg(steg)}
      </div>

      ${steg.tips ? `<div class="steg-detalj-tips">${steg.tips}</div>` : ''}

      <div class="steg-detalj-nav">
        <button class="steg-nav-knapp" ${i === 0 ? 'disabled' : ''} onclick="stegNavigera(-1, ${p.steg.length})">
          &#8592; F\u00f6reg\u00e5ende
        </button>
        <span class="steg-nav-pos">Steg ${i + 1} av ${p.steg.length}</span>
        <button class="steg-nav-knapp" ${i === p.steg.length - 1 ? 'disabled' : ''} onclick="stegNavigera(1, ${p.steg.length})">
          N\u00e4sta &#8594;
        </button>
      </div>
    </div>`;
}

function renderInkopslista(p, b, l) {
  const el = document.getElementById('inkopslista');
  const harDim = b !== undefined && l !== undefined;

  let totalsumma = 0;

  if (!p.inkop) { el.innerHTML = '<p style="color:#888;padding:20px;">Inköpslista saknas för detta projekt.</p>'; return; }
  const rader = p.inkop.map(r => {
    if (r.kategori) {
      return `<tr><td colspan="6" class="kategori">${r.kategori}</td></tr>`;
    }
    const visAntal  = harDim && r.skala ? skalaAntal(r.antal, r.skala, b, l) : r.antal;
    const visTotalt = harDim && r.skala ? skalaTotalt(r.totalt, r.skala, b, l) : r.totalt;
    if (visTotalt) totalsumma += visTotalt;
    const andrad = harDim && r.skala && r.skala !== 'fast' && visAntal !== r.antal;
    return `<tr>
      <td>${r.namn}</td>
      <td>${r.dim}</td>
      <td class="${andrad ? 'antal-andrad' : ''}">${visAntal}</td>
      <td>${r.enhet}</td>
      <td>${r.not}</td>
      <td class="pris-cell">${visTotalt ? visTotalt.toLocaleString('sv-SE') + ' kr' : '\u2014'}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <h2>Ink\u00f6pslista \u2014 ${p.namn}${harDim ? ` <span class="dim-etikett">${b} \u00d7 ${l} m</span>` : ''}</h2>
    <p class="info-text">Ungef\u00e4rliga priser. K\u00f6p alltid 10% extra f\u00f6r spill.</p>
    <table class="lista-tabell">
      <thead>
        <tr><th>Material</th><th>Dimension</th><th>Antal</th><th>Enhet</th><th>Notering</th><th>Ca pris</th></tr>
      </thead>
      <tbody>${rader}</tbody>
    </table>
    <div class="totalsumma">
      Uppskattat totalpris: <strong>${totalsumma.toLocaleString('sv-SE')} kr</strong>
      <span class="totalsumma-not">(exkl. verktyg)</span>
    </div>
    <button class="skriv-ut-knapp" onclick="window.print()">Skriv ut / Spara som PDF</button>
  `;
}

function renderVerktyg(p) {
  const el = document.getElementById('verktyg');
  el.innerHTML = `
    <h2>Verktygslista \u2014 ${p.namn}</h2>
    <h3 class="verktyg-rubrik">M\u00e5ste ha</h3>
    <ul class="verktyg-lista">
      ${p.verktyg.maste.map(v => `<li>${v}</li>`).join('')}
    </ul>
    <h3 class="verktyg-rubrik">Bra att ha</h3>
    <ul class="verktyg-lista">
      ${p.verktyg.bra.map(v => `<li>${v}</li>`).join('')}
    </ul>
  `;
}

function byttFlik(flikNamn) {
  document.querySelectorAll('.flik-innehall').forEach(el => el.classList.add('dold'));
  document.getElementById(flikNamn).classList.remove('dold');
  document.querySelectorAll('.flik').forEach(knapp => {
    knapp.classList.toggle('aktiv-flik', knapp.getAttribute('onclick').includes(flikNamn));
  });
  // Uppdatera stegindikator: instruktioner = bygg-fasen (bara om vi passerat inspirationen)
  if (flikNamn === 'instruktioner' && valtProjekt && document.getElementById('pv-inspiration').classList.contains('dold')) {
    uppdateraStegIndikator(4);
  }
}

// ============================================================
// SOK
// ============================================================

function sokProjekt(q) {
  const term = q.toLowerCase().trim();
  const kort = document.querySelectorAll('#kort-grid .kort');
  var ingenTraff = true;

  kort.forEach(function(el) {
    const id = (el.id || '').replace('kort-', '');
    const p = sokbara.find(s => s.id === id) || sokbara.find(s => s.namn === el.querySelector('h3')?.textContent);
    if (!p) { el.style.display = ''; return; }

    if (term === '') {
      el.style.display = '';
      ingenTraff = false;
      return;
    }

    const namnLower = p.namn.toLowerCase();
    const match = namnLower.includes(term) ||
      (p.nyckelord && p.nyckelord.some(k => k.includes(term)));

    if (match) {
      el.style.display = '';
      ingenTraff = false;
    } else {
      el.style.display = 'none';
    }
  });

  // Visa/dölj "inga resultat"-meddelande
  var tomMsg = document.getElementById('sok-inga-resultat');
  if (tomMsg) {
    tomMsg.style.display = (term !== '' && ingenTraff) ? '' : 'none';
    if (term !== '' && ingenTraff) {
      tomMsg.textContent = 'Inga resultat f\u00f6r "' + q.trim() + '" \u2014 fler konstruktioner tillkommer.';
    }
  }
}

function sokTangent(e) {
  if (e.key === 'Escape') {
    e.target.value = '';
    sokProjekt('');
    e.target.blur();
  } else if (e.key === 'Enter') {
    // Hitta första synliga icke-kommande kort och öppna det
    var kort = document.querySelectorAll('#kort-grid .kort:not(.kommande)');
    for (var i = 0; i < kort.length; i++) {
      if (kort[i].style.display !== 'none') {
        var id = (kort[i].id || '').replace('kort-', '');
        if (id) {
          e.target.value = '';
          sokProjekt('');
          visaProjekt(id);
        }
        break;
      }
    }
  }
}

function rensaSok() {
  var kortInput = document.getElementById('sok-input-kort');
  if (kortInput) kortInput.value = '';
  sokProjekt('');
}

// Upload event listeners
document.getElementById('upload-input').addEventListener('change', function(e) {
  if (e.target.files && e.target.files[0]) {
    hanteraUpload(e.target.files[0]);
  }
});

(function() {
  const dz = document.getElementById('upload-dropzone');
  dz.addEventListener('dragover', function(e) {
    e.preventDefault();
    dz.classList.add('dragover');
  });
  dz.addEventListener('dragleave', function(e) {
    e.preventDefault();
    dz.classList.remove('dragover');
  });
  dz.addEventListener('drop', function(e) {
    e.preventDefault();
    dz.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      hanteraUpload(e.dataTransfer.files[0]);
    }
  });
  // Klick på dropzone öppnar filväljaren
  dz.addEventListener('click', function(e) {
    if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') {
      document.getElementById('upload-input').click();
    }
  });
})();

// Starta appen
byggKort();

// Scroll-triggered kort-animationer
function observeKort() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('synlig');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.kort').forEach(kort => observer.observe(kort));
}
observeKort();

// Header scroll-shadow
window.addEventListener('scroll', () => {
  const header = document.querySelector('header');
  header.classList.toggle('scrolled', window.scrollY > 100);
});
