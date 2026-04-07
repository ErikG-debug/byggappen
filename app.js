// ============================================================
// DIMENSIONER (generisk)
// ============================================================

let aktuellaB = 4, aktuellaL = 3;
let uploadedImage = null;
let currentMask = null;
let mattFranMask = false;        // Sant tills användaren rör en slider efter mask-uppskattning
let senasteAIGenMatt = null;     // {b,l} vid senaste lyckade AI-bildgenerering — används för att visa "uppdatera"-knapp

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
  // Bevarar bara sammanfattningen som projektöversikt — sliders flyttade till designläget.
  var p = projekt[projektTyp];
  var container = document.getElementById('pv-dim-layout');
  if (!container) return;
  var html = '';
  if (p && p.sammanfattning) {
    html += '<p class="pv-sammanfattning">' + p.sammanfattning + '</p>';
  }
  container.innerHTML = html;
}


// ============================================================
// DYNAMISK LAGERPANEL
// ============================================================

function uppdateraLagerPanel(projektTyp) {
  var panel = document.getElementById('lager-panel');
  if (!panel) return;

  // Använd lagernamn från CAD-servern om tillgängliga
  var lagerNamn = cadLagerData ? cadLagerData.lager : [];

  // Fallback till regler.js-definitioner om CAD-server ej svarat
  if (lagerNamn.length === 0) {
    var regler = ByggRegler.hamta(projektTyp);
    var defs = (regler && regler.lager) || [];
    for (var i = 0; i < defs.length; i++) {
      lagerNamn.push(defs[i].etikett);
    }
  }

  // Se till att alla lager har ett synlighetsvärde
  for (var i = 0; i < lagerNamn.length; i++) {
    if (lager[lagerNamn[i]] === undefined) lager[lagerNamn[i]] = true;
  }

  var html = '<span class="lager-rubrik">Visa:</span>';
  for (var j = 0; j < lagerNamn.length; j++) {
    var namn = lagerNamn[j];
    var av = lager[namn] === false ? ' lager-av' : '';
    html += '<button class="lager-knapp' + av + '" id="lager-' + namn + '" onclick="toggleLager(\'' + namn + '\')">' + namn + '</button>';
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
  cad3dLaddad = ''; // Tvinga ny CAD-laddning vid dimensionsändring
  cadLagerData = null;
  uppdateraPreview();
  renderRitvy();
  uppdateraDimTip(aktuellaB, aktuellaL);
  uppdateraKostnadDisplay();
  schemalaggMiniSkiss();

  // Användaren har rört en slider — mask-uppskattningen är inte längre "färsk"
  if (mattFranMask) {
    mattFranMask = false;
    var hint = document.getElementById('mask-matt-hint');
    if (hint) hint.remove();
  }
  uppdateraAiUppdateraKnapp();

  var p = projekt[valtProjekt];
  if (p) {
    renderInkopslista(p, aktuellaB, aktuellaL);
    if (oppetSteg !== -1) renderInstruktioner(p);
    // Uppdatera CAD-data för instruktionsbilder vid dimensionsändring
    if (p.lagerPerSteg && window.CadViewer) {
      forladdaCad3D(valtProjekt);
    }
  }
}

// ============================================================
// RITVY
// ============================================================

let ritvyOpen  = false;
let ritvyStyle = 'cad-iso';
let aktuellaH  = 0.6;
// Äldre vy-state (behålls för SVG-preview)
let rotAz      = Math.PI / 5;
let rotEl      = Math.PI / 4;
let zoomLevel  = 1.0;
let panX       = 0;
let panY       = 0;

// Synlighetslager — fylls dynamiskt av CAD-serverns lagernamn
var lager = {};

function toggleLager(namn) {
  lager[namn] = !lager[namn];
  var btn = document.getElementById('lager-' + namn);
  if (btn) btn.classList.toggle('lager-av', !lager[namn]);

  var synlig = lager[namn] !== false;

  // Uppdatera Three.js mesh-visibility (3D-vy)
  if (window.CadViewer) {
    CadViewer.setLayerVisible(namn, synlig);
  }

  // Uppdatera SVG DOM visibility (2D-vyer)
  var container = document.getElementById('cad-svg-container');
  if (container) {
    // CSS-klass matchar: lager-Stolpar, lager-Barlinor, etc.
    var cssNamn = namn.replace(/ä/g, 'a').replace(/ö/g, 'o');
    var groups = container.querySelectorAll('g.lager-' + cssNamn);
    groups.forEach(function(g) {
      g.style.display = synlig ? '' : 'none';
    });
  }
}

function oppnaRitvy(forceOpen) {
  ritvyOpen = forceOpen === true ? true : !ritvyOpen;
  document.getElementById('ritvy-sektion').classList.toggle('dold', !ritvyOpen);
  var btn = document.getElementById('btn-ritvy');
  if (btn) btn.textContent = ritvyOpen ? '\u{1F4D0} St\u00e4ng detaljritning' : '\u{1F4D0} Anpassa och visa detaljritning';
  if (ritvyOpen) {
    byggRitvyKontroller(valtProjekt);
    uppdateraLagerPanel(valtProjekt);
    renderRitvy();
  }
}

function byggRitvyKontroller(projektTyp) {
  // Sliders har flyttats till designläget — ritvy-kontroller är tom nu.
  var container = document.getElementById('ritvy-kontroller');
  if (container) container.innerHTML = '';
}

// ============================================================
// DESIGNLÄGE — alla sliders samlade här, med koherenta mini-skisser
// ============================================================

// Mappa sliderns nyckel → fokus-namn för /cad/{projekt}/skiss
function _fokusForSlider(nyckel) {
  if (nyckel === 'b') return 'bredd';
  if (nyckel === 'l') return 'langd';
  if (nyckel === 'h') return 'hojd';
  if (nyckel === 'racke' || nyckel === 'rackesh') return 'racke';
  return null;
}

function byggDesignKontroller(projektTyp) {
  var container = document.getElementById('design-kontroller');
  if (!container) return;
  var regler = ByggRegler.hamta(projektTyp);
  if (!regler || !regler.ui) { container.innerHTML = ''; return; }

  var ui = regler.ui;
  var dim = regler.dim;
  var std = regler.standard;

  function sliderHtml(s, isHojd) {
    var d = dim[s.nyckel];
    var val = s.nyckel === 'b' ? aktuellaB : s.nyckel === 'l' ? aktuellaL : s.nyckel === 'h' ? aktuellaH : std[s.nyckel];
    var handler = isHojd ? 'uppdateraHojd()' : 'uppdateraDimensioner()';
    var fokus = _fokusForSlider(s.nyckel);
    var skiss = fokus
      ? '<div class="mini-skiss" data-fokus="' + fokus + '"><div class="mini-skiss-laddar">…</div></div>'
      : '<div class="mini-skiss mini-skiss-tom"></div>';

    var h = '<div class="slider-med-skiss">';
    h += '  <div class="pv-slider-block">';
    h += '    <div class="pv-slider-header">';
    h += '      <span class="pv-slider-label">' + s.etikett + '</span>';
    h += '      <span class="pv-slider-val" id="slider-val-' + s.nyckel + '">' + s.format(val) + '</span>';
    h += '    </div>';
    h += '    <input type="range" id="slider-' + s.nyckel + '" min="' + d.min + '" max="' + d.max + '" step="' + d.steg + '" value="' + val + '" oninput="' + handler + '">';
    h += '    <div class="pv-slider-minmax"><span>' + s.format(d.min) + '</span><span>' + s.format(d.max) + '</span></div>';
    h += '  </div>';
    h += '  ' + skiss;
    h += '</div>';
    return h;
  }

  var html = '';

  // Grupp 1: Storlek (bredd + längd)
  var storlekSliders = (ui.sliders || []).filter(function(s) { return s.nyckel === 'b' || s.nyckel === 'l'; });
  if (storlekSliders.length) {
    html += '<div class="design-grupp"><h4>Storlek</h4>';
    if (mattFranMask) {
      html += '<div id="mask-matt-hint" class="mask-matt-hint">📐 Uppskattat från din markering på bilden</div>';
    }
    storlekSliders.forEach(function(s) { html += sliderHtml(s, false); });
    if (ui.visaYta) {
      html += '<div class="pv-dim-summary"><div class="pv-yta-rad">';
      html += '<span>' + (ui.ytaEtikett || 'Yta') + '</span>';
      html += '<strong id="yta-val">' + (aktuellaB * aktuellaL).toFixed(1) + ' m\u00b2</strong>';
      html += '</div><div class="pv-dim-tip" id="pv-dim-tip"></div></div>';
    }
    html += '</div>';
  }

  // Grupp 2: Höjd (vanliga + avancerade slidersar förutom storlek)
  var hojdSliders = (ui.sliders || []).filter(function(s) { return s.nyckel === 'h'; })
    .concat((ui.avancerat || []).filter(function(s) { return s.nyckel === 'h'; }));
  if (hojdSliders.length) {
    html += '<div class="design-grupp"><h4>Höjd</h4>';
    hojdSliders.forEach(function(s) { html += sliderHtml(s, true); });
    html += '<div class="avancerat-info" id="avancerat-racke-info"></div>';
    html += '</div>';
  }

  // Grupp 3: Detaljer (övriga avancerade sliders)
  var detaljSliders = (ui.avancerat || []).filter(function(s) { return s.nyckel !== 'h'; });
  if (detaljSliders.length) {
    html += '<div class="design-grupp"><h4>Detaljer</h4>';
    detaljSliders.forEach(function(s) { html += sliderHtml(s, false); });
    html += '</div>';
  }

  // Slot för "uppdatera AI-bild"-knappen — fylls dynamiskt av uppdateraAiUppdateraKnapp()
  html += '<div id="ai-uppdatera-slot" class="ai-uppdatera-slot"></div>';

  container.innerHTML = html;
  uppdateraDimTip(aktuellaB, aktuellaL);
  uppdateraRackeInfo(aktuellaH);
  uppdateraAiUppdateraKnapp();
}

// ── Designläge: state och kontroll ──
var designLageOppet = false;
var sparadeDimensioner = null;
var miniSkissTimer = null;

function oppnaDesignLage() {
  if (!valtProjekt) return;
  sparadeDimensioner = { b: aktuellaB, l: aktuellaL, h: aktuellaH };
  designLageOppet = true;
  document.getElementById('design-lage').classList.remove('dold');
  var btn = document.getElementById('btn-anpassa-design');
  if (btn) btn.classList.add('dold');

  // Flytta 3D-containern in i designläget så reglagen sitter bredvid modellen
  var slot = document.getElementById('design-3d-slot');
  var cad3d = document.getElementById('cad-3d-container');
  if (slot && cad3d && cad3d.parentElement !== slot) {
    slot.appendChild(cad3d);
    cad3d.classList.remove('dold');
    cad3d.style.display = 'block';
  }
  // Dölj hela ritvy-sektionen medan designläget är aktivt
  document.getElementById('ritvy-sektion').classList.add('dold');

  byggDesignKontroller(valtProjekt);
  uppdateraAllaMiniSkisser();

  // Säkerställ att Three.js renderar i den nya storleken
  setTimeout(function() {
    if (window.CadViewer && CadViewer.resize) CadViewer.resize();
    laddaCad3D();
  }, 50);
}

function sparaDesign() {
  designLageOppet = false;
  document.getElementById('design-lage').classList.add('dold');
  var btn = document.getElementById('btn-anpassa-design');
  if (btn) btn.classList.remove('dold');

  // Flytta tillbaka 3D-containern till ritvy-canvas
  var canvas = document.querySelector('.ritvy-canvas');
  var cad3d = document.getElementById('cad-3d-container');
  if (canvas && cad3d && cad3d.parentElement !== canvas) {
    canvas.appendChild(cad3d);
  }
  // Återställ ritvy-sektionen om den var öppen
  if (ritvyOpen) {
    document.getElementById('ritvy-sektion').classList.remove('dold');
    setTimeout(function() {
      if (window.CadViewer && CadViewer.resize) CadViewer.resize();
      renderRitvy();
    }, 50);
  }
  uppdateraKostnadDisplay();
}

function avbrytDesign() {
  if (sparadeDimensioner) {
    aktuellaB = sparadeDimensioner.b;
    aktuellaL = sparadeDimensioner.l;
    aktuellaH = sparadeDimensioner.h;
    cad3dLaddad = '';
    cadLagerData = null;
    if (aktuelltDesign) {
      DesignModell.andraSektion(aktuelltDesign, aktuelltDesign.sektioner[0].id,
        { b: aktuellaB, l: aktuellaL, egenskaper: { h: aktuellaH } });
    }
    renderRitvy();
    uppdateraPreview();
  }
  sparaDesign();
}

function uppdateraMiniSkiss(fokus) {
  if (!valtProjekt) return;
  var box = document.querySelector('.mini-skiss[data-fokus="' + fokus + '"]');
  if (!box) return;
  var url = cadServerUrl + '/cad/' + valtProjekt + '/skiss?fokus=' + fokus +
            '&bredd=' + aktuellaB + '&langd=' + aktuellaL + '&hojd=' + aktuellaH;
  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data && data.svg) box.innerHTML = data.svg;
    })
    .catch(function(err) { console.error('Mini-skiss fel:', err); });
}

