/**
 * AI-Visualisering — inpainting via Stable Diffusion SDXL (Replicate)
 * med canvas-baserad mask-editor.
 */
var AIVisualisering = (function () {

  // ---- Intern konfiguration ------------------------------------------------

  var _config = {
    proxyUrl: 'http://localhost:3001',
    maxPerDag: Infinity,
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
    brushSlider.style.accentColor = '#1c5d3a';
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
    // Wrappa i tydlig cyan stroke så den syns mot både ljusa och mörka tomtbilder
    return '<g stroke="#00e5ff" stroke-width="2.5" fill="none">' + inner + '</g>';
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
    // Filtrera bort delar som inte ska finnas i varken canny eller mask:
    // - 'wall' = huset bakom altanen, ska inte maskas
    // - 'regel' = bjälklag dolt under trall + kantbräder, syns inte utifrån
    var visibleDelar = ByggGenerator.delar(design, berakning).filter(function (d) {
      return d.typ !== 'wall' && d.typ !== 'regel';
    });
    var wireInner = byggModellWireframeVisible(visibleDelar, ctxCanny);
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
    var silInner = byggModellSilhouette(visibleDelar, ctxSil);
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

    var imgWrap = document.createElement('div');
    imgWrap.className = 'pe-img-wrap';

    var img = document.createElement('img');
    img.src = tomtBildDataUrl;
    img.draggable = false;
    imgWrap.appendChild(img);

    var svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('class', 'pe-overlay');
    imgWrap.appendChild(svgEl);
    wrapper.appendChild(imgWrap);

    container.appendChild(wrapper);

    var hint = document.createElement('p');
    hint.className = 'pe-hint';
    hint.textContent = 'Dra på bygget för att flytta · dra på bilden för att rotera';
    container.appendChild(hint);

    var kameraTransform = Object.assign({}, DEFAULT_KAMERA, initialTransform || {});
    kameraTransform.roll = 0;

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
      try {
        svgEl.innerHTML = _renderWireframeSvg(design, berakning, kameraTransform, vW, vH);
      } catch (e) {
        svgEl.innerHTML = '';
      }
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

    // Förenklad UI: direkt-drag på bilden (som Blender/SketchUp).
    // Drag på wireframe = flytta. Drag på bakgrund = rotera (horisontellt=vrid obegränsat, vertikalt=luta clampat).
    kameraTransform.roll = 0;

    kontrollPanel.appendChild(makeSlider('Skala', null, 0.2, 6, 0.05, kameraTransform.zoom || 1, function (v) {
      kameraTransform.zoom = v;
      uppdateraOverlay();
    }));
    container.appendChild(kontrollPanel);

    // Hit-test + drag
    wrapper.style.cursor = 'grab';
    svgEl.style.pointerEvents = 'none';
    var dragMode = null; // 'move' | 'rotate'
    var dragStart = null;
    var transformStart = null;

    function hitWireframe(clientX, clientY) {
      var g = svgEl.querySelector('g');
      if (!g) return false;
      try {
        var bb = g.getBBox();
        var rect = svgEl.getBoundingClientRect();
        var vb = svgEl.viewBox.baseVal;
        var sx = rect.width / (vb.width || rect.width);
        var sy = rect.height / (vb.height || rect.height);
        var x = (clientX - rect.left) / sx;
        var y = (clientY - rect.top) / sy;
        var pad = 8;
        return x >= bb.x - pad && x <= bb.x + bb.width + pad &&
               y >= bb.y - pad && y <= bb.y + bb.height + pad;
      } catch (e) { return false; }
    }

    function onDown(e) {
      e.preventDefault();
      var pt = e.touches ? e.touches[0] : e;
      dragStart = { x: pt.clientX, y: pt.clientY };
      if (hitWireframe(pt.clientX, pt.clientY)) {
        dragMode = 'move';
        transformStart = { offsetX: kameraTransform.offsetX, offsetY: kameraTransform.offsetY };
        wrapper.style.cursor = 'grabbing';
      } else {
        dragMode = 'rotate';
        transformStart = { rotAz: kameraTransform.rotAz, rotEl: kameraTransform.rotEl };
        wrapper.style.cursor = 'grabbing';
      }
    }
    function onMove(e) {
      if (!dragMode) return;
      e.preventDefault();
      var pt = e.touches ? e.touches[0] : e;
      var dx = pt.clientX - dragStart.x;
      var dy = pt.clientY - dragStart.y;
      if (dragMode === 'move') {
        kameraTransform.offsetX = transformStart.offsetX + dx;
        kameraTransform.offsetY = transformStart.offsetY + dy;
      } else {
        kameraTransform.rotAz = transformStart.rotAz + dx * 0.5 * Math.PI / 180;
        var nyEl = transformStart.rotEl + dy * 0.5 * Math.PI / 180;
        var minEl = -80 * Math.PI / 180, maxEl = 5 * Math.PI / 180;
        kameraTransform.rotEl = Math.max(minEl, Math.min(maxEl, nyEl));
      }
      uppdateraOverlay();
    }
    function onUp() { dragMode = null; wrapper.style.cursor = 'grab'; }

    wrapper.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    wrapper.addEventListener('touchstart', onDown, { passive: false });
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

  // ============================================================
  // Three.js offscreen composite — riktig 3D-rendering på tomtbild
  // ============================================================
  // Använder befintliga byggModellGL-faces (verts i meter, z-up) och bygger
  // en separat Three.js-scen med OrthographicCamera som matchar
  // Render3D.skapaKontext-mattet, plus DirectionalLight + skuggmottagar-plan.
  // Resultatet komposieras över tomtbilden i en canvas.

  function _loadImg(src) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      // CORS: behövs för att kunna köra getImageData/toDataURL på externa
      // bilder (t.ex. replicate.delivery) utan att canvasen blir tainted.
      // Data-URIs bryr sig inte om attributet.
      im.crossOrigin = 'anonymous';
      im.onload = function () { resolve(im); };
      im.onerror = reject;
      im.src = src;
    });
  }

  function _hexToColor(hex) {
    if (!hex || hex[0] !== '#') return new THREE.Color(0xcccccc);
    return new THREE.Color(hex);
  }

  // Procedural trä-textur — horisontella ådringar + glesa kvistar.
  // Genererar både color map och normal map (härledd från color luminance).
  var _traTexturCache = null;
  function _skapaTraTextur() {
    if (_traTexturCache) return _traTexturCache;
    var size = 512;
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var cx = c.getContext('2d');
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, size, size);
    for (var y = 0; y < size; y += 1) {
      var alpha = (Math.sin(y * 0.07) + 1) * 0.5 * 0.18 + 0.04;
      cx.fillStyle = 'rgba(40,28,18,' + alpha + ')';
      cx.fillRect(0, y, size, 1);
      if (Math.random() < 0.025) {
        cx.fillStyle = 'rgba(30,20,10,0.35)';
        cx.fillRect(0, y, size, 1 + Math.floor(Math.random() * 2));
      }
    }
    for (var k = 0; k < 4; k++) {
      var kx = Math.random() * size;
      var ky = Math.random() * size;
      var kr = 4 + Math.random() * 8;
      var grad = cx.createRadialGradient(kx, ky, 0, kx, ky, kr);
      grad.addColorStop(0, 'rgba(30,18,8,0.8)');
      grad.addColorStop(1, 'rgba(30,18,8,0)');
      cx.fillStyle = grad;
      cx.beginPath(); cx.arc(kx, ky, kr, 0, Math.PI*2); cx.fill();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;

    // Härled normal map ur color-luminance via Sobel.
    var imgData = cx.getImageData(0, 0, size, size).data;
    function lum(x, y) {
      x = (x + size) % size; y = (y + size) % size;
      var i = (y * size + x) * 4;
      return (imgData[i] + imgData[i+1] + imgData[i+2]) / (3 * 255);
    }
    var nc = document.createElement('canvas');
    nc.width = size; nc.height = size;
    var ncx = nc.getContext('2d');
    var nData = ncx.createImageData(size, size);
    var strength = 2.0;
    for (var yy = 0; yy < size; yy++) {
      for (var xx = 0; xx < size; xx++) {
        var dx = (lum(xx+1,yy) - lum(xx-1,yy)) * strength;
        var dy = (lum(xx,yy+1) - lum(xx,yy-1)) * strength;
        var nzv = 1.0;
        var len = Math.sqrt(dx*dx + dy*dy + nzv*nzv);
        var ii = (yy * size + xx) * 4;
        nData.data[ii]   = Math.round((-dx/len * 0.5 + 0.5) * 255);
        nData.data[ii+1] = Math.round(( dy/len * 0.5 + 0.5) * 255);
        nData.data[ii+2] = Math.round(( nzv/len * 0.5 + 0.5) * 255);
        nData.data[ii+3] = 255;
      }
    }
    ncx.putImageData(nData, 0, 0);
    var nrm = new THREE.CanvasTexture(nc);
    nrm.wrapS = THREE.RepeatWrapping;
    nrm.wrapT = THREE.RepeatWrapping;
    nrm.anisotropy = 4;

    _traTexturCache = { map: tex, normalMap: nrm };
    return _traTexturCache;
  }

  // Beräknar planar UVs för en quad/face baserat på dess normal.
  // Resultat: Float32Array med 2 floats per vert.
  function _berakneUV(verts) {
    if (verts.length < 3) return null;
    var v0 = verts[0], v1 = verts[1], v2 = verts[verts.length - 1];
    var e1x = v1[0]-v0[0], e1y = v1[1]-v0[1], e1z = v1[2]-v0[2];
    var e2x = v2[0]-v0[0], e2y = v2[1]-v0[1], e2z = v2[2]-v0[2];
    var nx = Math.abs(e1y*e2z - e1z*e2y);
    var ny = Math.abs(e1z*e2x - e1x*e2z);
    var nz = Math.abs(e1x*e2y - e1y*e2x);
    var ax, ay; // index för world-axlar att använda som UV
    if (nz >= nx && nz >= ny) { ax = 0; ay = 1; }       // toppyta → x,y
    else if (nx >= ny)         { ax = 1; ay = 2; }       // sida i x → y,z
    else                       { ax = 0; ay = 2; }       // sida i y → x,z
    var scale = 2.0; // 1 textil-tile = 0.5 m → wood grain på rätt skala
    var uvs = new Float32Array(verts.length * 2);
    for (var i = 0; i < verts.length; i++) {
      uvs[i*2]   = verts[i][ax] * scale;
      uvs[i*2+1] = verts[i][ay] * scale;
    }
    return uvs;
  }

  function _skapaLjusFranHaiku(scene, target, ljus, cosAz, sinAz, ambientTint) {
    // Lägre intensitet eftersom scene.environment (PMREM) bidrar med eget ambient.
    var ambColor = ambientTint || 0xeae0d0;
    var amb = new THREE.AmbientLight(ambColor, 0.35);
    scene.add(amb);
    // Hemisphere-ljus från himlen+marken — fyller in skuggsidan med naturlig
    // färgton istället för platt grå.
    var hemi = new THREE.HemisphereLight(0xc9dcf0, ambColor, 0.45);
    hemi.position.set(target.x, target.y, 20);
    scene.add(hemi);

    // Höjd på ljus från ljustyp
    var typ = (ljus && ljus.typ) || 'soft afternoon';
    var elev = 8;
    if (typ === 'midday') elev = 14;
    else if (typ === 'golden hour') elev = 4;

    // Ljusriktning från skuggriktning (skugga faller bort från ljus)
    // Kamerans right-vector i världen (bygg-koord, z-up): (cosAz, -sinAz, 0)
    var rightX = cosAz, rightY = -sinAz;
    var ofs = { x: 0, y: 0 };
    var s = (ljus && ljus.skuggriktning) || 'vänster';
    if (s === 'vänster') { ofs.x = rightX * 10; ofs.y = rightY * 10; }
    else if (s === 'höger') { ofs.x = -rightX * 10; ofs.y = -rightY * 10; }
    else if (s === 'framifrån') { ofs.x = sinAz * 10; ofs.y = cosAz * 10; }
    else if (s === 'bakifrån') { ofs.x = -sinAz * 10; ofs.y = -cosAz * 10; }

    // Solfärg från ljustyp
    var sunColor = 0xfff4dc;
    var sunIntensity = 1.05;
    if (typ === 'golden hour') { sunColor = 0xffb066; sunIntensity = 1.15; }
    else if (typ === 'midday') { sunColor = 0xffffff; sunIntensity = 1.25; }
    else if (typ === 'overcast') { sunColor = 0xc8d0d8; sunIntensity = 0.55; }
    else if (typ === 'soft afternoon') { sunColor = 0xffe6c0; sunIntensity = 1.0; }
    var dir = new THREE.DirectionalLight(sunColor, sunIntensity);
    dir.position.set(target.x + ofs.x, target.y + ofs.y, elev);
    dir.target.position.copy(target);
    scene.add(dir);
    scene.add(dir.target);

    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    var shadowSize = 15;
    dir.shadow.camera.left = -shadowSize;
    dir.shadow.camera.right = shadowSize;
    dir.shadow.camera.top = shadowSize;
    dir.shadow.camera.bottom = -shadowSize;
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 60;
    dir.shadow.bias = -0.0005;
    dir.shadow.radius = 8;        // PCF blur radius — mjukare kanter
    dir.shadow.blurSamples = 16;
  }

  function _bygg3DScenen(design, berakning, transform, ljus, W, H) {
    var b = berakning.b || design.b || 3;
    var l = berakning.l || design.l || 3;
    var h = berakning.h || design.h || 2.2;

    var displayScale = transform._displayScale || 1;
    var rotAz = transform.rotAz, rotEl = transform.rotEl;
    var zoom = transform.zoom * displayScale;
    var px = transform.offsetX * displayScale;
    var py = transform.offsetY * displayScale;

    var ctx = Render3D.skapaKontext(b, l, h, rotAz, rotEl, zoom, W, H, px, py);
    var s = ctx.s;
    var cosAz = ctx.cosAz, sinAz = ctx.sinAz;
    var cosEl = ctx.cosEl, sinEl = ctx.sinEl;

    // Hämta delar — släpp wall (huset bakom altanen)
    var visibleDelar = ByggGenerator.delar(design, berakning).filter(function (d) {
      return d.typ !== 'wall';
    });

    var palette = (typeof PALETTER !== 'undefined' && PALETTER.realistisk) ? PALETTER.realistisk : null;
    if (!palette) throw new Error('PALETTER.realistisk saknas');

    var modell = byggModellGL(visibleDelar, ctx, palette, 'realistisk');

    // ---- Three.js scen ----
    var scene = new THREE.Scene();

    // Bygg meshes från faces
    var meshGroup = new THREE.Group();
    var traPaket = _skapaTraTextur();
    for (var i = 0; i < modell.faces.length; i++) {
      var face = modell.faces[i];
      if (!face.verts || face.verts.length < 3) continue;
      var geom = new THREE.BufferGeometry();
      var n = face.verts.length;
      var positions = new Float32Array(n * 3);
      for (var k = 0; k < n; k++) {
        positions[k*3]   = face.verts[k][0];
        positions[k*3+1] = face.verts[k][1];
        positions[k*3+2] = face.verts[k][2];
      }
      // Triangulera (fan)
      var indices = [];
      for (var t = 1; t < n - 1; t++) {
        indices.push(0, t, t+1);
      }
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      var uv = _berakneUV(face.verts);
      if (uv) {
        // Per-face UV-offset så att intilliggande plankor inte ser klonade ut.
        // Pseudo-random från face-index ger deterministisk variation.
        var ru = ((i * 37) % 100) / 100;
        var rv = ((i * 71) % 100) / 100;
        for (var ui = 0; ui < uv.length; ui += 2) { uv[ui] += ru; uv[ui+1] += rv; }
        geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      }
      geom.setIndex(indices);
      geom.computeVertexNormals();

      var mat = new THREE.MeshStandardMaterial({
        color: _hexToColor(face.fill),
        map: traPaket.map,
        normalMap: traPaket.normalMap,
        normalScale: new THREE.Vector2(0.6, 0.6),
        roughness: 0.82,
        metalness: 0.0,
        envMapIntensity: 0.9,
        side: THREE.DoubleSide
      });
      var mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false; // Vår custom projection matrix gör Three.js's frustum-extraktion meningslös
      meshGroup.add(mesh);
    }
    scene.add(meshGroup);

    // Skuggmottagar-plan vid z=0 — osynligt, men tar emot DirectionalLight-skugga.
    // Större för att fånga hela skuggprojektionen i låg solvinkel (golden hour).
    var groundGeom = new THREE.PlaneGeometry(80, 80);
    var groundMat = new THREE.ShadowMaterial({ opacity: 0.45 });
    var ground = new THREE.Mesh(groundGeom, groundMat);
    ground.position.set(b/2, l/2, 0);
    ground.receiveShadow = true;
    ground.frustumCulled = false;
    scene.add(ground);

    // Kontakt-skugga: en mörk mjuk ellips direkt under altanen som
    // förankrar den mot marken även vid mycket mjukt diffust ljus där
    // riktningsljusets skugga blir för svag. Använder en RadialGradient-
    // textur så det blir mjuk falloff utan post-processing.
    var contactCanvas = document.createElement('canvas');
    contactCanvas.width = 256; contactCanvas.height = 256;
    var ccx = contactCanvas.getContext('2d');
    var grad = ccx.createRadialGradient(128, 128, 20, 128, 128, 128);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.22)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ccx.fillStyle = grad;
    ccx.fillRect(0, 0, 256, 256);
    var contactTex = new THREE.CanvasTexture(contactCanvas);
    var contactMat = new THREE.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      depthWrite: false
    });
    var contactGeom = new THREE.PlaneGeometry(b * 1.35, l * 1.45);
    var contact = new THREE.Mesh(contactGeom, contactMat);
    contact.position.set(b/2, l/2, 0.005); // strax ovanför mark för att slippa z-fight
    contact.frustumCulled = false;
    scene.add(contact);

    // Riktig view-matris (lookAt) + standard ortho-projektion. Den enda skillnaden
    // mot Render3D är att Three.js-kamerans screen-x-axel pekar åt motsatt håll
    // (handedness-flipp). Vi kompenserar genom att swappa left/right i ortho-frustumet.
    // Det ger korrekt z-buffer (matchar verklig kamera-distans) — vilket den tidigare
    // custom-matrisen inte gjorde och som orsakade fragmenterad rendering av trallen.
    //
    // Render3D-formeln (för referens):
    //   screen_x = W/2 + ((x-b/2)*cosAz - (y-l/2)*sinAz)*s + px
    //   screen_y = 0.45*H + py - (...)*s
    // s = pixels/meter, så frustumets bredd/höjd i världsmeter = W/s, H/s.
    var target = new THREE.Vector3(b/2, l/2, h/2);

    // View direction in i skärmen (från Render3D, samma härledning som tidigare)
    var viewDir = new THREE.Vector3(-sinAz*cosEl, -cosAz*cosEl, sinEl);
    var D = 100; // kameraavstånd; ortho bryr sig inte om värdet, bara > near
    var camPos = target.clone().sub(viewDir.clone().multiplyScalar(D));

    // Ortho-frustum i view-space-meter. Inkluderar px/py-offset och Render3D:s
    // y-center på 0.45*H (i stället för 0.5*H) direkt i top/bottom.
    //   y_view=0 ska projicera till ndc_y = 0.1 - 2*py/H
    //   x_view=0 ska projicera till ndc_x = 2*px/W
    var halfW = W/(2*s);
    var halfH = H/(2*s);
    // OBS: tecknet på px är + här (inte -). När vi sedan swappar left↔right för
    // x-mirrorn nedan, hamnar px-offset:en på rätt sida av spegelaxeln.
    var leftWorld   = -halfW + px/s;
    var rightWorld  =  halfW + px/s;
    var bottomWorld = -0.55*H/s + py/s;
    var topWorld    =  0.45*H/s + py/s;

    // X-mirror: swap left↔right för att kompensera Three.js handedness vs Render3D.
    var camera = new THREE.OrthographicCamera(
      rightWorld, leftWorld, topWorld, bottomWorld, 0.1, 1000
    );
    camera.up.set(0, 0, 1);
    camera.position.copy(camPos);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    _skapaLjusFranHaiku(scene, target, ljus, cosAz, sinAz, transform._ambientTint);

    return { scene: scene, camera: camera };
  }

  // Bygger en enkel himmelsgradient (zenit→horisont→mark) som equirect-textur
  // för PMREMGenerator. Ger MeshStandardMaterial realistisk omgivningsljus
  // utan att behöva ladda en HDRI-fil.
  function _skapaSkyEquirect(ambientTint) {
    var w = 512, h = 256;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var cx = c.getContext('2d');
    var grad = cx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#87b8e8');     // zenit
    grad.addColorStop(0.45, '#cfdbe6');  // horisont (ljust)
    grad.addColorStop(0.55, '#a89478');  // mark-horisont
    grad.addColorStop(1, '#6b5a44');     // mark
    cx.fillStyle = grad;
    cx.fillRect(0, 0, w, h);
    var tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Sampla en pixel från nedre delen av tomtbilden för att få markens
  // dominanta färg → används som ambient/hemisphere tint så altanens
  // skuggsida hamnar i samma färgton som omgivningen.
  // Sampla genomsnittlig luminans ur hela tomtbilden → används för
  // toneMappingExposure så altanen får liknande ljushet som omgivningen.
  async function _samplaExponering(tomtDataUrl) {
    try {
      var im = await _loadImg(tomtDataUrl);
      var c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      var cx = c.getContext('2d');
      cx.drawImage(im, 0, 0, 64, 64);
      var data = cx.getImageData(0, 0, 64, 64).data;
      var sum = 0, n = 0;
      for (var i = 0; i < data.length; i += 4) {
        var L = (0.2126*data[i] + 0.7152*data[i+1] + 0.0722*data[i+2]) / 255;
        sum += L; n++;
      }
      var avg = sum / n; // 0..1
      // Mappa: foto-luminans 0.5 = exposure 1.0; mörkare foto → lägre exposure
      return 0.55 + avg * 0.95; // typiskt 0.7–1.3
    } catch (e) {
      return 1.05;
    }
  }

  async function _samplaMarkfarg(tomtDataUrl) {
    try {
      var im = await _loadImg(tomtDataUrl);
      var c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      var cx = c.getContext('2d');
      // Bara nedre tredjedelen av bilden = mark
      cx.drawImage(im, 0, im.naturalHeight*0.66, im.naturalWidth, im.naturalHeight*0.34, 0, 0, 32, 32);
      var data = cx.getImageData(0, 0, 32, 32).data;
      var r=0,g=0,b=0,n=0;
      for (var i=0; i<data.length; i+=4) { r+=data[i]; g+=data[i+1]; b+=data[i+2]; n++; }
      r = Math.round(r/n); g = Math.round(g/n); b = Math.round(b/n);
      return new THREE.Color(r/255, g/255, b/255);
    } catch (e) {
      return new THREE.Color(0xeae0d0);
    }
  }

  function _renderaRealistisk3D(design, berakning, transform, ljus, W, H) {
    var built = _bygg3DScenen(design, berakning, transform, ljus, W, H);

    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = (transform && transform._exposure) || 1.05;
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    else renderer.outputEncoding = THREE.sRGBEncoding || renderer.outputEncoding;

    // Bygg PMREM från en procedural himmelsgradient → scene.environment.
    // Detta ger MeshStandardMaterial realistisk ambient och svaga reflektioner.
    var pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    var skyTex = _skapaSkyEquirect();
    var envRT = pmrem.fromEquirectangular(skyTex);
    built.scene.environment = envRT.texture;
    skyTex.dispose();
    pmrem.dispose();

    // SSAO via EffectComposer för mörkning i hörn där balkar/plankor möts.
    // Faller tillbaka på direkt renderer.render om postprocessing-scripts saknas.
    if (typeof THREE.EffectComposer !== 'undefined' && typeof THREE.SSAOPass !== 'undefined') {
      try {
        var composer = new THREE.EffectComposer(renderer);
        composer.setSize(W, H);
        composer.addPass(new THREE.RenderPass(built.scene, built.camera));
        var ssao = new THREE.SSAOPass(built.scene, built.camera, W, H);
        ssao.kernelRadius = 6;
        ssao.minDistance = 0.0008;
        ssao.maxDistance = 0.08;
        composer.addPass(ssao);
        composer.render();
      } catch (e) {
        console.warn('SSAO misslyckades, faller tillbaka:', e.message);
        renderer.render(built.scene, built.camera);
      }
    } else {
      renderer.render(built.scene, built.camera);
    }
    var dataUrl = canvas.toDataURL('image/png');

    // Cleanup
    built.scene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    renderer.dispose();

    return dataUrl;
  }

  // (borttaget block) — _bboxFranMask, _polerCropOchRefine, _byggPolishMask
  // användes av clarity-upscaler-pipen. IC-Light hanterar förgrund/bakgrund
  // internt via subject_image+background_image så inget klient-side crop+mask
  // behövs längre.
  /* UNUSED_BLOCK_START
  function _bboxFranMask(maskCanvas) {
    var W = maskCanvas.width, H = maskCanvas.height;
    var d = maskCanvas.getContext('2d').getImageData(0, 0, W, H).data;
    var minX = W, minY = H, maxX = -1, maxY = -1;
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        if (d[(y * W + x) * 4] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  // Crop + refine + paste. Beskär altan-området ur kompositen, skickar crop:en
  // till clarity-upscaler, och klistrar tillbaka resultatet genom mask-
  // blending så bakgrunden bevaras pixel-exakt.
  async function _polerCropOchRefine(kompositDataUrl, polishMaskCanvas, W, H) {
    var bbox = _bboxFranMask(polishMaskCanvas);
    if (!bbox) throw new Error('Ingen altan-mask hittades för crop');

    // Lägg på marginal så clarity-upscalern har lite omgivning att läsa av
    var pad = Math.round(Math.max(bbox.w, bbox.h) * 0.18);
    var cx0 = Math.max(0, bbox.x - pad);
    var cy0 = Math.max(0, bbox.y - pad);
    var cx1 = Math.min(W, bbox.x + bbox.w + pad);
    var cy1 = Math.min(H, bbox.y + bbox.h + pad);
    var cw = cx0 === cx1 ? 1 : cx1 - cx0;
    var ch = cy0 === cy1 ? 1 : cy1 - cy0;

    // Beskär kompositen
    var kompositImg = await _loadImg(kompositDataUrl);
    var cropCanvas = document.createElement('canvas');
    cropCanvas.width = cw; cropCanvas.height = ch;
    cropCanvas.getContext('2d').drawImage(kompositImg, cx0, cy0, cw, ch, 0, 0, cw, ch);
    var cropDataUrl = cropCanvas.toDataURL('image/jpeg', 0.92);

    console.log('[polera] crop bbox:', cx0, cy0, cw, ch, '→ skickar till clarity-upscaler…');
    var tPol0 = Date.now();
    var polRes = await fetch(_config.proxyUrl + '/api/polera', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: cropDataUrl })
    });
    if (!polRes.ok) throw new Error('Polera HTTP ' + polRes.status);
    var polData = await polRes.json();
    if (!polData.url) throw new Error('Polera: inget url-svar');
    console.log('[polera] klart på', Date.now() - tPol0, 'ms');

    // Ladda AI-resultatet och rita tillbaka in i en full-size canvas
    var aiImg = await _loadImg(polData.url);
    var final = document.createElement('canvas');
    final.width = W; final.height = H;
    var fx = final.getContext('2d');
    fx.drawImage(kompositImg, 0, 0, W, H);

    // Bygg AI-lagret: svart canvas + AI på bbox-koordinater
    var aiLayer = document.createElement('canvas');
    aiLayer.width = W; aiLayer.height = H;
    var ax = aiLayer.getContext('2d');
    ax.drawImage(aiImg, 0, 0, aiImg.naturalWidth, aiImg.naturalHeight, cx0, cy0, cw, ch);

    // Maska AI-lagret med polishMask (altan + mjuk kant) så bakgrunden i
    // crop-området inte skrivs över.
    ax.globalCompositeOperation = 'destination-in';
    ax.drawImage(polishMaskCanvas, 0, 0);

    // Lägg AI-lagret över originalet
    fx.drawImage(aiLayer, 0, 0);
    return final.toDataURL('image/jpeg', 0.95);
  }

  // Bygger en gråskalemask (0..1) från altan-PNG:ns alpha-kanal, dilaterad
  // med gaussisk blur så AI:n får en mjuk övergång runt altanen.
  async function _byggPolishMask(altanPngDataUrl, W, H) {
    var im = await _loadImg(altanPngDataUrl);
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var cx = c.getContext('2d');
    // Rita alpha som vit → bygger en binär silhuett
    cx.fillStyle = '#000000';
    cx.fillRect(0, 0, W, H);
    cx.globalCompositeOperation = 'source-over';
    // Steg 1: rita altanen med en solid vit fyllning (källans alpha styr)
    cx.drawImage(im, 0, 0, W, H);
    // Ersätt färg med vit där alpha > 0
    var data = cx.getImageData(0, 0, W, H);
    for (var i = 0; i < data.data.length; i += 4) {
      var a = data.data[i+3];
      var v = a > 8 ? 255 : 0;
      data.data[i] = v; data.data[i+1] = v; data.data[i+2] = v; data.data[i+3] = 255;
    }
    cx.putImageData(data, 0, 0);
    // Dilatera + mjuka kanter via canvas-blur
    var c2 = document.createElement('canvas');
    c2.width = W; c2.height = H;
    var cx2 = c2.getContext('2d');
    var blurPx = Math.round(Math.max(W, H) * 0.040); // ~4% → bred mjuk ring runt altanen
    cx2.filter = 'blur(' + blurPx + 'px)';
    cx2.drawImage(c, 0, 0);
    cx2.filter = 'none';
    // Bred falloff: inre platå full opacitet, yttre gradient långt ut så AI:n
    // får blenda altanens bas mot marken (kontaktskuggor, färgintegration).
    var md = cx2.getImageData(0, 0, W, H);
    for (var j = 0; j < md.data.length; j += 4) {
      var g = md.data[j];
      var m = g < 4 ? 0 : (g > 180 ? 255 : Math.round((g - 4) * 255 / (180 - 4)));
      md.data[j] = m; md.data[j+1] = m; md.data[j+2] = m; md.data[j+3] = 255;
    }
    cx2.putImageData(md, 0, 0);
    return c2;
  }
  UNUSED_BLOCK_END */

  async function _kompositeraOverTomt(tomtDataUrl, altanPngDataUrl, W, H, debugMarker) {
    var loaded = await Promise.all([_loadImg(tomtDataUrl), _loadImg(altanPngDataUrl)]);
    var tomt = loaded[0], altan = loaded[1];
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var cx = c.getContext('2d');
    cx.drawImage(tomt, 0, 0, W, H);
    cx.drawImage(altan, 0, 0, W, H);
    if (debugMarker) {
      // RÖD kross = där Render3D säger altan-centrum ska vara
      cx.strokeStyle = '#ff0000';
      cx.lineWidth = 4;
      cx.beginPath();
      cx.moveTo(debugMarker.x - 30, debugMarker.y);
      cx.lineTo(debugMarker.x + 30, debugMarker.y);
      cx.moveTo(debugMarker.x, debugMarker.y - 30);
      cx.lineTo(debugMarker.x, debugMarker.y + 30);
      cx.stroke();
    }
    return c.toDataURL('image/jpeg', 0.95);
  }

  async function genereraRealistisk3D(tomtBildDataUrl, design, berakning, transform, ljus) {
    if (!kontrolleraKostnad()) {
      return { ok: false, error: 'Dagsgränsen på ' + _config.maxPerDag + ' genereringar har uppnåtts.' };
    }
    _config.isGenerating = true;
    try {
      var natural = await new Promise(function (resolve) {
        var im = new Image();
        im.onload = function () { resolve({ w: im.naturalWidth, h: im.naturalHeight }); };
        im.src = tomtBildDataUrl;
      });
      var W = natural.w, H = natural.h;

      // Sampla markens dominanta färg ur tomtbilden så ambient/hemisphere
      // matchar omgivningen istället för platt grå.
      transform._ambientTint = await _samplaMarkfarg(tomtBildDataUrl);
      transform._exposure = await _samplaExponering(tomtBildDataUrl);

      console.log('[gen-input]', JSON.stringify({
        W: W, H: H,
        rotAz: transform.rotAz, rotEl: transform.rotEl,
        zoom: transform.zoom, offsetX: transform.offsetX, offsetY: transform.offsetY,
        _displayScale: transform._displayScale,
        b: berakning.b, l: berakning.l, h: berakning.h
      }));

      // DEBUG: bygg samma scen utanför render för att kunna projicera testpunkter
      var dbgBuilt = _bygg3DScenen(design, berakning, transform, ljus, W, H);
      dbgBuilt.scene.updateMatrixWorld(true);
      dbgBuilt.camera.updateMatrixWorld(true);
      dbgBuilt.camera.matrixWorldInverse.copy(dbgBuilt.camera.matrixWorld).invert();
      var dbgB = berakning.b || design.b || 3;
      var dbgL = berakning.l || design.l || 3;
      var dbgH = berakning.h || design.h || 2.2;
      var dbgPts = [
        ['center', dbgB/2, dbgL/2, dbgH/2],
        ['east+1', dbgB/2 + 1, dbgL/2, dbgH/2],
        ['north+1', dbgB/2, dbgL/2 + 1, dbgH/2],
        ['top+1', dbgB/2, dbgL/2, dbgH/2 + 1]
      ];
      var dbgCtxLog = Render3D.skapaKontext(dbgB, dbgL, dbgH,
        transform.rotAz, transform.rotEl, transform.zoom * (transform._displayScale || 1),
        W, H, transform.offsetX * (transform._displayScale || 1), transform.offsetY * (transform._displayScale || 1));
      for (var ip = 0; ip < dbgPts.length; ip++) {
        var p = dbgPts[ip];
        var v = new THREE.Vector3(p[1], p[2], p[3]);
        var rd = dbgCtxLog.proj(p[1], p[2], p[3]);
        v.project(dbgBuilt.camera); // → NDC
        var threePx = (v.x + 1) * W / 2;
        var threePy = (1 - v.y) * H / 2;
        console.log('[debug pt]', p[0],
          'render3d=(', rd[0].toFixed(0), rd[1].toFixed(0), ')',
          'threejs=(', threePx.toFixed(0), threePy.toFixed(0), ')');
      }

      var altanPng = _renderaRealistisk3D(design, berakning, transform, ljus, W, H);

      // DEBUG: rita en röd kross där Render3D säger altan-centrum ska vara,
      // för att verifiera om Three.js-mappingen matchar.
      var b = berakning.b || design.b || 3;
      var l = berakning.l || design.l || 3;
      var hh = berakning.h || design.h || 2.2;
      var ds = transform._displayScale || 1;
      var dbgCtx = Render3D.skapaKontext(b, l, hh,
        transform.rotAz, transform.rotEl, transform.zoom * ds,
        W, H, transform.offsetX * ds, transform.offsetY * ds);
      var dbgPt = dbgCtx.proj(b/2, l/2, hh/2);
      console.log('[debug] Render3D säger target hamnar vid pixel:', dbgPt, 'av (', W, H, ')');

      // Rå Three.js-komposit som fallback om IC-Light-anropet misslyckas.
      var komposit = await _kompositeraOverTomt(tomtBildDataUrl, altanPng, W, H, null);

      // Nedskala innan vi skickar till IC-Light — modellen jobbar internt
      // på ~768px och 3024×4032-bilder sprängar annars request-gränsen.
      var maxSide = 1024;
      var scale = Math.min(1, maxSide / Math.max(W, H));
      var sw = Math.round(W * scale);
      var sh = Math.round(H * scale);
      async function _nedskala(dataUrl, outW, outH, mime, q) {
        var im = await _loadImg(dataUrl);
        var c = document.createElement('canvas');
        c.width = outW; c.height = outH;
        c.getContext('2d').drawImage(im, 0, 0, outW, outH);
        return c.toDataURL(mime || 'image/jpeg', q || 0.9);
      }
      var altanSmall = await _nedskala(altanPng, sw, sh, 'image/png');
      var tomtSmall  = await _nedskala(tomtBildDataUrl, sw, sh, 'image/jpeg', 0.9);

      // AI-polish: IC-Light FBC (Foreground-Background-Conditioned). Skicka
      // altanPng (med alpha — IC-Light läser transparensen som förgrundsmask)
      // och tomtbilden som bakgrund. Modellen relightar altanen så ljus,
      // färgtemperatur och kontaktskuggor matchar scenen. Geometrin bevaras
      // eftersom subject_image-identiteten låses, bakgrunden bevaras eftersom
      // den ges som explicit input.
      var finalUrl = komposit;
      try {
        var tPol0 = Date.now();
        console.log('[polera] IC-Light: skickar förgrund + bakgrund…');
        var polRes = await fetch(_config.proxyUrl + '/api/polera', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject_image: altanSmall,
            background_image: tomtSmall,
            width: sw,
            height: sh
          })
        });
        if (polRes.ok) {
          var polData = await polRes.json();
          if (polData.url) {
            console.log('[polera] IC-Light klart på', Date.now() - tPol0, 'ms');
            finalUrl = polData.url;
          } else {
            console.warn('[polera] inget url-svar, behåller rå komposit');
          }
        } else {
          var errTxt = await polRes.text();
          console.warn('[polera] HTTP', polRes.status, errTxt, '— behåller rå komposit');
        }
      } catch (e) {
        console.warn('[polera] fetch-fel, behåller rå komposit:', e.message);
      }

      _config.todayCount++;
      localStorage.setItem(_todayKey(), String(_config.todayCount));
      return { ok: true, url: finalUrl };
    } catch (err) {
      console.error('genereraRealistisk3D error:', err);
      return { ok: false, error: err.message || 'Kunde inte rendera 3D-komposit.' };
    } finally {
      _config.isGenerating = false;
    }
  }

  // ---- Exponera publikt API -------------------------------------------------

  return {
    _config: _config,
    init: init,
    kontrolleraKostnad: kontrolleraKostnad,
    byggPrompt: byggPrompt,
    generera: generera,
    genereraRealistisk3D: genereraRealistisk3D,
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
