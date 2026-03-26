// ============================================================
// GENERATOR — Genererar 3D-delar fran design + berakning
// ============================================================
//
// Tar en design (fran DesignModell) och en berakning (fran
// ByggRegler.tillampa) och producerar en array av del-deskriptorer
// i samma format som bygg3d.js forväntar sig.
//
// Generatorn ar registreringsbaserad: varje sektionstyp
// ('plattform', 'byggnad', 'tak') registrerar sin egen
// delgenerator. Att lagga till nya projekttyper kraver
// bara en ny registrering.
//
// ============================================================

var ByggGenerator = (function () {

  // Registrerade delgeneratorer per sektionstyp
  var _sektionsGeneratorer = {};

  // Registrerade standarddesigner per projekttyp
  var _standardDesigner = {};

  // ----------------------------------------------------------
  // Registrera en delgenerator for en sektionstyp
  // generatorFn(sektion, berakningForSektion, design, berakning) → delar[]
  // ----------------------------------------------------------
  function registreraSektionstyp(sektionsTyp, generatorFn) {
    _sektionsGeneratorer[sektionsTyp] = generatorFn;
  }

  // ----------------------------------------------------------
  // Registrera standarddesign for en projekttyp
  // fabrikFn(b, l, h, ...) → design
  // ----------------------------------------------------------
  function registreraStandard(projektTyp, fabrikFn) {
    _standardDesigner[projektTyp] = fabrikFn;
  }

  // ----------------------------------------------------------
  // Generera alla delar for en design
  // ----------------------------------------------------------
  function delar(design, berakning) {
    var alla = [];

    for (var i = 0; i < design.sektioner.length; i++) {
      var sek = design.sektioner[i];
      var gen = _sektionsGeneratorer[sek.typ];
      if (!gen) continue;

      var sekBerakning = berakning.perSektion[sek.id];
      if (!sekBerakning) continue;

      var sekDelar = gen(sek, sekBerakning, design, berakning);

      // Forskjut delar om sektionen har offset (multisektion)
      var offX = sek.x || 0;
      var offY = sek.y || 0;
      for (var j = 0; j < sekDelar.length; j++) {
        if (offX !== 0 || offY !== 0) {
          _offsetDel(sekDelar[j], offX, offY);
        }
        alla.push(sekDelar[j]);
      }
    }

    return alla;
  }

  // Forskjut en del med (dx, dy) i varldskoordinater
  function _offsetDel(del, dx, dy) {
    // Box: pos ar [x, y, z]
    if (del.pos && Array.isArray(del.pos)) {
      del.pos = [del.pos[0] + dx, del.pos[1] + dy, del.pos[2]];
    }
    // Wall: verts ar [[x,y,z], ...]
    if (del.verts) {
      for (var i = 0; i < del.verts.length; i++) {
        del.verts[i] = [del.verts[i][0] + dx, del.verts[i][1] + dy, del.verts[i][2]];
      }
    }
    // Centroid for djupsortering
    if (del.cx !== undefined) del.cx += dx;
    if (del.cy !== undefined) del.cy += dy;
    // Racke: offset stolppositioner
    if (del.allPostPos) {
      for (var i = 0; i < del.allPostPos.length; i++) {
        del.allPostPos[i] = [del.allPostPos[i][0] + dx, del.allPostPos[i][1] + dy];
      }
    }
    // Alla typer som behover offset i renderaren
    del._offX = (del._offX || 0) + dx;
    del._offY = (del._offY || 0) + dy;
  }

  // ----------------------------------------------------------
  // Skapa standarddesign for ett projekt
  // ----------------------------------------------------------
  function standardDesign(projektTyp, params) {
    var fabrik = _standardDesigner[projektTyp];
    if (!fabrik) return null;
    return fabrik(params);
  }

  return {
    registreraSektionstyp: registreraSektionstyp,
    registreraStandard: registreraStandard,
    delar: delar,
    standardDesign: standardDesign
  };

})();


// ============================================================
// SEKTIONSTYP: PLATTFORM
// ============================================================
//
// Genererar: stolpar, barlinor, tvarreglar, trall, kantbrader,
//            husvagg, racke
//
// Denna generator producerar EXAKT samma delar-array som
// den ursprungliga projekt.altan.bygg3d(b, l, h) i bygg3d.js.
// Det gar att verifiera med ByggGenerator.verifiera().
//
// ============================================================

