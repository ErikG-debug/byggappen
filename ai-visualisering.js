/**
 * AI-Visualisering — inpainting via Stable Diffusion SDXL (Replicate)
 * med canvas-baserad mask-editor.
 */
var AIVisualisering = (function () {

  // ---- Intern konfiguration ------------------------------------------------

  var _config = {
    proxyUrl: 'http://localhost:3001',
    maxPerDag: 20,
    isGenerating: false,
    todayCount: 0
  };

  // ---- Hjälpfunktioner ------------------------------------------------------

  function _resizeFit(dataUrl, maxDim) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var w = img.width;
        var h = img.height;

        // Skala ner om någon sida överstiger maxDim, behåll proportioner
        if (w > maxDim || h > maxDim) {
          var scale = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    });
  }

  function _todayKey() {
    var d = new Date();
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return 'ai_count_' + yyyy + '-' + mm + '-' + dd;
  }

  var _projektPrompt = {
    altan:    'a clearly elevated three-dimensional wooden deck platform standing above the grass on visible wooden support posts, deep dark shadow cast on the ground underneath the deck, prominent thick fascia board along the deck edge showing the structure has real height and depth, horizontal pressure-treated pine planks on top with visible wood grain and small gaps, wooden railing with vertical balusters, the deck is a solid built structure not a pattern on the ground, natural wood color, Scandinavian garden, photorealistic',
    pergola:  'a freestanding wooden pergola with open lattice roof beams, four thick square timber posts, natural light pine wood, simple geometric design, climbing roses on one side, Scandinavian garden style',
    lekstuga: 'a traditional Swedish children\'s playhouse, classic Falu red painted horizontal wood panels with white trim around windows and door, steep pitched roof with black felt, one small window with white cross-bar frame, one small wooden door with white frame, sitting on grass',
    forrad:   'a small wooden garden storage shed, vertical board-on-board pine cladding, single plank door with iron hinges, pitched roof covered in black roofing felt, natural untreated wood tone, simple and functional Nordic design',
    plank:    'a tall wooden privacy fence made of horizontal cedar slats with small gaps between, mounted on sturdy square posts, natural weathered wood tone, clean modern Scandinavian look',
    spalje:   'a wooden garden trellis screen with diamond lattice pattern, natural light pine wood, green climbing plants weaving through, freestanding with simple frame',
    garage:   'a single-car wooden garage with gable roof covered in black shingles, wide white painted double doors, Falu red horizontal wood siding with white corner trim, concrete driveway approach',
    carport:  'an open wooden carport with flat roof at slight pitch, four thick glulam timber posts, natural wood finish, gravel surface beneath, attached to house',
    vaxthus:  'a small glass and wood greenhouse with aluminum frame, steep gable roof, transparent glass panels on all sides, potted plants visible inside, gravel base',
    staket:   'a low traditional Swedish wooden picket fence, pointed picket tops, white painted, evenly spaced, along a garden path with green lawn on both sides'
  };

  var _ljusBeskrivningar = {
    'golden hour':    'warm golden hour lighting, long soft shadows, low sun angle',
    'overcast':       'soft overcast daylight, diffused shadows, even lighting',
    'midday':         'bright midday sunlight, sharp defined shadows, high contrast',
    'soft afternoon': 'soft late afternoon light, gentle warm tones'
  };

  function _engelskaSkuggor(s) {
    return ({ 'vänster': 'left', 'höger': 'right', 'framifrån': 'foreground', 'bakifrån': 'background' })[s] || 'side';
  }

  // Senast använda seed (sätts efter lyckad generering, återanvänds vid nudge)
  var _lastSeed = null;
  var _lastGenContext = null; // { projektTyp, b, l, imageHash } för att avgöra om seed ska återanvändas

  function _imageHash(dataUrl) {
    // Snabb hash: längd + första/sista 32 tecken — räcker för att skilja olika bilder.
    if (!dataUrl) return '';
    return dataUrl.length + ':' + dataUrl.slice(64, 96) + ':' + dataUrl.slice(-32);
  }

  function _shouldReuseSeed(projektTyp, dim, imageBase64) {
    if (!_lastSeed || !_lastGenContext) return false;
    if (_lastGenContext.projektTyp !== projektTyp) return false;
    if (_lastGenContext.imageHash !== _imageHash(imageBase64)) return false;
    if (!dim || !_lastGenContext.b || !_lastGenContext.l) return false;
    var dB = Math.abs(dim.b - _lastGenContext.b) / _lastGenContext.b;
    var dL = Math.abs(dim.l - _lastGenContext.l) / _lastGenContext.l;
    return dB < 0.20 && dL < 0.20;
  }

  function nollstallSeed() {
    _lastSeed = null;
    _lastGenContext = null;
  }

  // ---- Publika metoder ------------------------------------------------------

  function init() {
    var key = _todayKey();
    var stored = localStorage.getItem(key);
    if (stored !== null) {
      _config.todayCount = parseInt(stored, 10) || 0;
    } else {
      _config.todayCount = 0;
    }
  }

  function kontrolleraKostnad() {
    return _config.todayCount < _config.maxPerDag;
  }

  function byggPrompt(projektTyp, dim, ljus) {
    var description = _projektPrompt[projektTyp] || ('a ' + projektTyp + ', natural wood, Scandinavian style');

    var mattText = '';
    if (dim && dim.b && dim.l) {
      mattText = ', approximately ' + dim.b + ' meters wide and ' + dim.l + ' meters deep';
    }

    var ljusText = (ljus && _ljusBeskrivningar[ljus.typ])
      ? _ljusBeskrivningar[ljus.typ]
      : 'natural daylight';
    var skuggor = (ljus && ljus.skuggriktning)
      ? ', shadows falling toward the ' + _engelskaSkuggor(ljus.skuggriktning)
      : '';

    return description + mattText + ', photorealistic architectural photography, '
         + ljusText + skuggor + ', shallow depth of field, ultra-detailed, '
         + 'professional outdoor photography, 8k uhd, dslr photo, sharp focus';
  }

  async function generera(projektTyp, dim, userImageBase64, maskBase64, cadCannyBase64, ljus) {
    if (!kontrolleraKostnad()) {
      return { ok: false, error: 'Dagsgränsen på ' + _config.maxPerDag + ' genereringar har uppnåtts.' };
    }

    if (!userImageBase64 || !maskBase64) {
      return { ok: false, error: 'Bild och mask krävs för inpainting.' };
    }

    _config.isGenerating = true;

    try {
      var prompt = byggPrompt(projektTyp, dim, ljus);

      // Resize bild + mask + ev. CAD-canny (behåll proportioner, max 2048px)
      var resizedImage = await _resizeFit(userImageBase64, 2048);
      var resizedMask = await _resizeFit(maskBase64, 2048);
      var resizedCanny = cadCannyBase64 ? await _resizeFit(cadCannyBase64, 2048) : null;

      var payload = { prompt: prompt, image: resizedImage, mask: resizedMask, dimensions: dim };
      if (resizedCanny) payload.cadCanny = resizedCanny;
      if (_shouldReuseSeed(projektTyp, dim, userImageBase64)) {
        payload.seed = _lastSeed;
      }

      var res = await fetch(_config.proxyUrl + '/api/visualisera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      var data = await res.json();

      if (!res.ok) {
        return { ok: false, error: data.error || 'Serverfel (' + res.status + ')' };
      }

      // Spara seed + kontext från serverns svar för ev. seed-återanvändning vid nudge
      if (data.seed != null) {
        _lastSeed = data.seed;
        _lastGenContext = {
          projektTyp: projektTyp,
          b: dim && dim.b,
          l: dim && dim.l,
          imageHash: _imageHash(userImageBase64)
        };
      }

      _config.todayCount++;
      localStorage.setItem(_todayKey(), String(_config.todayCount));

      return { ok: true, url: data.url, seed: data.seed };
    } catch (err) {
      return { ok: false, error: err.message || 'Kunde inte kontakta AI-servern.' };
    } finally {
      _config.isGenerating = false;
    }
  }

  // ---- Mask-editor (BORTTAGEN — ersatt av perspektiv-editorn) -------------
  // Den gamla mask-editorn, analyseraMaskCanvas, skalaMaskRunt och exportMask
  // togs bort i samband med övergången till 3D-perspektiv-editorn.
  /* DEAD_CODE_REMOVED
  function renderMaskEditor_REMOVED(container, imageBase64, onGenerate) {
    container.innerHTML = '';

    var instruktion = document.createElement('p');
    instruktion.className = 'mask-instruktion';
    instruktion.textContent = 'Måla hela ytan där bygget ska synas — inklusive höjden, inte bara marken. Klicka sedan "Generera".';
    container.appendChild(instruktion);

    var wrapper = document.createElement('div');
    wrapper.className = 'mask-editor';

    var img = document.createElement('img');
    img.src = imageBase64;
    img.draggable = false;

    var canvas = document.createElement('canvas');
    var ctx;
    var drawing = false;
    var brushSize = 30;
    var undoStack = [];

    img.onload = function () {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx = canvas.getContext('2d');
    };

    wrapper.appendChild(img);
    wrapper.appendChild(canvas);

    var overlayHint = document.createElement('div');
    overlayHint.className = 'mask-overlay-hint';
    overlayHint.innerHTML = '<span class="mask-overlay-icon">&#9999;&#65039;</span><br>Rita d\u00e4r du vill att byggnaden ska vara';
    wrapper.appendChild(overlayHint);

    container.appendChild(wrapper);

    // Toolbar
    var toolbar = document.createElement('div');
    toolbar.className = 'mask-toolbar';

    // Brush size
    var brushLabel = document.createElement('label');
    brushLabel.textContent = 'Pensel: ';
    brushLabel.style.fontSize = '0.88rem';
    brushLabel.style.color = '#555';
    var brushSlider = document.createElement('input');
    brushSlider.type = 'range';
    brushSlider.min = '10';
    brushSlider.max = '80';
    brushSlider.value = '30';
    brushSlider.style.width = '100px';
    brushSlider.style.accentColor = '#2b6a3a';
    brushSlider.addEventListener('input', function () { brushSize = parseInt(this.value, 10); });
    brushLabel.appendChild(brushSlider);
    toolbar.appendChild(brushLabel);

    // Undo
    var btnUndo = document.createElement('button');
    btnUndo.className = 'mask-knapp';
    btnUndo.textContent = 'Ångra';
    btnUndo.onclick = function () {
      if (undoStack.length > 0 && ctx) {
        ctx.putImageData(undoStack.pop(), 0, 0);
      }
    };
    toolbar.appendChild(btnUndo);

    // Clear
    var btnClear = document.createElement('button');
    btnClear.className = 'mask-knapp';
    btnClear.textContent = 'Rensa';
    btnClear.onclick = function () {
      if (ctx) {
        undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    toolbar.appendChild(btnClear);

    // Generate
    var btnGenerate = document.createElement('button');
    btnGenerate.className = 'mask-knapp mask-knapp-generera';
    btnGenerate.textContent = 'Generera';
    btnGenerate.onclick = function () {
      var maskData = exportMask(canvas);
      var analys = analyseraMaskCanvas(canvas);
      if (onGenerate) onGenerate(maskData, analys);
    };
    toolbar.appendChild(btnGenerate);

    container.appendChild(toolbar);

    // Drawing logic
    function getPos(e) {
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      var clientX, clientY;
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    }

    function startDraw(e) {
      e.preventDefault();
      if (!ctx) return;
      if (overlayHint && overlayHint.parentNode) {
        overlayHint.classList.add('mask-overlay-hint-hidden');
        setTimeout(function() {
          if (overlayHint.parentNode) overlayHint.parentNode.removeChild(overlayHint);
        }, 400);
      }
      drawing = true;
      undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      var pos = getPos(e);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, brushSize, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
    }

    function draw(e) {
      e.preventDefault();
      if (!drawing || !ctx) return;
      var pos = getPos(e);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, brushSize, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
    }

    function stopDraw(e) {
      if (e) e.preventDefault();
      drawing = false;
    }

    // Mouse events
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);

    // Touch events
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDraw, { passive: false });
  }

  // Analysera mask-canvasen: bounding box för målade pixlar + uppskattad aspect ratio.
  // Returnerar { ok, bbox: {x,y,w,h}, aspect, fyllning } där aspect = bredd / höjd (perspektiv ej korrigerat).
  function analyseraMaskCanvas(canvas) {
    var w = canvas.width;
    var h = canvas.height;
    if (!w || !h) return { ok: false };
    var data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    var minX = w, minY = h, maxX = -1, maxY = -1, antal = 0;
    // Sampla varannan pixel för fart
    for (var y = 0; y < h; y += 2) {
      for (var x = 0; x < w; x += 2) {
        var idx = (y * w + x) * 4 + 3;
        if (data[idx] > 0) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          antal++;
        }
      }
    }
    if (maxX < 0 || antal < 30) return { ok: false };
    var bw = maxX - minX + 1;
    var bh = maxY - minY + 1;
    return {
      ok: true,
      bbox: { x: minX, y: minY, w: bw, h: bh },
      aspect: bw / bh,
      fyllning: antal / ((w * h) / 4)
    };
  }

  // Skala om en mask-PNG (dataURL) kring sin centroid med givna ratio bredd/höjd.
  // Används när användaren ändrat b/l efter första genereringen — vi blåser upp masken
  // proportionellt så det nya bygget får plats.
  function skalaMaskRunt(maskDataUrl, ratioX, ratioY) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var w = img.width, h = img.height;
        // Hitta bbox-centroid på vita pixlar
        var tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        var tctx = tmp.getContext('2d');
        tctx.drawImage(img, 0, 0);
        var data = tctx.getImageData(0, 0, w, h).data;
        var minX = w, minY = h, maxX = -1, maxY = -1;
        for (var y = 0; y < h; y += 2) {
          for (var x = 0; x < w; x += 2) {
            // vit pixel = R>128
            if (data[(y * w + x) * 4] > 128) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < 0) { resolve(maskDataUrl); return; }
        var cx = (minX + maxX) / 2;
        var cy = (minY + maxY) / 2;

        var out = document.createElement('canvas');
        out.width = w; out.height = h;
        var octx = out.getContext('2d');
        octx.fillStyle = '#000';
        octx.fillRect(0, 0, w, h);
        octx.translate(cx, cy);
        octx.scale(ratioX, ratioY);
        octx.translate(-cx, -cy);
        octx.drawImage(tmp, 0, 0);
        resolve(out.toDataURL('image/png'));
      };
      img.src = maskDataUrl;
    });
  }

  function exportMask(canvas) {
    var w = canvas.width;
    var h = canvas.height;
    var offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    var offCtx = offscreen.getContext('2d');

    // Black background
    offCtx.fillStyle = '#000000';
    offCtx.fillRect(0, 0, w, h);

    // Read source canvas
    var srcData = canvas.getContext('2d').getImageData(0, 0, w, h);
    var dstData = offCtx.getImageData(0, 0, w, h);

    for (var i = 0; i < srcData.data.length; i += 4) {
      if (srcData.data[i + 3] > 0) {
        dstData.data[i] = 255;     // R
        dstData.data[i + 1] = 255; // G
        dstData.data[i + 2] = 255; // B
        dstData.data[i + 3] = 255; // A
      }
    }

    offCtx.putImageData(dstData, 0, 0);
    return offscreen.toDataURL('image/png');
  }
  END_DEAD_CODE_REMOVED */

  // ---- Perspektiv-editor (Fas 2: statisk wireframe) ------------------------

  var DEFAULT_KAMERA = {
    rotAz: -Math.PI / 4,
    rotEl: -0.35,
    roll: 0,
    zoom: 1,
    offsetX: 0,
    offsetY: 0
  };

  function _renderWireframeSvg(design, berakning, transform, vW, vH) {
    if (typeof Render3D === 'undefined' || typeof byggModellWireframe === 'undefined' ||
        typeof ByggGenerator === 'undefined') {
      return '';
    }
    var delar = ByggGenerator.delar(design, berakning);
    var b = berakning.b || design.b || 3;
    var l = berakning.l || design.l || 3;
    var h = berakning.h || design.h || 2.2;
    var ctx = Render3D.skapaKontext(
      b, l, h,
      transform.rotAz, transform.rotEl,
      transform.zoom,
      vW, vH,
      transform.offsetX, transform.offsetY
    );
    var inner = byggModellWireframe(delar, ctx);
    // Modellens geometriska mitt (bounding-box centrum) projicerat på skärm — den punkt vi roterar kring
    var origin = ctx.proj(b / 2, l / 2, h / 2);
    var ocx = origin[0], ocy = origin[1];
    inner = _wrapRoll(inner, transform.roll || 0, ocx, ocy);
    // Wrappa i tydlig cyan stroke så den syns mot både ljusa och mörka tomtbilder
    return '<g stroke="#00e5ff" stroke-width="2.5" fill="none">' + inner + '</g>'
         + _renderAxisGizmo(ctx, b, l, h, transform);
  }

  // XYZ-axlar förankrade i modellens bounding-box-centrum
  function _renderAxisGizmo(ctx, b, l, h, transform) {
    var cx = b / 2, cy = l / 2, cz = h / 2;
    var armLen = Math.max(b, l, h) * 0.6;
    var origin = ctx.proj(cx, cy, cz);
    var pX = ctx.proj(cx + armLen, cy, cz);
    var pY = ctx.proj(cx, cy + armLen, cz);
    var pZ = ctx.proj(cx, cy, cz + armLen);
    // Applicera Y-rotation (roll) runt origo så axlarna följer wireframen
    var roll = transform.roll || 0;
    var cr = Math.cos(roll), sr = Math.sin(roll);
    function r(p) {
      var dx = p[0] - origin[0], dy = p[1] - origin[1];
      return [origin[0] + dx*cr - dy*sr, origin[1] + dx*sr + dy*cr];
    }
    pX = r(pX); pY = r(pY); pZ = r(pZ);
    var axes = [
      { p: pX, col: '#ff3838', lab: 'X' },
      { p: pY, col: '#38ff5c', lab: 'Y' },
      { p: pZ, col: '#3890ff', lab: 'Z' }
    ];
    var svg = '';
    // Liten markör vid origo
    svg += '<circle cx="' + origin[0].toFixed(1) + '" cy="' + origin[1].toFixed(1) + '" r="4" fill="#fff" stroke="#000" stroke-width="1"/>';
    for (var i = 0; i < axes.length; i++) {
      var a = axes[i];
      svg += '<line x1="' + origin[0].toFixed(1) + '" y1="' + origin[1].toFixed(1) + '" x2="' + a.p[0].toFixed(1) + '" y2="' + a.p[1].toFixed(1) + '" stroke="' + a.col + '" stroke-width="3.5" stroke-linecap="round"/>';
      var dx = a.p[0] - origin[0], dy = a.p[1] - origin[1];
      var lx = a.p[0] + dx*0.15, ly = a.p[1] + dy*0.15 + 4;
      svg += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" fill="' + a.col + '" font-size="14" font-weight="800" text-anchor="middle" font-family="Arial" stroke="#000" stroke-width="0.5" paint-order="stroke">' + a.lab + '</text>';
    }
    return svg;
  }

  // Wrappa SVG-innehåll i en roll-rotation runt viewport-centrum
  function _wrapRoll(innerSvg, rollRad, cx, cy) {
    if (!rollRad) return innerSvg;
    var deg = (rollRad * 180 / Math.PI).toFixed(2);
    return '<g transform="rotate(' + deg + ' ' + cx + ' ' + cy + ')">' + innerSvg + '</g>';
  }

  // Renderar wireframe-SVG vid given upplösning och returnerar en komplett SVG-sträng.
  function _bygglSvgDokument(innerSvg, vW, vH, bg) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + vW + '" height="' + vH +
           '" viewBox="0 0 ' + vW + ' ' + vH + '">' +
           '<rect width="' + vW + '" height="' + vH + '" fill="' + bg + '"/>' +
           innerSvg + '</svg>';
  }

  function _svgTillDataUrl(svgString) {
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
  }

  function _rasteriseraSvg(svgDataUrl, w, h) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = svgDataUrl;
    });
  }

  // Dilaterar (förstorar) en svartvit mask-PNG genom att rita den flera gånger med offset.
  function _dilateraMask(maskDataUrl, radius) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var w = img.width, h = img.height;
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        for (var dx = -radius; dx <= radius; dx += 2) {
          for (var dy = -radius; dy <= radius; dy += 2) {
            ctx.drawImage(img, dx, dy);
          }
        }
        // Tröskla allt icke-svart till vitt
        var data = ctx.getImageData(0, 0, w, h);
        for (var i = 0; i < data.data.length; i += 4) {
          var v = data.data[i] > 32 ? 255 : 0;
          data.data[i] = data.data[i+1] = data.data[i+2] = v;
          data.data[i+3] = 255;
        }
        ctx.putImageData(data, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = maskDataUrl;
    });
  }

  // Skapa canny + mask vid tomtbildens fulla upplösning från given kameraTransform.
  async function genereraCannyOchMask(tomtBildDataUrl, design, berakning, transform) {
    // Hämta naturalbildens upplösning
    var natural = await new Promise(function (resolve) {
      var im = new Image();
      im.onload = function () { resolve({ w: im.naturalWidth, h: im.naturalHeight }); };
      im.src = tomtBildDataUrl;
    });
    var W = natural.w, H = natural.h;

    var b = berakning.b || design.b || 3;
    var l = berakning.l || design.l || 3;
    var h = berakning.h || design.h || 2.2;

    // Skala om transformens offset från display-pixel till natural-pixel
    // (offset registrerades på display-canvas, måste skalas till bildens upplösning)
    var displayScale = transform._displayScale || 1;
    var scaledTransform = {
      rotAz: transform.rotAz,
      rotEl: transform.rotEl,
      roll: transform.roll || 0,
      zoom: transform.zoom * (displayScale || 1),
      offsetX: transform.offsetX * (displayScale || 1),
      offsetY: transform.offsetY * (displayScale || 1)
    };

    var ctxCanny = Render3D.skapaKontext(b, l, h,
      scaledTransform.rotAz, scaledTransform.rotEl, scaledTransform.zoom,
      W, H, scaledTransform.offsetX, scaledTransform.offsetY);

    // Control-bild = ren wireframe (vita streck på svart). Canny-controlnet är
    // tränad på *kantkartor*, inte solida ytor — vi höll på att bryta formatet
    // i förra iterationen genom att fylla silhuetten. Strecken får istället
    // göras tjockare i bygg3d.js för att signalen ska bli stark nog.
    var wireInner = byggModellWireframe(ByggGenerator.delar(design, berakning), ctxCanny);
    var origCanny = ctxCanny.proj(b / 2, l / 2, h / 2);
    wireInner = _wrapRoll(wireInner, transform.roll || 0, origCanny[0], origCanny[1]);
    // Tvinga upp stroke-width överallt i wireframen så canny-signalen blir
    // tydlig efter rasterisering. Render3D.poly skriver ut värden 0.3–1.5 som
    // är tunna nog att försvinna på 1024px-bredd.
    wireInner = wireInner.replace(/stroke-width="[\d.]+"/g, 'stroke-width="3"');
    var cannySvg = _bygglSvgDokument(wireInner, W, H, '#000');
    var cannyDataUrl = await _rasteriseraSvg(_svgTillDataUrl(cannySvg), W, H);

    // Silhuett = fyllda polygoner, används bara för att bygga inpaint-masken.
    var ctxSil = Render3D.skapaKontext(b, l, h,
      scaledTransform.rotAz, scaledTransform.rotEl, scaledTransform.zoom,
      W, H, scaledTransform.offsetX, scaledTransform.offsetY);
    var silInner = byggModellSilhouette(ByggGenerator.delar(design, berakning), ctxSil);
    var origSil = ctxSil.proj(b / 2, l / 2, h / 2);
    silInner = _wrapRoll(silInner, transform.roll || 0, origSil[0], origSil[1]);
    var silSvg = _bygglSvgDokument(silInner, W, H, '#000');
    var maskRaw = await _rasteriseraSvg(_svgTillDataUrl(silSvg), W, H);
    var maskDataUrl = await _dilateraMask(maskRaw, 15);

    return { cadCannyDataUrl: cannyDataUrl, maskDataUrl: maskDataUrl };
  }

  function renderPerspektivEditor(container, tomtBildDataUrl, design, berakning, onGenerate, onAvbryt, initialTransform) {
    container.innerHTML = '';

    var instr = document.createElement('p');
    instr.className = 'pe-instruktion';
    instr.textContent = 'Placera bygget på din tomt — så förstår AI:n var det ska stå.';
    container.appendChild(instr);

    var wrapper = document.createElement('div');
    wrapper.className = 'pe-wrapper';
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.maxWidth = '100%';

    var img = document.createElement('img');
    img.src = tomtBildDataUrl;
    img.draggable = false;
    img.style.display = 'block';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    wrapper.appendChild(img);

    var svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('class', 'pe-overlay');
    svgEl.style.position = 'absolute';
    svgEl.style.left = '0';
    svgEl.style.top = '0';
    svgEl.style.width = '100%';
    svgEl.style.height = '100%';
    svgEl.style.pointerEvents = 'none';
    wrapper.appendChild(svgEl);

    container.appendChild(wrapper);

    var kameraTransform = Object.assign({}, DEFAULT_KAMERA, initialTransform || {});

    // Diagnos-overlay (tillfälligt — visar realtime-info så vi kan felsöka utan devtools)
    var diagBox = document.createElement('div');
    diagBox.className = 'pe-diag';
    diagBox.style.cssText = 'position:absolute;top:6px;left:6px;background:rgba(0,0,0,0.7);color:#9fffb0;font:11px monospace;padding:4px 6px;border-radius:4px;pointer-events:none;white-space:pre;z-index:5;';
    wrapper.appendChild(diagBox);

    function uppdateraOverlay() {
      // Robust storleksberäkning: prefer wrapper-bredd → img-bredd → naturalWidth
      var wrapperW = wrapper.clientWidth || 0;
      var vW = img.clientWidth || wrapperW || img.naturalWidth || 800;
      var vH;
      if (img.clientHeight) {
        vH = img.clientHeight;
      } else if (img.naturalWidth && vW) {
        vH = Math.round(vW * (img.naturalHeight / img.naturalWidth));
      } else {
        vH = 600;
      }
      svgEl.setAttribute('viewBox', '0 0 ' + vW + ' ' + vH);
      svgEl.setAttribute('width', vW);
      svgEl.setAttribute('height', vH);
      var svgInner = '';
      var polyCount = 0;
      try {
        svgInner = _renderWireframeSvg(design, berakning, kameraTransform, vW, vH);
        polyCount = (svgInner.match(/<polygon/g) || []).length;
      } catch (e) {
        diagBox.textContent = 'FEL: ' + e.message;
      }
      svgEl.innerHTML = svgInner;
      var b = (berakning && berakning.b) || (design && design.sektioner && design.sektioner[0] && design.sektioner[0].b) || '?';
      var l = (berakning && berakning.l) || (design && design.sektioner && design.sektioner[0] && design.sektioner[0].l) || '?';
      diagBox.textContent =
        'svg: ' + vW + '×' + vH + ' | polys: ' + polyCount +
        '\nb=' + b + ' l=' + l +
        '\nrotZ=' + Math.round((kameraTransform.rotAz||0)*180/Math.PI) +
        '° rotX=' + Math.round((kameraTransform.rotEl||0)*180/Math.PI) +
        '° rotY=' + Math.round((kameraTransform.roll||0)*180/Math.PI) +
        '° zoom=' + (kameraTransform.zoom||1).toFixed(2);
    }

    img.onload = function () { requestAnimationFrame(uppdateraOverlay); };
    if (img.complete && img.naturalWidth) requestAnimationFrame(uppdateraOverlay);
    window.addEventListener('resize', uppdateraOverlay);

    // ResizeObserver för att fånga layout-flyttar (oppnaRitvy etc.)
    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function () { uppdateraOverlay(); });
      ro.observe(wrapper);
    }

    // ---- Fas 3: interaktion ----
    var kontrollPanel = document.createElement('div');
    kontrollPanel.className = 'pe-kontroller';

    function makeSlider(label, color, min, max, step, value, onInput) {
      var w = document.createElement('label');
      w.className = 'pe-slider';
      var lab = document.createElement('span');
      lab.innerHTML = (color ? '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + color + ';margin-right:6px;vertical-align:middle"></span>' : '') + label;
      var s = document.createElement('input');
      s.type = 'range';
      s.min = min; s.max = max; s.step = step; s.value = value;
      if (color) s.style.accentColor = color;
      s.addEventListener('input', function () { onInput(parseFloat(s.value)); });
      w.appendChild(lab);
      w.appendChild(s);
      return w;
    }

    // X-axel = pitch (rotEl), Y-axel = roll (SVG-wrap), Z-axel = yaw (rotAz)
    kontrollPanel.appendChild(makeSlider('Rotation X', '#ff3838', -90, 90, 1, -20, function (v) {
      kameraTransform.rotEl = (v * Math.PI / 180);
      uppdateraOverlay();
    }));
    kontrollPanel.appendChild(makeSlider('Rotation Y', '#38ff5c', -180, 180, 1, 0, function (v) {
      kameraTransform.roll = (v * Math.PI / 180);
      uppdateraOverlay();
    }));
    kontrollPanel.appendChild(makeSlider('Rotation Z', '#3890ff', 0, 360, 1, 315, function (v) {
      kameraTransform.rotAz = (v * Math.PI / 180);
      uppdateraOverlay();
    }));
    kontrollPanel.appendChild(makeSlider('Skala', null, 0.2, 6, 0.05, 1, function (v) {
      kameraTransform.zoom = v;
      uppdateraOverlay();
    }));
    container.appendChild(kontrollPanel);

    // Drag-flytta wireframen
    svgEl.style.pointerEvents = 'auto';
    svgEl.style.cursor = 'move';
    var dragging = false;
    var dragStart = null;
    var transformStart = null;

    function onDown(e) {
      e.preventDefault();
      dragging = true;
      var pt = e.touches ? e.touches[0] : e;
      dragStart = { x: pt.clientX, y: pt.clientY };
      transformStart = { offsetX: kameraTransform.offsetX, offsetY: kameraTransform.offsetY };
    }
    function onMove(e) {
      if (!dragging) return;
      e.preventDefault();
      var pt = e.touches ? e.touches[0] : e;
      kameraTransform.offsetX = transformStart.offsetX + (pt.clientX - dragStart.x);
      kameraTransform.offsetY = transformStart.offsetY + (pt.clientY - dragStart.y);
      uppdateraOverlay();
    }
    function onUp() { dragging = false; }

    svgEl.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    svgEl.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);

    var knappar = document.createElement('div');
    knappar.className = 'pe-knappar';

    var btnTillbaka = document.createElement('button');
    btnTillbaka.className = 'ai-knapp ai-knapp-sekundar';
    btnTillbaka.textContent = '← Tillbaka';
    function cleanup() {
      window.removeEventListener('resize', uppdateraOverlay);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    }

    btnTillbaka.onclick = function () {
      cleanup();
      if (onAvbryt) onAvbryt();
    };
    knappar.appendChild(btnTillbaka);

    var btnGenerera = document.createElement('button');
    btnGenerera.className = 'ai-knapp ai-knapp-primar';
    btnGenerera.textContent = 'Generera →';
    btnGenerera.onclick = async function () {
      btnGenerera.disabled = true;
      btnGenerera.textContent = 'Förbereder…';
      // Skala från display-pixel till natural-pixel så att samma vy kan
      // återskapas vid bildens fulla upplösning.
      var displayW = img.clientWidth || img.naturalWidth;
      var naturalW = img.naturalWidth || displayW;
      kameraTransform._displayScale = naturalW / displayW;
      var assets = await genereraCannyOchMask(tomtBildDataUrl, design, berakning, kameraTransform);
      cleanup();
      if (onGenerate) onGenerate({
        kameraTransform: kameraTransform,
        cadCannyDataUrl: assets.cadCannyDataUrl,
        maskDataUrl: assets.maskDataUrl
      });
    };
    knappar.appendChild(btnGenerera);

    container.appendChild(knappar);

    return {
      getTransform: function () { return kameraTransform; },
      uppdateraOverlay: uppdateraOverlay
    };
  }

  // ---- Renderingsfunktioner -------------------------------------------------

  function renderLaddning(container) {
    container.innerHTML = '';

    var wrapper = document.createElement('div');
    wrapper.className = 'ai-shimmer';

    var text = document.createElement('div');
    text.className = 'ai-shimmer-text';
    text.innerHTML = '<div class="ai-shimmer-spinner"></div> AI skapar din visualisering\u2026';

    wrapper.appendChild(text);
    container.appendChild(wrapper);
  }

  function renderBild(container, url, options) {
    container.innerHTML = '';

    var img = document.createElement('img');
    img.src = url;
    img.alt = 'AI-genererad visualisering';

    if (options && options.maskSkalad) {
      var varning = document.createElement('p');
      varning.className = 'ai-mask-varning';
      varning.textContent = '⚠️ Masken skalades automatiskt efter dina nya mått — rita om om resultatet ser fel ut.';
      container.appendChild(varning);
    }

    var knappar = document.createElement('div');
    knappar.className = 'ai-kontroller-knappar';

    var btnRegenerate = document.createElement('button');
    btnRegenerate.className = 'ai-knapp ai-knapp-primar';
    btnRegenerate.textContent = 'Generera igen';
    btnRegenerate.onclick = function() { if (typeof startaAIGenerering === 'function') startaAIGenerering(); };

    knappar.appendChild(btnRegenerate);

    container.appendChild(img);
    container.appendChild(knappar);
  }

  function renderFel(container, msg) {
    container.innerHTML = '';

    var wrapper = document.createElement('div');
    wrapper.className = 'ai-limit-natt';
    wrapper.style.background = '#fff0f0';
    wrapper.style.borderColor = '#e0b0b0';

    var text = document.createElement('p');
    text.style.cssText = 'color:#a33;margin:0 0 12px;';
    text.textContent = msg || 'Något gick fel.';

    var btn = document.createElement('button');
    btn.className = 'ai-knapp ai-knapp-primar';
    btn.textContent = 'Försök igen';
    btn.onclick = function() { if (typeof startaPerspektivFlow === 'function') startaPerspektivFlow(); };

    wrapper.appendChild(text);
    wrapper.appendChild(btn);
    container.appendChild(wrapper);
  }

  function renderSektion() {
    var sektion = document.getElementById('pv-ai-sektion');
    if (!sektion) return;

    var container = document.getElementById('ai-bild-container');
    var kontroller = document.getElementById('ai-kontroller');

    if (!kontrolleraKostnad()) {
      container.innerHTML = '<div class="ai-limit-natt">Du har använt alla ' + _config.maxPerDag + ' genereringar för idag. Prova igen imorgon!</div>';
    } else {
      container.innerHTML = '<div class="ai-placeholder"><span class="ai-placeholder-ikon">\u2728</span><p>Redo att generera</p></div>';
    }

    kontroller.innerHTML = '<p class="ai-kostnad-info">' + _config.todayCount + ' av ' + _config.maxPerDag + ' genereringar idag</p>';
  }

  // ---- Bildanalys (vision) — föreslår dim + kameraTransform ------------------
  // Anropar proxyserverns /api/analysera-bild som i sin tur kör vision-modell.
  // Returnerar { b, l, h, kameraTransform } eller kastar exception vid fel.
  async function analysera(userImageBase64, projektTyp) {
    if (!userImageBase64) throw new Error('Ingen bild att analysera.');

    var resizedImage = await _resizeFit(userImageBase64, 1024);

    var res = await fetch(_config.proxyUrl + '/api/analysera-bild', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: resizedImage, projektTyp: projektTyp }),
    });

    if (!res.ok) {
      throw new Error('Bildanalys-server svarade ' + res.status);
    }

    var data = await res.json();
    if (typeof data.b !== 'number' || typeof data.l !== 'number' || typeof data.h !== 'number') {
      throw new Error('Bildanalys returnerade ogiltigt svar.');
    }
    return data;
  }

  // ---- Exponera publikt API -------------------------------------------------

  return {
    _config: _config,
    init: init,
    kontrolleraKostnad: kontrolleraKostnad,
    byggPrompt: byggPrompt,
    generera: generera,
    analysera: analysera,
    nollstallSeed: nollstallSeed,
    renderPerspektivEditor: renderPerspektivEditor,
    genereraCannyOchMask: genereraCannyOchMask,
    renderLaddning: renderLaddning,
    renderBild: renderBild,
    renderFel: renderFel,
    renderSektion: renderSektion,
  };

})();