function uppdateraAllaMiniSkisser() {
  if (!designLageOppet) return;
  var fokusar = ['bredd', 'langd', 'hojd'];
  fokusar.forEach(function(f) {
    if (document.querySelector('.mini-skiss[data-fokus="' + f + '"]')) {
      uppdateraMiniSkiss(f);
    }
  });
}

function schemalaggMiniSkiss() {
  if (!designLageOppet) return;
  if (miniSkissTimer) clearTimeout(miniSkissTimer);
  miniSkissTimer = setTimeout(uppdateraAllaMiniSkisser, 120);
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
  cad3dLaddad = '';
  renderRitvy();
  uppdateraRackeInfo(aktuellaH);
  uppdateraKostnadDisplay();
  schemalaggMiniSkiss();
}

function bytRitvyStyle(stil) {
  ritvyStyle = stil;
  document.querySelectorAll('.stil-knapp').forEach(k => k.classList.remove('aktiv-stil'));
  var btn = document.getElementById('stil-' + stil);
  if (btn) btn.classList.add('aktiv-stil');
  var lp = document.getElementById('lager-panel');
  // Visa lagerpanelen i alla CAD-vyer
  if (lp) lp.style.display = 'flex';
  renderRitvy();
}

function aterStallVy() {
  rotAz = Math.PI / 5; rotEl = Math.PI / 4; zoomLevel = 1.0; panX = 0; panY = 0;
  renderRitvy();
}