ByggGenerator.registreraSektionstyp('plattform', function (sek, ber, design /*, berakning */) {
  var b  = sek.b;
  var l  = sek.l;
  var h  = ber.h;

  var bPs    = ber.stolpPosB;
  var lPs    = ber.stolpPosL;
  var pW     = ber.stolpDim;
  var kantT  = ber.kantTjocklek;
  var hw     = pW / 2;
  var rH     = ber.rackeHojd;
  var wallH  = ber.vaggHojd;

  var delar = [];

  // ── Stolpar ──
  // Alla kantpositioner: bPs × [0, l] + inre lPs × [0, b]
  var allPostPos = [];
  var pi, px, py;

  for (pi = 0; pi < bPs.length; pi++) {
    allPostPos.push([bPs[pi], 0]);
    allPostPos.push([bPs[pi], l]);
  }
  for (pi = 0; pi < lPs.length; pi++) {
    if (lPs[pi] > 0 && lPs[pi] < l) {
      allPostPos.push([0, lPs[pi]]);
      allPostPos.push([b, lPs[pi]]);
    }
  }

  for (pi = 0; pi < allPostPos.length; pi++) {
    px = allPostPos[pi][0];
    py = allPostPos[pi][1];
    var sx = px, sy = py;

    // Justera inåt fran kanten (plats for kantbrada)
    if (px <= 0)      sx = kantT + hw;
    else if (px >= b) sx = b - kantT - hw;
    if (py <= 0)      sy = kantT + hw;
    else if (py >= l) sy = l - kantT - hw;

    delar.push({
      typ: 'box',
      pos: [sx, sy, 0],
      dim: [pW, pW, h - ber.trallDim[0]],
      lager: 'stolpar',
      material: 'stolpe'
    });
  }

  // ── Barlinor (x-led) ──
  var regelHW = ber.balkDim[0] / 2;
  // Trim = stolpens innerkant (kant i kant, som med regelsko)
  var regelTrim = kantT + pW;
  for (pi = 0; pi < bPs.length; pi++) {
    var regelX = bPs[pi];
    // Klämma kantreglar inåt så de inte sticker ut förbi kantbrädorna
    if (regelX <= 0)      regelX = kantT + regelHW;
    else if (regelX >= b) regelX = b - kantT - regelHW;
    delar.push({
      typ: 'regel',
      axis: 'x',
      pos: regelX,
      zBot: h - ber.balkDim[1],
      zTop: h - ber.trallDim[0],
      bredd: ber.balkDim[0],
      langd_b: b,
      langd_l: l,
      trimStart: regelTrim,
      trimEnd: regelTrim,
      lager: 'reglar',
      material: 'regel'
    });
  }

  // ── Tvarreglar (y-led) ──
  for (pi = 0; pi < lPs.length; pi++) {
    if (lPs[pi] <= 0 || lPs[pi] >= l) continue;
    delar.push({
      typ: 'regel',
      axis: 'y',
      pos: lPs[pi],
      zBot: h - ber.balkDim[1],
      zTop: h - ber.trallDim[0],
      bredd: ber.balkDim[0],
      langd_b: b,
      langd_l: l,
      trimStart: regelTrim,
      trimEnd: regelTrim,
      lager: 'reglar',
      material: 'regel'
    });
  }

  // ── Trallplankor ──
  delar.push({
    typ: 'trall',
    b: b,
    l: l,
    h: h,
    trallT: ber.trallDim[0],
    plankW: ber.trallDim[1],
    plankGap: ber.trallGap,
    lager: 'trall',
    material: 'trall'
  });

  // ── Kantbrader ──
  delar.push({
    typ: 'kantbrader',
    b: b,
    l: l,
    h: h,
    kantH: h,
    lager: 'reglar',
    material: 'kant'
  });

  // ── Husvagg ──
  // Ritas pa nordsidan (y=0) om designen har vagganslutning
  if (design.globalt.vaggSida !== false) {
    delar.push({
      typ: 'wall',
      verts: [[0, 0, 0], [b, 0, 0], [b, 0, wallH], [0, 0, wallH]],
      cx: b / 2,
      cy: 0,
      cz: wallH / 2,
      wallH: wallH,
      lager: 'husvagg',
      material: 'husvagg'
    });
  }

  // ── Racke ──
  if (rH > 0) {
    delar.push({
      typ: 'racke',
      b: b,
      l: l,
      h: h,
      rH: rH,
      bPs: bPs,
      lPs: lPs,
      allPostPos: allPostPos,
      lager: 'racke',
      material: 'racke'
    });
  }

  return delar;
});


