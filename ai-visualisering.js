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
    altan:    'a raised wooden deck patio attached to the house at door threshold height, supported by wooden posts on the ground, horizontal pressure-treated pine planks with visible wood grain and small gaps, wooden railing with vertical balusters, the deck fully covers the ground beneath it, natural wood color, Scandinavian garden, photorealistic',
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

  // Fast seed för konsekvent stil
  var _lastSeed = 42;

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

  function byggPrompt(projektTyp, dim) {
    var description = _projektPrompt[projektTyp] || ('a ' + projektTyp + ', natural wood, Scandinavian style');

    var mattText = '';
    if (dim && dim.b && dim.l) {
      mattText = ', approximately ' + dim.b + ' meters wide and ' + dim.l + ' meters deep';
    }

    return description + mattText + ', high detail, daylight, 8k uhd, dslr photo, sharp focus, natural lighting';
  }

  async function generera(projektTyp, dim, userImageBase64, maskBase64, cadCannyBase64) {
    if (!kontrolleraKostnad()) {
      return { ok: false, error: 'Dagsgränsen på ' + _config.maxPerDag + ' genereringar har uppnåtts.' };
    }

    if (!userImageBase64 || !maskBase64) {
      return { ok: false, error: 'Bild och mask krävs för inpainting.' };
    }

    _config.isGenerating = true;

    try {
      var prompt = byggPrompt(projektTyp, dim);

      // Resize bild + mask + ev. CAD-canny (behåll proportioner, max 2048px)
      var resizedImage = await _resizeFit(userImageBase64, 2048);
      var resizedMask = await _resizeFit(maskBase64, 2048);
      var resizedCanny = cadCannyBase64 ? await _resizeFit(cadCannyBase64, 2048) : null;

      var payload = { prompt: prompt, image: resizedImage, mask: resizedMask, dimensions: dim };
      if (resizedCanny) payload.cadCanny = resizedCanny;

      var res = await fetch(_config.proxyUrl + '/api/visualisera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      var data = await res.json();

      if (!res.ok) {
        return { ok: false, error: data.error || 'Serverfel (' + res.status + ')' };
      }

      // Spara seed från serverns svar
      if (data.seed != null) {
        _lastSeed = data.seed;
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

  // ---- Mask-editor ----------------------------------------------------------

  function renderMaskEditor(container, imageBase64, onGenerate) {
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
    btnRegenerate.textContent = 'Generera med aktuella dimensioner';
    btnRegenerate.onclick = function() { if (typeof startaAIGenerering === 'function') startaAIGenerering(); };

    var btnNyMask = document.createElement('button');
    btnNyMask.className = 'ai-knapp ai-knapp-sekundar';
    btnNyMask.textContent = 'Rita ny mask';
    btnNyMask.onclick = function() { if (typeof visaMaskEditor === 'function') visaMaskEditor(); };

    knappar.appendChild(btnRegenerate);
    knappar.appendChild(btnNyMask);

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
    btn.onclick = function() { if (typeof visaMaskEditor === 'function') visaMaskEditor(); };

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

  // ---- Exponera publikt API -------------------------------------------------

  return {
    _config: _config,
    init: init,
    kontrolleraKostnad: kontrolleraKostnad,
    byggPrompt: byggPrompt,
    generera: generera,
    renderMaskEditor: renderMaskEditor,
    renderLaddning: renderLaddning,
    renderBild: renderBild,
    renderFel: renderFel,
    renderSektion: renderSektion,
    analyseraMaskCanvas: analyseraMaskCanvas,
    skalaMaskRunt: skalaMaskRunt
  };

})();