function renderRitvy() {
  if (!ritvyOpen) return;
  var cadSvgContainer = document.getElementById('cad-svg-container');
  var cad3dContainer = document.getElementById('cad-3d-container');

  // Dölj CAD-containrar
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

}

// 3D-modell via Three.js — per-lager STL
var cad3dLaddad = '';
var cadLagerData = null; // Sparar server-response för lagerpanelen

function laddaCad3D() {
  if (!valtProjekt || !window.CadViewer) return;

  var key = valtProjekt + '_' + aktuellaB + '_' + aktuellaL + '_' + aktuellaH;

  CadViewer.init('cad-3d-container');

  if (cad3dLaddad !== key) {
    cad3dLaddad = key;

    var url = cadServerUrl + '/cad/' + valtProjekt + '/3d?bredd=' + aktuellaB + '&langd=' + aktuellaL + '&hojd=' + aktuellaH;

    fetch(url)
      .then(function(res) { return res.json(); })
      .then(function(data) {
        cadLagerData = data;
        CadViewer.loadLayers(data);
        uppdateraLagerPanel(valtProjekt);
        // Applicera aktuell visibility-state
        for (var namn in lager) {
          CadViewer.setLayerVisible(namn, lager[namn] !== false);
        }
      })
      .catch(function(err) {
        console.error('CAD 3D fetch error:', err);
      });
  }
}