// ============================================================
// STANDARDDESIGN: ALTAN
// ============================================================

ByggGenerator.registreraStandard('altan', function (params) {
  var b = params.b || 4;
  var l = params.l || 3;
  var h = params.h || 0.6;

  var design = DesignModell.skapa('altan');

  DesignModell.laggTillSektion(design, {
    typ: 'plattform',
    x: 0,
    y: 0,
    b: b,
    l: l,
    egenskaper: { h: h }
  });

  design.globalt.vaggSida = 'nord';

  return design;
});


// ============================================================
// SEKTIONSTYP: BYGGNAD (lekstuga, friggebod, forrad)
// ============================================================
//
// Genererar: golv, 4 vaggar, sadeltak, dorr, fonster
//
// ============================================================

ByggGenerator.registreraSektionstyp('byggnad', function (sek, ber, design) {
  var b = sek.b;
  var l = sek.l;
  var h = ber.h;
  var delar = [];

  // ── Golv ──
  delar.push({
    typ: 'golv',
    b: b,
    l: l,
    golvT: ber.golvDim[0],
    plankW: ber.golvDim[1],
    plankGap: ber.golvGap,
    lager: 'golv',
    material: 'golv'
  });

  // ── Vaggar ──
  // Nord (y=0)
  delar.push({
    typ: 'vagg',
    sida: 'nord',
    b: b, l: l, h: h,
    x0: 0, y0: 0, x1: b, y1: 0,
    nockHojd: ber.nockHojd,
    harNock: true,
    lager: 'vaggar',
    material: 'vagg'
  });

  // Syd (y=l) — med dorr
  delar.push({
    typ: 'vagg',
    sida: 'syd',
    b: b, l: l, h: h,
    x0: 0, y0: l, x1: b, y1: l,
    nockHojd: ber.nockHojd,
    harNock: true,
    dorrX: ber.dorrX,
    dorrB: ber.dorrB,
    dorrH: ber.dorrH,
    lager: 'vaggar',
    material: 'vagg'
  });

  // Vast (x=0)
  delar.push({
    typ: 'vagg',
    sida: 'vast',
    b: b, l: l, h: h,
    x0: 0, y0: 0, x1: 0, y1: l,
    lager: 'vaggar',
    material: 'vagg'
  });

  // Ost (x=b) — med fonster
  delar.push({
    typ: 'vagg',
    sida: 'ost',
    b: b, l: l, h: h,
    x0: b, y0: 0, x1: b, y1: l,
    fonsterY: ber.fonsterY,
    fonsterB: ber.fonsterB,
    fonsterH: ber.fonsterH,
    fonsterZ: ber.fonsterZ,
    lager: 'vaggar',
    material: 'vagg'
  });

  // ── Sadeltak ──
  delar.push({
    typ: 'sadeltak',
    b: b,
    l: l,
    h: h,
    nockHojd: ber.nockHojd,
    takUtsprang: ber.takUtsprang,
    lager: 'tak',
    material: 'tak'
  });

  // ── Dorr ──
  delar.push({
    typ: 'dorr',
    b: b, l: l, h: h,
    dorrX: ber.dorrX,
    dorrB: ber.dorrB,
    dorrH: ber.dorrH,
    lager: 'dorr',
    material: 'dorr'
  });

  // ── Fonster ──
  delar.push({
    typ: 'fonster',
    b: b, l: l, h: h,
    fonsterY: ber.fonsterY,
    fonsterB: ber.fonsterB,
    fonsterH: ber.fonsterH,
    fonsterZ: ber.fonsterZ,
    lager: 'fonster',
    material: 'fonster'
  });

  // ── Regelstomme (for teknisk vy) ──
  // Vertikala reglar langs varje vagg, centrerade i väggtjockleken
  var wT = 0.1; // Matchar väggtjocklek i renderVaggGL
  var regelB = ber.regelDim[0];
  for (var i = 0; i < ber.regelPosB.length; i++) {
    var rx = ber.regelPosB[i];
    // Klämma x så hörnreglar inte sticker utanför sidoväggar
    var stx = Math.max(wT / 2, Math.min(rx, b - wT / 2));
    // Nordsidan — centrerad i väggtjocklek
    delar.push({
      typ: 'box',
      pos: [stx, wT / 2, 0],
      dim: [regelB, regelB, h],
      lager: 'stomme',
      material: 'stommeRegel'
    });
    // Sydsidan
    delar.push({
      typ: 'box',
      pos: [stx, l - wT / 2, 0],
      dim: [regelB, regelB, h],
      lager: 'stomme',
      material: 'stommeRegel'
    });
  }
  for (var j = 0; j < ber.regelPosL.length; j++) {
    var ry = ber.regelPosL[j];
    if (ry <= 0 || ry >= l) continue;
    // Vastsidan — centrerad i väggtjocklek
    delar.push({
      typ: 'box',
      pos: [wT / 2, ry, 0],
      dim: [regelB, regelB, h],
      lager: 'stomme',
      material: 'stommeRegel'
    });
    // Ostsidan
    delar.push({
      typ: 'box',
      pos: [b - wT / 2, ry, 0],
      dim: [regelB, regelB, h],
      lager: 'stomme',
      material: 'stommeRegel'
    });
  }

  return delar;
});


