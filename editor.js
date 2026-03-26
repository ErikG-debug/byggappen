// ============================================================
// EDITOR — Interaktiv redigering av konstruktioner
// ============================================================
//
// Gor planvyn (planritning) interaktiv: anvandaren kan dra i
// kanter for att andra dimensioner, lagga till sektioner for
// L-former, valja och ta bort sektioner.
//
// ============================================================

var Editor = (function () {

  // ── Tillstand ──
  var _planInfo = null;     // { ox, oy, sc } — planvyns koordinatsystem
  var _drag = null;         // Aktivt drag-tillstand
  var _rafId = null;        // requestAnimationFrame-ID for throttling
  var _listenersInit = false;
  var _valdSektionId = null; // Vald sektion

  // ── Visuella konstanter ──
  var HANDLE_COLOR    = '#2b6a3a';
  var HIT_AREA        = 14;       // px — osynligt klickbart omrade
  var INDICATOR_R     = 5;        // px — synlig cirkel
  var CORNER_SIZE     = 10;       // px — hornhandtag
  var ADD_ZONE_SIZE   = 26;       // px — "+"-knapp
  var ADD_ZONE_COLOR  = '#1976D2';
  var SELECT_COLOR    = '#1565C0';
  var REMOVE_COLOR    = '#c62828';

  // ==========================================================
  // Koordinatsystem
  // ==========================================================

  function setPlanInfo(ox, oy, sc) {
    _planInfo = { ox: ox, oy: oy, sc: sc };
  }

  function valdSektionId() {
    return _valdSektionId;
  }

  function valjSektion(id) {
    _valdSektionId = id;
  }

  function _mouseToSvg(svg, e) {
    var touch = e.touches ? e.touches[0] : e;
    var pt = svg.createSVGPoint();
    pt.x = touch.clientX;
    pt.y = touch.clientY;
    var ctm = svg.getScreenCTM();
    if (!ctm) return pt;
    return pt.matrixTransform(ctm.inverse());
  }

  // ==========================================================
  // Generera handtag-SVG (anropas fran planRitning)
  // ==========================================================

  function planHandles() {
    if (!aktuelltDesign || !_planInfo) return '';
    var sektioner = aktuelltDesign.sektioner;
    if (sektioner.length === 0) return '';

    // Satt vald sektion om ingen ar vald
    if (!_valdSektionId || !sektioner.find(function (s) { return s.id === _valdSektionId; })) {
      _valdSektionId = sektioner[0].id;
    }

    var o = '<g id="editor-handles">';

    // 1. Klickbara ytor for sektionsval (under allt annat)
    for (var i = 0; i < sektioner.length; i++) {
      o += _sektionClickRect(sektioner[i]);
    }

    // 2. Resize-handtag (bara pa vald sektion)
    var vald = sektioner.find(function (s) { return s.id === _valdSektionId; });
    if (vald) {
      o += _sektionHandles(vald);
    }

    // 3. "+"-zoner pa ytterkanter
    o += _addZones();

    // 4. "✕"-knappar pa icke-forsta sektioner
    if (sektioner.length > 1) {
      for (var j = 1; j < sektioner.length; j++) {
        o += _removeButton(sektioner[j]);
      }
    }

    o += '</g>';
    return o;
  }

  // ── Klickbar yta for att valja en sektion ──
  function _sektionClickRect(sek) {
    var sc = _planInfo.sc;
    var sx = _planInfo.ox + sek.x * sc;
    var sy = _planInfo.oy + sek.y * sc;
    var dW = sek.b * sc;
    var dH = sek.l * sc;
    var isVald = sek.id === _valdSektionId;
    var o = '';

    // Transparent klickyta
    o += '<rect x="' + sx.toFixed(1) + '" y="' + sy.toFixed(1) +
      '" width="' + dW.toFixed(1) + '" height="' + dH.toFixed(1) +
      '" fill="' + (isVald ? SELECT_COLOR : 'transparent') +
      '" opacity="' + (isVald ? '0.06' : '0') +
      '" data-handle="select-section" data-sektion="' + sek.id +
      '" cursor="pointer"/>';

    // Markering pa vald sektion
    if (isVald) {
      o += '<rect x="' + (sx - 2).toFixed(1) + '" y="' + (sy - 2).toFixed(1) +
        '" width="' + (dW + 4).toFixed(1) + '" height="' + (dH + 4).toFixed(1) +
        '" fill="none" stroke="' + SELECT_COLOR + '" stroke-width="2" stroke-dasharray="6,3" opacity="0.6" pointer-events="none"/>';
    }

    return o;
  }

  // ── Resize-handtag for vald sektion ──
  function _sektionHandles(sek) {
    var sc = _planInfo.sc;
    var sx = _planInfo.ox + sek.x * sc;
    var sy = _planInfo.oy + sek.y * sc;
    var dW = sek.b * sc;
    var dH = sek.l * sc;
    var id = sek.id;
    var o = '';

    // -- Hoger kant (dra for att andra bredd) --
    var midY = sy + dH / 2;
    o += _rect(sx + dW - HIT_AREA / 2, sy + 10, HIT_AREA, dH - 20,
      'transparent', 0, 'resize-right', id, 'ew-resize');
    o += _circle(sx + dW, midY, INDICATOR_R, HANDLE_COLOR, 0.45, 'none');
    o += _arrows(sx + dW, midY, 'h');

    // -- Nedre kant (dra for att andra djup) --
    var midX = sx + dW / 2;
    o += _rect(sx + 10, sy + dH - HIT_AREA / 2, dW - 20, HIT_AREA,
      'transparent', 0, 'resize-bottom', id, 'ns-resize');
    o += _circle(midX, sy + dH, INDICATOR_R, HANDLE_COLOR, 0.45, 'none');
    o += _arrows(midX, sy + dH, 'v');

    // -- Horn nere till hoger --
    o += _rect(sx + dW - CORNER_SIZE, sy + dH - CORNER_SIZE,
      CORNER_SIZE + 6, CORNER_SIZE + 6,
      HANDLE_COLOR, 0.15, 'resize-corner', id, 'nwse-resize');
    o += '<path d="M' + (sx + dW + 4) + ',' + (sy + dH - 7) +
      ' L' + (sx + dW + 4) + ',' + (sy + dH + 4) +
      ' L' + (sx + dW - 7) + ',' + (sy + dH + 4) + '"' +
      ' fill="none" stroke="' + HANDLE_COLOR + '" stroke-width="2" opacity="0.5" pointer-events="none"/>';

    return o;
  }

  // ── "+"-zoner pa ytterkanter ──
  function _addZones() {
    if (!aktuelltDesign || aktuelltDesign.sektioner.length === 0) return '';

    var yttre = DesignModell.ytterkanter(aktuelltDesign);
    var o = '';
    var sc = _planInfo.sc;
    var ox = _planInfo.ox;
    var oy = _planInfo.oy;

    for (var i = 0; i < yttre.length; i++) {
      var kant = yttre[i];

      // Hoppa over nordkanter vid y=0 (husvagg)
      if (kant.sida === 'nord' && Math.abs(kant.pos) < 0.01) continue;

      // Hoppa over korta kanter (< 1m)
      if (kant.slut - kant.start < 0.5) continue;

      var midVal = (kant.start + kant.slut) / 2;
      var cx, cy;
      var sz = ADD_ZONE_SIZE;

      if (kant.riktning === 'h') {
        cx = ox + midVal * sc;
        cy = oy + kant.pos * sc + (kant.sida === 'syd' ? sz / 2 + 6 : -(sz / 2 + 6));
      } else {
        cx = ox + kant.pos * sc + (kant.sida === 'ost' ? sz / 2 + 6 : -(sz / 2 + 6));
        cy = oy + midVal * sc;
      }

      // Knapp-bakgrund
      o += '<rect x="' + (cx - sz / 2).toFixed(1) + '" y="' + (cy - sz / 2).toFixed(1) +
        '" width="' + sz + '" height="' + sz +
        '" rx="6" fill="white" stroke="' + ADD_ZONE_COLOR + '" stroke-width="1.5" opacity="0.9"' +
        ' data-handle="add-section"' +
        ' data-add-side="' + kant.sida + '"' +
        ' data-add-pos="' + kant.pos + '"' +
        ' data-add-start="' + kant.start + '"' +
        ' data-add-slut="' + kant.slut + '"' +
        ' data-sektion="' + kant.sektionId + '"' +
        ' cursor="pointer"/>';

      // Plus-tecken
      var ps = 6;
      o += '<line x1="' + (cx - ps).toFixed(1) + '" y1="' + cy.toFixed(1) +
        '" x2="' + (cx + ps).toFixed(1) + '" y2="' + cy.toFixed(1) +
        '" stroke="' + ADD_ZONE_COLOR + '" stroke-width="2.5" pointer-events="none"/>';
      o += '<line x1="' + cx.toFixed(1) + '" y1="' + (cy - ps).toFixed(1) +
        '" x2="' + cx.toFixed(1) + '" y2="' + (cy + ps).toFixed(1) +
        '" stroke="' + ADD_ZONE_COLOR + '" stroke-width="2.5" pointer-events="none"/>';
    }

    return o;
  }

  // ── "✕"-knapp for att ta bort sektion ──
  function _removeButton(sek) {
    var sc = _planInfo.sc;
    var sx = _planInfo.ox + sek.x * sc;
    var sy = _planInfo.oy + sek.y * sc;
    var sz = 18;
    var cx = sx + sz / 2 + 3;
    var cy = sy + sz / 2 + 3;
    var o = '';

    o += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) +
      '" r="' + (sz / 2) + '" fill="' + REMOVE_COLOR + '" opacity="0.7"' +
      ' data-handle="remove-section" data-sektion="' + sek.id + '" cursor="pointer"/>';

    var xs = 4;
    o += '<line x1="' + (cx - xs).toFixed(1) + '" y1="' + (cy - xs).toFixed(1) +
      '" x2="' + (cx + xs).toFixed(1) + '" y2="' + (cy + xs).toFixed(1) +
      '" stroke="white" stroke-width="2" pointer-events="none"/>';
    o += '<line x1="' + (cx + xs).toFixed(1) + '" y1="' + (cy - xs).toFixed(1) +
      '" x2="' + (cx - xs).toFixed(1) + '" y2="' + (cy + xs).toFixed(1) +
      '" stroke="white" stroke-width="2" pointer-events="none"/>';

    return o;
  }

  // ── SVG-hjalpare ──

  function _rect(x, y, w, h, fill, opacity, handle, sekId, cursor) {
    return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) +
      '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) +
      '" fill="' + fill + '" opacity="' + opacity +
      '" rx="3" data-handle="' + handle +
      '" data-sektion="' + sekId +
      '" cursor="' + cursor + '"/>';
  }

  function _circle(cx, cy, r, fill, opacity, pointerEvents) {
    return '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) +
      '" r="' + r + '" fill="' + fill + '" opacity="' + opacity +
      '" pointer-events="' + pointerEvents + '"/>';
  }

  function _arrows(cx, cy, dir) {
    var s = 4;
    var o = '';
    if (dir === 'h') {
      o += '<path d="M' + (cx - s - 1) + ',' + cy + ' l' + s + ',-' + (s - 1) + ' l0,' + (2 * (s - 1)) + 'z" fill="' + HANDLE_COLOR + '" opacity="0.5" pointer-events="none"/>';
      o += '<path d="M' + (cx + s + 1) + ',' + cy + ' l-' + s + ',-' + (s - 1) + ' l0,' + (2 * (s - 1)) + 'z" fill="' + HANDLE_COLOR + '" opacity="0.5" pointer-events="none"/>';
    } else {
      o += '<path d="M' + cx + ',' + (cy - s - 1) + ' l-' + (s - 1) + ',' + s + ' l' + (2 * (s - 1)) + ',0z" fill="' + HANDLE_COLOR + '" opacity="0.5" pointer-events="none"/>';
      o += '<path d="M' + cx + ',' + (cy + s + 1) + ' l-' + (s - 1) + ',-' + s + ' l' + (2 * (s - 1)) + ',0z" fill="' + HANDLE_COLOR + '" opacity="0.5" pointer-events="none"/>';
    }
    return o;
  }

  // ==========================================================
  // Eventhantering
  // ==========================================================

  function initListeners() {
    if (_listenersInit) return;
    var canvas = document.querySelector('.ritvy-canvas');
    if (!canvas) return;
    _listenersInit = true;

    canvas.addEventListener('mousedown', _onDown, false);
    canvas.addEventListener('touchstart', _onDown, { passive: false });
    window.addEventListener('mousemove', _onMove, false);
    window.addEventListener('touchmove', _onMove, { passive: false });
    window.addEventListener('mouseup', _onUp, false);
    window.addEventListener('touchend', _onUp, false);
  }

  function _onDown(e) {
    if (ritvyStyle !== 'plan') return;

    var target = e.target;
    var handle = target.getAttribute && target.getAttribute('data-handle');
    if (!handle) return;

    e.preventDefault();
    e.stopPropagation();

    var sekId = target.getAttribute('data-sektion');

    // ── Klick pa "+"-zon ──
    if (handle === 'add-section') {
      var sida = target.getAttribute('data-add-side');
      var pos = parseFloat(target.getAttribute('data-add-pos'));
      var start = parseFloat(target.getAttribute('data-add-start'));
      var slut = parseFloat(target.getAttribute('data-add-slut'));
      if (typeof laggTillNySektion === 'function') {
        laggTillNySektion(sida, pos, start, slut);
      }
      return;
    }

    // ── Klick pa "✕" ──
    if (handle === 'remove-section') {
      if (typeof taBortNySektion === 'function') {
        taBortNySektion(sekId);
      }
      return;
    }

    // ── Klick pa sektion for val ──
    if (handle === 'select-section') {
      if (sekId && sekId !== _valdSektionId) {
        _valdSektionId = sekId;
        if (typeof valjSektionGlobal === 'function') {
          valjSektionGlobal(sekId);
        }
      }
      return;
    }

    // ── Resize-drag ──
    var sek = aktuelltDesign.sektioner.find(function (s) { return s.id === sekId; });
    if (!sek) return;

    var svg = document.getElementById('ritvy-svg');
    var pt = _mouseToSvg(svg, e);

    _drag = {
      handle: handle,
      sektionId: sekId,
      startSvgX: pt.x,
      startSvgY: pt.y,
      startB: sek.b,
      startL: sek.l,
      lastClientX: (e.touches ? e.touches[0] : e).clientX,
      lastClientY: (e.touches ? e.touches[0] : e).clientY
    };

    document.body.style.userSelect = 'none';
  }

  function _onMove(e) {
    if (!_drag || !_planInfo) return;
    e.preventDefault();

    var touch = e.touches ? e.touches[0] : e;
    _drag.lastClientX = touch.clientX;
    _drag.lastClientY = touch.clientY;

    if (!_rafId) {
      _rafId = requestAnimationFrame(_processDrag);
    }
  }

  function _processDrag() {
    _rafId = null;
    if (!_drag) return;

    var svg = document.getElementById('ritvy-svg');
    if (!svg) return;

    var pt = svg.createSVGPoint();
    pt.x = _drag.lastClientX;
    pt.y = _drag.lastClientY;
    var ctm = svg.getScreenCTM();
    if (!ctm) return;
    pt = pt.matrixTransform(ctm.inverse());

    var sc = _planInfo.sc;
    var dx = (pt.x - _drag.startSvgX) / sc;
    var dy = (pt.y - _drag.startSvgY) / sc;

    var regler = ByggRegler.hamta(aktuelltDesign.projektTyp);
    if (!regler) return;

    var sek = aktuelltDesign.sektioner.find(function (s) { return s.id === _drag.sektionId; });
    if (!sek) return;

    var newB = _drag.startB;
    var newL = _drag.startL;

    if (_drag.handle === 'resize-right' || _drag.handle === 'resize-corner') {
      newB = ByggRegler.klamma(_drag.startB + dx, regler.dim.b.min, regler.dim.b.max, regler.dim.b.steg);
    }
    if (_drag.handle === 'resize-bottom' || _drag.handle === 'resize-corner') {
      newL = ByggRegler.klamma(_drag.startL + dy, regler.dim.l.min, regler.dim.l.max, regler.dim.l.steg);
    }

    if (newB === sek.b && newL === sek.l) return;

    // Uppdatera sektionen direkt
    DesignModell.andraSektion(aktuelltDesign, _drag.sektionId, { b: newB, l: newL });

    // Uppdatera via global funktion
    if (typeof uppdateraFranDesign === 'function') {
      uppdateraFranDesign();
    }
  }

  function _onUp() {
    if (_drag) {
      _drag = null;
      document.body.style.userSelect = '';
      if (_rafId) {
        cancelAnimationFrame(_rafId);
        _rafId = null;
      }
    }
  }

  // ==========================================================
  // Publikt API
  // ==========================================================

  return {
    setPlanInfo: setPlanInfo,
    planHandles: planHandles,
    initListeners: initListeners,
    valdSektionId: valdSektionId,
    valjSektion: valjSektion
  };

})();