// Offscreen-container för CAD-rendering (alltid synlig med storlek, men utanför viewport)
var cadOffscreenId = 'cad-offscreen-renderer';

function getCadOffscreen() {
  var el = document.getElementById(cadOffscreenId);
  if (!el) {
    el = document.createElement('div');
    el.id = cadOffscreenId;
    el.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:600px;pointer-events:none;';
    document.body.appendChild(el);
  }
  return el;
}

// Förladda CAD 3D-data i bakgrunden (för instruktionsbilder)
function forladdaCad3D(projektId) {
  if (!window.CadViewer) return;
  var key = projektId + '_' + aktuellaB + '_' + aktuellaL + '_' + aktuellaH;
  if (cad3dLaddad === key) return; // Redan laddad

  var url = cadServerUrl + '/cad/' + projektId + '/3d?bredd=' + aktuellaB + '&langd=' + aktuellaL + '&hojd=' + aktuellaH;

  fetch(url)
    .then(function(res) { return res.json(); })
    .then(function(data) {
      cadLagerData = data;
      getCadOffscreen();
      CadViewer.init(cadOffscreenId);
      CadViewer.loadLayers(data);
      cad3dLaddad = key;
      // Om instruktionsvyn är öppen, re-rendera med CAD-bilder
      if (oppetSteg !== -1 && valtProjekt) {
        renderInstruktioner(projekt[valtProjekt]);
      }
    })
    .catch(function(err) {
      console.warn('Förladdning av CAD 3D misslyckades:', err);
    });
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
        var svg = container.querySelector('svg');
        if (svg) {
          svg.style.width = '100%';
          svg.style.height = 'auto';
          svg.style.maxHeight = '800px';
        }
        // Initiera lagerpanelen från SVG-responsen
        if (data.lager && !cadLagerData) {
          cadLagerData = { lager: data.lager };
          uppdateraLagerPanel(valtProjekt);
        }
        // Applicera aktiv visibility-state på SVG
        for (var namn in lager) {
          if (lager[namn] === false) {
            var cssNamn = namn.replace(/ä/g, 'a').replace(/ö/g, 'o');
            var groups = container.querySelectorAll('g.lager-' + cssNamn);
            groups.forEach(function(g) { g.style.display = 'none'; });
          }
        }
      } else {
        container.innerHTML = '<p style="color:red">Kunde inte ladda ritning</p>';
      }
    })
    .catch(function(err) {
      container.innerHTML = '<p style="color:red">CAD-server ej tillgänglig: ' + err.message + '</p>';
    });
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