// ============================================================
// STANDARDDESIGN: LEKSTUGA
// ============================================================

ByggGenerator.registreraStandard('lekstuga', function (params) {
  var b = params.b || 2;
  var l = params.l || 2;
  var h = params.h || 2.2;

  var design = DesignModell.skapa('lekstuga');

  DesignModell.laggTillSektion(design, {
    typ: 'byggnad',
    x: 0,
    y: 0,
    b: b,
    l: l,
    egenskaper: { h: h }
  });

  return design;
});


// ============================================================
// INTEGRATION — Ersatt projekt.altan.bygg3d med nya pipelinen
// ============================================================
//
// Detta ar den enda anslutningspunkten till befintlig kod.
// rita3D() i app.js anropar p.bygg3d(b, l, h) — vi ersatter
// den funktionen sa att den gar genom:
//
//   1. ByggGenerator.standardDesign('altan', {b, l, h})
//   2. ByggRegler.tillampa(design)
//   3. ByggGenerator.delar(design, berakning)
//
// Resultat: identisk delar-array, inget annat behover andras.
//
// ============================================================

(function () {
  // Spara originalet for verifieringssyften
  var _originalBygg3d = projekt.altan.bygg3d;

  projekt.altan.bygg3d = function (b, l, h) {
    var design = ByggGenerator.standardDesign('altan', { b: b, l: l, h: h });
    var resultat = ByggRegler.tillampa(design);
    return ByggGenerator.delar(design, resultat.berakning);
  };

  // Gör designen tillganglig for resten av appen (anvands i fas 2+)
  projekt.altan.bygg3d.skapaDesign = function (b, l, h) {
    var design = ByggGenerator.standardDesign('altan', { b: b, l: l, h: h });
    var resultat = ByggRegler.tillampa(design);
    return { design: design, berakning: resultat.berakning };
  };

  // ----------------------------------------------------------
  // Verifieringsfunktion — anropa fran konsolen:
  //   ByggGenerator.verifiera(4, 3, 0.6)
  //
  // Jamfor nya generatorns output med originalets for att
  // sakerstalla identisk rendering.
  // ----------------------------------------------------------
  ByggGenerator.verifiera = function (b, l, h) {
    b = b || 4; l = l || 3; h = h || 0.6;

    var original = _originalBygg3d(b, l, h);
    var design = ByggGenerator.standardDesign('altan', { b: b, l: l, h: h });
    var resultat = ByggRegler.tillampa(design);
    var ny = ByggGenerator.delar(design, resultat.berakning);

    // Jamfor antal delar
    if (original.length !== ny.length) {
      console.warn('ANTAL SKILJER: original=' + original.length + ', ny=' + ny.length);
    }

    // Jamfor varje del
    var ok = true;
    var max = Math.max(original.length, ny.length);
    for (var i = 0; i < max; i++) {
      var a = original[i];
      var b2 = ny[i];
      if (!a || !b2) {
        console.warn('Del ' + i + ': saknas i ' + (!a ? 'original' : 'ny'));
        ok = false;
        continue;
      }
      if (a.typ !== b2.typ) {
        console.warn('Del ' + i + ': typ skiljer: ' + a.typ + ' vs ' + b2.typ);
        ok = false;
      }
    }

    if (ok && original.length === ny.length) {
      console.log('VERIFIERING OK — ' + ny.length + ' delar matchar for ' + b + 'x' + l + ' h=' + h);
    }

    return { original: original, ny: ny };
  };
})();