// Exporterar CAD-modellen som en canny-linjeritning (svart bg, vita kanter) för ControlNet.
// Återanvänder rita3DPreview-pipelinen men utan himmel/gräs/vinjett — bara modellens linjer.
function exporteraCadCanny(vW, vH) {
  if (typeof Render3D === 'undefined' || typeof byggModell === 'undefined') return Promise.resolve(null);
  if (!aktuelltDesign || !aktuelltBerakning || !valtProjekt) return Promise.resolve(null);
  var p = projekt[valtProjekt];
  if (!p || !p.bygg3d) return Promise.resolve(null);

  vW = vW || 1024;
  vH = vH || 768;

  // Kontextmått från första sektionen — samma som rita3DPreview
  var sek0 = aktuelltDesign.sektioner[0];
  var ctxB = sek0.b, ctxL = sek0.l;
  var ctxH = aktuellaH || sek0.egenskaper.h || 0.6;
  var ber0 = aktuelltBerakning.perSektion ? aktuelltBerakning.perSektion[sek0.id] : null;
  if (ber0 && ber0.nockHojd) ctxH = ber0.nockHojd;

  // Fast iso-vinkel (samma som preview-defaultet)
  var ax = Math.PI / 4.5, el = Math.PI / 5.5;
  var ctx = Render3D.skapaKontext(ctxB, ctxL, ctxH, ax, el, 1.0, vW, vH, 0, 0);
  var palette = PALETTER.realistisk;
  var delar = ByggGenerator.delar(aktuelltDesign, aktuelltBerakning);
  var modellSvg = byggModell(delar, ctx, palette, 'realistisk');

  // Vit bakgrund så modellens fyllnader/strokear ger tydliga övergångar för edge-detect
  var svgString = '<svg xmlns="http://www.w3.org/2000/svg" width="' + vW + '" height="' + vH +
    '" viewBox="0 0 ' + vW + ' ' + vH + '">' +
    '<rect width="' + vW + '" height="' + vH + '" fill="white"/>' +
    modellSvg + '</svg>';

  return new Promise(function (resolve) {
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = vW; canvas.height = vH;
      var c = canvas.getContext('2d');
      c.drawImage(img, 0, 0);

      // Sobel-light edge detect → svart bakgrund + vita kanter (canny-format för ControlNet)
      var src = c.getImageData(0, 0, vW, vH);
      var dst = c.createImageData(vW, vH);
      var d = src.data, o = dst.data;
      function lum(i) { return (d[i] + d[i + 1] + d[i + 2]) / 3; }
      for (var y = 1; y < vH - 1; y++) {
        for (var x = 1; x < vW - 1; x++) {
          var i = (y * vW + x) * 4;
          var gx = Math.abs(lum(i - 4) - lum(i + 4));
          var gy = Math.abs(lum(i - vW * 4) - lum(i + vW * 4));
          var v = (gx + gy) > 28 ? 255 : 0;
          o[i] = v; o[i + 1] = v; o[i + 2] = v; o[i + 3] = 255;
        }
      }
      c.putImageData(dst, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = function () { resolve(null); };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
  });
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

  byggInspirationRad();
  initScrollReveal();
  initHurScrolly();
}

function initHurScrolly() {
  const scrolly = document.querySelector('.hur-scrolly');
  if (!scrolly) return;
  const steg = scrolly.querySelectorAll('.hur-steg');
  const lista = scrolly.querySelector('.hur-steg-lista');
  const N = steg.length;
  if (N === 0) return;
  let ticking = false;
  function uppdatera() {
    const r = scrolly.getBoundingClientRect();
    const vh = window.innerHeight;
    const total = scrolly.offsetHeight - vh;
    let progress = total > 0 ? (-r.top) / total : 0;
    progress = Math.max(0, Math.min(0.9999, progress));
    // Jämna tredjedelar — varje steg får 1/N av scrollsträckan
    const aktiv = Math.floor(progress * N);
    steg.forEach((el, i) => el.classList.toggle('aktiv', i === aktiv));
    // Långsam parallax: listan glider 30vh totalt (15vh ned → 15vh upp)
    if (lista) {
      const slideVh = (0.5 - progress) * 30;
      lista.style.setProperty('--hur-slide', slideVh + 'vh');
    }
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(uppdatera); ticking = true; }
  }, { passive: true });
  window.addEventListener('resize', uppdatera, { passive: true });
  uppdatera();
}

function initScrollReveal() {
  const items = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window) || items.length === 0) {
    items.forEach(el => el.classList.add('revealed'));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -60px 0px' });
  items.forEach(el => {
    if (!el.classList.contains('revealed')) obs.observe(el);
  });
}

function byggInspirationRad() {
  const trackV = document.querySelector('.marquee-vanster');
  const trackH = document.querySelector('.marquee-hoger');
  if (!trackV || !trackH) return;

  const aktiva = sokbara.slice();
  const renderKort = (meta) => {
    const p = projekt[meta.id];
    let bild = null;
    if (p && p.inspiration && p.inspiration.galleri) {
      for (let i = 0; i < p.inspiration.galleri.length; i++) {
        if (p.inspiration.galleri[i].bild) { bild = p.inspiration.galleri[i].bild; break; }
      }
    }
    const colors = p && p.gradientColors || projektGradients[meta.id] || projektGradients._default;
    const fallback = `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
    const bg = bild ? `url('${bild}') center/cover no-repeat` : fallback;
    const kostnad = (p && p.inspiration && p.inspiration.kostnadRange) || meta.kostnadRange || '';
    return `
    <div class="inspiration-kort" onclick="visaProjekt('${meta.id}')">
      <div class="inspiration-kort-bild" style="background: ${bg}">
        ${!bild ? `<span class="inspiration-kort-ikon">${meta.ikon}</span>` : ''}
        <div class="inspiration-kort-overlay">
          <h3>${meta.namn}</h3>
          ${kostnad ? `<span class="inspiration-kort-pris">${kostnad}</span>` : ''}
        </div>
      </div>
    </div>`;
  };

  // Rad 1: åt vänster (originalordning)
  const radV = aktiva.map(renderKort).join('');
  // Rad 2: åt höger (omvänd så det inte ser ut som en kopia)
  const radH = aktiva.slice().reverse().map(renderKort).join('');
  // Duplicera innehållet 2 gånger för seamless loop
  trackV.innerHTML = radV + radV;
  trackH.innerHTML = radH + radH;
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
  if (!el) return;
  if (!kr) { el.textContent = '— kr'; return; }
  // Visa intervall ±15%, avrundat till närmsta 500 kr
  var lo = Math.round(kr * 0.85 / 500) * 500;
  var hi = Math.round(kr * 1.15 / 500) * 500;
  el.textContent = lo.toLocaleString('sv-SE') + ' – ' + hi.toLocaleString('sv-SE') + ' kr';
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
    document.querySelectorAll('.story-sektion').forEach(s => s.classList.add('dold'));
  }, 200);

  // Fyll hero
  document.getElementById('pv-ikon').textContent        = meta?.ikon ?? p.ikon ?? '';
  document.getElementById('pv-namn').textContent        = p.namn;
  document.getElementById('pv-beskrivning').textContent = meta?.beskrivning ?? '';
  document.getElementById('pv-badges').innerHTML = '';

  // Dölj dimensioner tills upload-steget är klart
  document.getElementById('pv-dim-sektion').classList.add('dold');

  // Stäng ritvy och resetta CAD-state
  ritvyOpen = false;
  cad3dLaddad = '';
  cadLagerData = null;
  lager = {};
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

  // Förladda CAD 3D-data i bakgrunden (med default-dimensioner)
  if (p.lagerPerSteg && window.CadViewer) {
    var regler = ByggRegler.hamta(id);
    if (regler) {
      aktuellaB = regler.standard.b;
      aktuellaL = regler.standard.l;
      aktuellaH = regler.standard.h;
      forladdaCad3D(id);
    }
  }

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
    visaUploadSteg();
    return;
  }

  const insp = p.inspiration;
  const sek = document.getElementById('pv-inspiration');

  // Fyll hero-bild — använd första riktiga bilden om den finns, annars gradient
  var heroEl = document.getElementById('insp-hero-bild');
  var heroBild = null;
  if (insp.galleri) {
    for (var hi = 0; hi < insp.galleri.length; hi++) {
      if (insp.galleri[hi].bild) { heroBild = insp.galleri[hi].bild; break; }
    }
  }
  if (heroBild) {
    heroEl.style.background = 'url(' + heroBild + ') center/cover no-repeat';
  } else {
    heroEl.style.background = 'linear-gradient(135deg, ' + insp.gradientColors[0] + ', ' + insp.gradientColors[1] + ')';
  }

  // Namn och budskap
  document.getElementById('insp-namn').textContent = p.namn;
  document.getElementById('insp-budskap').textContent = insp.budskap;

  // Galleri (bilder eller placeholder-gradienter)
  var galleri = document.getElementById('insp-galleri');
  galleri.innerHTML = insp.galleri.filter(function(g) {
    // Hoppa över bilden som redan visas som hero
    return !(g.bild && g.bild === heroBild);
  }).map(function(g) {
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
  // Dölj banner, anpassa-knapp, designläge och ritvy så Starta projektet är ända vägen framåt
  var banner = document.getElementById('pv-banner-bild');
  if (banner) banner.classList.add('dold');
  var btnAnp = document.getElementById('btn-anpassa-design');
  if (btnAnp) btnAnp.classList.add('dold');
  var designLage = document.getElementById('design-lage');
  if (designLage) designLage.classList.add('dold');
  document.getElementById('ritvy-sektion').classList.add('dold');
  document.getElementById('pv-ai-sektion').classList.add('dold');
  document.getElementById('pv-upload-sektion').classList.add('dold');

  // Stegindikator
  document.getElementById('pv-steg-indikator').classList.remove('dold');
  uppdateraStegIndikator(1);
}

function startaProjektFranInspiration() {
  // Dölj inspiration
  document.getElementById('pv-inspiration').classList.add('dold');

  // Hero/flikar/instruktioner förblir dolda tills användaren har valt
  // upload-steg, så att "Hoppa över"/"Fortsätt" är sista man kan scrolla till.
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
  // Säkerställ att inget projektinnehåll syns under upload-CTA:n
  document.querySelector('.projekt-hero').classList.add('dold');
  document.querySelector('.flikar').classList.add('dold');
  document.getElementById('instruktioner').classList.add('dold');
  document.getElementById('inkopslista').classList.add('dold');
  document.getElementById('verktyg').classList.add('dold');
  var banner = document.getElementById('pv-banner-bild');
  if (banner) banner.classList.add('dold');

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

function avtacknaProjektInnehall() {
  // Visa hero, flikar och instruktioner när man går vidare från upload-steget
  document.querySelector('.projekt-hero').classList.remove('dold');
  document.querySelector('.flikar').classList.remove('dold');
  byttFlik('instruktioner');

  // Visa banner-bild för projektet om inspirationsdata finns
  var bannerEl = document.getElementById('pv-banner-bild');
  var p = projekt[valtProjekt];
  if (bannerEl && p && p.inspiration && p.inspiration.galleri) {
    var bild = null;
    for (var i = 0; i < p.inspiration.galleri.length; i++) {
      if (p.inspiration.galleri[i].bild) { bild = p.inspiration.galleri[i].bild; break; }
    }
    if (bild) {
      bannerEl.style.backgroundImage = 'url(' + bild + ')';
      bannerEl.classList.remove('dold');
    } else {
      bannerEl.classList.add('dold');
    }
  }
}

function hoppaOverUpload() {
  document.getElementById('pv-upload-sektion').classList.add('dold');
  avtacknaProjektInnehall();
  visaDimensioner();
  oppnaRitvy(true);
  visaAnpassaKnapp();
  uppdateraStegIndikator(3);
}

function gaVidare() {
  document.getElementById('pv-upload-sektion').classList.add('dold');
  avtacknaProjektInnehall();
  document.getElementById('pv-ai-sektion').classList.remove('dold');
  visaMaskEditor();
  visaDimensioner();
  oppnaRitvy(true);
  visaAnpassaKnapp();
  uppdateraStegIndikator(3);
}

function visaAnpassaKnapp() {
  var btn = document.getElementById('btn-anpassa-design');
  if (btn) btn.classList.remove('dold');
  var lage = document.getElementById('design-lage');
  if (lage) lage.classList.add('dold');
}

function visaVyTabs(medAI) { /* borttagen — vy-tabs visar samma sak */ }

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
      // Three.js OrbitControls hanterar drag/zoom
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

  AIVisualisering.renderMaskEditor(container, uploadedImage, function (maskBase64, analys) {
    tillampaMaskAnalys(analys);
    startaAIGenerering(maskBase64);
  });
}

// Översätt mask-bbox aspect → b/l inom projektets dim-gränser. Tyst auto-applicering.
function tillampaMaskAnalys(analys) {
  if (!analys || !analys.ok || !valtProjekt) return;
  var regler = ByggRegler.hamta(valtProjekt);
  if (!regler || !regler.dim) return;
  var dimB = regler.dim.b, dimL = regler.dim.l;
  var std = regler.standard || { b: aktuellaB, l: aktuellaL };

  // Heuristik: behåll standardarean men skala b/l så förhållandet matchar maskens bbox-aspect.
  // aspect = bredd / höjd i pixlar → tolkas som b / l i meter.
  var area = std.b * std.l;
  var aspect = analys.aspect;
  // b/l = aspect, b*l = area  →  l = sqrt(area/aspect), b = aspect*l
  var nyL = Math.sqrt(area / aspect);
  var nyB = aspect * nyL;

  // Snäpp till steg och klampa
  function snap(v, d) {
    var s = Math.round(v / d.steg) * d.steg;
    return Math.max(d.min, Math.min(d.max, Math.round(s * 100) / 100));
  }
  nyB = snap(nyB, dimB);
  nyL = snap(nyL, dimL);

  aktuellaB = nyB;
  aktuellaL = nyL;
  mattFranMask = true;
  synkaDesign();
  uppdateraPreview();

  // Bygg om designkontrollerna så hint + nya värden visas
  if (typeof byggDesignKontroller === 'function') byggDesignKontroller(valtProjekt);
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

  // Om måtten ändrats sedan förra genereringen — skala masken proportionellt
  // kring sin centroid så det nya bygget får plats. FLUX målar bara inuti masken.
  var maskPromise;
  var maskSkalad = false;
  if (senasteAIGenMatt &&
      (Math.abs(senasteAIGenMatt.b - aktuellaB) > 0.001 || Math.abs(senasteAIGenMatt.l - aktuellaL) > 0.001)) {
    var ratioX = aktuellaB / senasteAIGenMatt.b;
    var ratioY = aktuellaL / senasteAIGenMatt.l;
    maskSkalad = true;
    maskPromise = AIVisualisering.skalaMaskRunt(currentMask, ratioX, ratioY);
  } else {
    maskPromise = Promise.resolve(currentMask);
  }

  maskPromise.then(function(maskAttSkicka) {
    if (maskSkalad) currentMask = maskAttSkicka; // spara den uppskalade som ny baseline
    // Generera CAD-canny från den faktiska 3D-modellen så ControlNet kan följa geometrin
    return exporteraCadCanny(1024, 768).then(function(cadCanny) {
      return AIVisualisering.generera(valtProjekt, dim, uploadedImage, maskAttSkicka, cadCanny);
    });
  }).then(function(result) {
    if (result.ok) {
      AIVisualisering.renderBild(container, result.url, { maskSkalad: maskSkalad });
      senasteAIGenMatt = { b: aktuellaB, l: aktuellaL };
      uppdateraAiUppdateraKnapp();
    } else {
      AIVisualisering.renderFel(container, result.error);
    }
    kontroller.innerHTML = '<p class="ai-kostnad-info">' + AIVisualisering._config.todayCount + ' av ' + AIVisualisering._config.maxPerDag + ' genereringar idag</p>';
  });
}

// Visar/gömmer en "🔄 Uppdatera AI-bild med nya mått"-knapp i designkontrollerna.
// Knappen syns när: vi har en sparad mask + en tidigare genererad bild + b/l skiljer från senaste gen.
function uppdateraAiUppdateraKnapp() {
  var slot = document.getElementById('ai-uppdatera-slot');
  if (!slot) return;
  var harDrift = currentMask && senasteAIGenMatt &&
    (Math.abs(senasteAIGenMatt.b - aktuellaB) > 0.001 || Math.abs(senasteAIGenMatt.l - aktuellaL) > 0.001);
  if (!harDrift) {
    slot.innerHTML = '';
    return;
  }
  slot.innerHTML = '<button class="ai-uppdatera-knapp" onclick="startaAIGenerering()">🔄 Uppdatera AI-bild med nya mått</button>';
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

    // Förladda CAD 3D-data i bakgrunden för instruktionsbilder
    if (p.lagerPerSteg && !cadLagerData && window.CadViewer) {
      forladdaCad3D(id);
    }
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
    document.getElementById('pv-ai-sektion').classList.add('dold');
    uploadedImage = null;
    currentMask = null;
    mattFranMask = false;
    senasteAIGenMatt = null;
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
    document.querySelectorAll('.story-sektion').forEach(s => s.classList.remove('dold'));
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

function bytStegBild(btn, url, bildtext) {
  var img = document.getElementById('steg-bild-stor-img');
  var text = document.getElementById('steg-bild-stor-text');
  if (img) img.src = url;
  if (text) text.textContent = bildtext || '';
  // Markera aktiv thumbnail
  var alla = btn.parentElement.querySelectorAll('.steg-bild-thumb');
  alla.forEach(function(t) { t.classList.remove('aktiv'); });
  btn.classList.add('aktiv');
}

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
    <button class="skriv-ut-knapp" onclick="printaInstruktioner()">📄 Ladda ner instruktionsmanual som PDF</button>
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
  const lagerSteg = p.lagerPerSteg && p.lagerPerSteg[i];
  const cadReady = lagerSteg && cadLagerData && window.CadViewer && CadViewer.isReady();

  // Generera CAD-snapshots om tillgänglig
  let skissHtml = '';
  if (cadReady) {
    // Normalisera: stöd både nytt format (vyer) och gammalt (nya/gamla direkt)
    var vyer = lagerSteg.vyer || [{ namn: "Översikt", nya: lagerSteg.nya, gamla: lagerSteg.gamla }];
    var bilder = [];
    for (var v = 0; v < vyer.length; v++) {
      var vy = vyer[v];
      var dataUrl = CadViewer.snapshot(vy.nya, vy.gamla, vy.kamera || null);
      if (dataUrl) bilder.push({ url: dataUrl, namn: vy.namn, bildtext: vy.bildtext || '' });
    }
    if (bilder.length === 1) {
      skissHtml = `<div class="steg-detalj-skiss"><img src="${bilder[0].url}" alt="${bilder[0].namn}"></div>`;
    } else if (bilder.length > 1) {
      var huvudBild = bilder[0];
      var detaljer = bilder.slice(1);
      skissHtml = `<div class="steg-bilder">
        <div class="steg-bild-huvud" id="steg-bild-stor">
          <img src="${huvudBild.url}" alt="${huvudBild.namn}" id="steg-bild-stor-img">
          <div class="steg-bild-bildtext" id="steg-bild-stor-text">${huvudBild.bildtext}</div>
        </div>
        <div class="steg-bild-detaljer">
          <button class="steg-bild-thumb aktiv" onclick="bytStegBild(this, '${huvudBild.url}', '${huvudBild.bildtext.replace(/'/g, "\\'")}')">
            <img src="${huvudBild.url}" alt="${huvudBild.namn}">
            <span>${huvudBild.namn}</span>
          </button>
          ${detaljer.map(function(d) {
            return `<button class="steg-bild-thumb" onclick="bytStegBild(this, '${d.url}', '${d.bildtext.replace(/'/g, "\\'")}')">
              <img src="${d.url}" alt="${d.namn}">
              <span>${d.namn}</span>
            </button>`;
          }).join('')}
        </div>
      </div>`;
    }
  }
  if (!skissHtml && harSvg) {
    skissHtml = `<div class="steg-detalj-skiss">${p.svgar[i]}</div>`;
  }

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

      ${skissHtml}

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
    <button class="skriv-ut-knapp" onclick="printaInkopslista()">📄 Ladda ner inköpslista som PDF</button>
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

function printaInkopslista() {
  document.body.classList.add('printing-inkop');
  window.print();
  setTimeout(() => document.body.classList.remove('printing-inkop'), 500);
}

function printaInstruktioner() {
  document.body.classList.add('printing-instr');
  window.print();
  setTimeout(() => document.body.classList.remove('printing-instr'), 500);
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