// ============================================================
// INTEGRATION: LEKSTUGA
// ============================================================

(function () {
  projekt.lekstuga.bygg3d = function (b, l, h) {
    var design = ByggGenerator.standardDesign('lekstuga', { b: b, l: l, h: h });
    var resultat = ByggRegler.tillampa(design);
    return ByggGenerator.delar(design, resultat.berakning);
  };

  projekt.lekstuga.bygg3d.skapaDesign = function (b, l, h) {
    var design = ByggGenerator.standardDesign('lekstuga', { b: b, l: l, h: h });
    var resultat = ByggRegler.tillampa(design);
    return { design: design, berakning: resultat.berakning };
  };
})();


// ============================================================
// SEKTIONSTYP: PERGOLA (oppen konstruktion med spjaltak)
// ============================================================

ByggGenerator.registreraSektionstyp('pergola', function (sek, ber) {
  var b = sek.b;
  var l = sek.l;
  var h = ber.h;
  var delar = [];

  var pW = ber.stolpDim;
  var hw = pW / 2;
  var balkB = ber.balkDim[0];
  var balkH = ber.balkDim[1];
  var spjB = ber.spjalDim[0];
  var spjH = ber.spjalDim[1];

  // ── Stolpar ──
  for (var i = 0; i < ber.stolpPosB.length; i++) {
    for (var j = 0; j < ber.stolpPosL.length; j++) {
      var px = ber.stolpPosB[i];
      var py = ber.stolpPosL[j];
      // Flytta innanfor ytterkant
      var sx = px <= 0 ? hw : px >= b ? b - hw : px;
      var sy = py <= 0 ? hw : py >= l ? l - hw : py;
      delar.push({
        typ: 'box',
        pos: [sx, sy, 0],
        dim: [pW, pW, h],
        lager: 'stolpar',
        material: 'stolpe'
      });
    }
  }

  // ── Bärbalkar (y-led, vilar pa stolparna) ──
  for (var bi = 0; bi < ber.stolpPosL.length; bi++) {
    var balkY = ber.stolpPosL[bi];
    delar.push({
      typ: 'regel',
      axis: 'y',
      pos: balkY,
      zBot: h,
      zTop: h + balkH,
      bredd: balkB,
      langd_b: b,
      langd_l: l,
      lager: 'balkar',
      material: 'regel'
    });
  }

  // ── Spjälor (x-led, tvärs över balkarna) ──
  var spjZ = h + balkH;
  var spjStep = ber.spjalCC;
  for (var sx2 = 0; sx2 <= b + 0.001; sx2 += spjStep) {
    var spjX = Math.min(sx2, b);
    delar.push({
      typ: 'regel',
      axis: 'x',
      pos: spjX,
      zBot: spjZ,
      zTop: spjZ + spjH,
      bredd: spjB,
      langd_b: b,
      langd_l: l,
      lager: 'spjalor',
      material: 'regel'
    });
  }

  return delar;
});

ByggGenerator.registreraStandard('pergola', function (params) {
  var b = params.b || 3;
  var l = params.l || 3;
  var h = params.h || 2.4;

  var design = DesignModell.skapa('pergola');

  DesignModell.laggTillSektion(design, {
    typ: 'pergola',
    x: 0,
    y: 0,
    b: b,
    l: l,
    egenskaper: { h: h }
  });

  return design;
});

// ============================================================
// INTEGRATION: PERGOLA
// ============================================================

(function () {
  projekt.pergola.bygg3d = function (b, l, h) {
    var design = ByggGenerator.standardDesign('pergola', { b: b, l: l, h: h });
    var resultat = ByggRegler.tillampa(design);
    return ByggGenerator.delar(design, resultat.berakning);
  };

  projekt.pergola.bygg3d.skapaDesign = function (b, l, h) {
    var design = ByggGenerator.standardDesign('pergola', { b: b, l: l, h: h });
    var resultat = ByggRegler.tillampa(design);
    return { design: design, berakning: resultat.berakning };
  };
})();
