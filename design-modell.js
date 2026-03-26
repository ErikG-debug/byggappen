// ============================================================
// DESIGN-MODELL — Generisk datastruktur for byggkonstruktioner
// ============================================================
//
// En konstruktion (design) bestar av rektangulara sektioner som
// kan kombineras till L-former, T-former etc. Modellen vet inget
// om specifika projekttyper — den hanterar bara geometri.
//
// Sektionstyper (utokningsbara):
//   'plattform'  — upphojd yta (altan, brygga, poolplattform)
//   'byggnad'    — byggnadsfotavtryck med vaggar (lekstuga, friggebod)
//   'tak'        — takstruktur (pergola, carport)
//
// ============================================================

const DesignModell = (function () {

  let _idRaknare = 0;

  function _nyttId() {
    return 'sek-' + (++_idRaknare);
  }

  // ----------------------------------------------------------
  // Skapa en tom design
  // ----------------------------------------------------------
  function skapa(projektTyp) {
    return {
      projektTyp: projektTyp,
      sektioner: [],
      globalt: {}
    };
  }

  // ----------------------------------------------------------
  // Lagg till en sektion
  // ----------------------------------------------------------
  function laggTillSektion(design, config) {
    var sek = {
      id: _nyttId(),
      typ: config.typ || 'plattform',
      x: config.x || 0,
      y: config.y || 0,
      b: config.b,
      l: config.l,
      egenskaper: config.egenskaper ? _kopia(config.egenskaper) : {}
    };

    // Kontrollera overlapp med befintliga sektioner
    for (var i = 0; i < design.sektioner.length; i++) {
      if (_overlappar(sek, design.sektioner[i])) return null;
    }

    design.sektioner.push(sek);
    return sek;
  }

  // ----------------------------------------------------------
  // Andra en sektion
  // ----------------------------------------------------------
  function andraSektion(design, sektionId, andringar) {
    var sek = _hitta(design, sektionId);
    if (!sek) return false;

    var nycklar = Object.keys(andringar);
    for (var i = 0; i < nycklar.length; i++) {
      var k = nycklar[i];
      if (k === 'egenskaper') {
        Object.assign(sek.egenskaper, andringar.egenskaper);
      } else if (k === 'x' || k === 'y' || k === 'b' || k === 'l') {
        sek[k] = andringar[k];
      }
    }
    return true;
  }

  // ----------------------------------------------------------
  // Ta bort en sektion (minst 1 maste finnas)
  // ----------------------------------------------------------
  function taBortSektion(design, sektionId) {
    if (design.sektioner.length <= 1) return false;
    var idx = design.sektioner.findIndex(function (s) { return s.id === sektionId; });
    if (idx === -1) return false;
    design.sektioner.splice(idx, 1);
    return true;
  }

  // ----------------------------------------------------------
  // Bounding box for hela designen
  // ----------------------------------------------------------
  function bounds(design) {
    if (design.sektioner.length === 0) return { x: 0, y: 0, b: 0, l: 0 };
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (var i = 0; i < design.sektioner.length; i++) {
      var s = design.sektioner[i];
      if (s.x < x0) x0 = s.x;
      if (s.y < y0) y0 = s.y;
      if (s.x + s.b > x1) x1 = s.x + s.b;
      if (s.y + s.l > y1) y1 = s.y + s.l;
    }
    return { x: x0, y: y0, b: x1 - x0, l: y1 - y0 };
  }

  // ----------------------------------------------------------
  // Hitta grannar (sektioner som delar en kant)
  // ----------------------------------------------------------
  function hittaGrannar(design, sektionId) {
    var sek = _hitta(design, sektionId);
    if (!sek) return [];
    var resultat = [];
    for (var i = 0; i < design.sektioner.length; i++) {
      var annan = design.sektioner[i];
      if (annan.id === sektionId) continue;
      var kant = _deladKant(sek, annan);
      if (kant) resultat.push({ sektion: annan, kant: kant });
    }
    return resultat;
  }

  // ----------------------------------------------------------
  // Ytterkanter — alla kantsegment som INTE delas med en granne
  //
  // Returnerar: [{ sida, riktning, pos, start, slut, sektionId }]
  //   sida:     'nord'|'syd'|'vast'|'ost'
  //   riktning: 'h' (horisontell) eller 'v' (vertikal)
  //   pos:      y-koordinat (h) eller x-koordinat (v) for kanten
  //   start/slut: intervall langs kanten
  // ----------------------------------------------------------
  function ytterkanter(design) {
    var kanter = [];

    for (var i = 0; i < design.sektioner.length; i++) {
      var sek = design.sektioner[i];

      var raaKanter = [
        { sida: 'nord', riktning: 'h', pos: sek.y,         start: sek.x, slut: sek.x + sek.b },
        { sida: 'syd',  riktning: 'h', pos: sek.y + sek.l, start: sek.x, slut: sek.x + sek.b },
        { sida: 'vast', riktning: 'v', pos: sek.x,         start: sek.y, slut: sek.y + sek.l },
        { sida: 'ost',  riktning: 'v', pos: sek.x + sek.b, start: sek.y, slut: sek.y + sek.l }
      ];

      for (var k = 0; k < raaKanter.length; k++) {
        var yttre = _subtraheraDelade(raaKanter[k], sek, design);
        for (var j = 0; j < yttre.length; j++) {
          yttre[j].sektionId = sek.id;
          kanter.push(yttre[j]);
        }
      }
    }

    return kanter;
  }

  // ----------------------------------------------------------
  // Mojliga snap-positioner for att lagga till en ny sektion
  // Returnerar kandidat-rektanglar langs befintliga ytterkanter
  // ----------------------------------------------------------
  function snapKandidater(design, nyB, nyL) {
    var yttre = ytterkanter(design);
    var kandidater = [];

    for (var i = 0; i < yttre.length; i++) {
      var kant = yttre[i];
      if (kant.riktning === 'h') {
        // Horisontell kant — ny sektion ovanfor eller under
        var x = kant.start;
        var y = kant.sida === 'syd' ? kant.pos : kant.pos - nyL;
        kandidater.push({ x: x, y: y, b: nyB, l: nyL, fran: kant });
      } else {
        // Vertikal kant — ny sektion till vanster eller hoger
        var x2 = kant.sida === 'ost' ? kant.pos : kant.pos - nyB;
        var y2 = kant.start;
        kandidater.push({ x: x2, y: y2, b: nyB, l: nyL, fran: kant });
      }
    }

    // Filtrera bort kandidater som overlappar befintliga sektioner
    return kandidater.filter(function (k) {
      var testSek = { x: k.x, y: k.y, b: k.b, l: k.l };
      for (var j = 0; j < design.sektioner.length; j++) {
        if (_overlappar(testSek, design.sektioner[j])) return false;
      }
      return true;
    });
  }

  // ----------------------------------------------------------
  // Serialisering
  // ----------------------------------------------------------
  function spara(design) {
    return JSON.stringify(design);
  }

  function ladda(json) {
    var d = JSON.parse(json);
    // Uppdatera raknare sa att nya ID:n inte krockar
    for (var i = 0; i < d.sektioner.length; i++) {
      var n = parseInt(d.sektioner[i].id.replace('sek-', ''));
      if (n >= _idRaknare) _idRaknare = n + 1;
    }
    return d;
  }

  // ==========================================================
  // Interna hjalpfunktioner
  // ==========================================================

  var TOL = 0.001;

  function _hitta(design, id) {
    return design.sektioner.find(function (s) { return s.id === id; }) || null;
  }

  function _kopia(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // Tva sektioner overlappar om de delar YTA (att dela en kant ar OK)
  function _overlappar(a, b) {
    return a.x + TOL < b.x + b.b && a.x + a.b > b.x + TOL &&
           a.y + TOL < b.y + b.l && a.y + a.l > b.y + TOL;
  }

  // Hitta delad kant mellan tva sektioner
  function _deladKant(a, b) {
    // Vertikal delad kant
    var yStart = Math.max(a.y, b.y);
    var ySlut  = Math.min(a.y + a.l, b.y + b.l);
    if (ySlut - yStart > TOL) {
      if (Math.abs((a.x + a.b) - b.x) < TOL)
        return { riktning: 'v', pos: a.x + a.b, start: yStart, slut: ySlut };
      if (Math.abs((b.x + b.b) - a.x) < TOL)
        return { riktning: 'v', pos: a.x, start: yStart, slut: ySlut };
    }
    // Horisontell delad kant
    var xStart = Math.max(a.x, b.x);
    var xSlut  = Math.min(a.x + a.b, b.x + b.b);
    if (xSlut - xStart > TOL) {
      if (Math.abs((a.y + a.l) - b.y) < TOL)
        return { riktning: 'h', pos: a.y + a.l, start: xStart, slut: xSlut };
      if (Math.abs((b.y + b.l) - a.y) < TOL)
        return { riktning: 'h', pos: a.y, start: xStart, slut: xSlut };
    }
    return null;
  }

  // Subtrahera delade delar fran en raaKant
  function _subtraheraDelade(kant, sek, design) {
    var subtraktioner = [];

    for (var i = 0; i < design.sektioner.length; i++) {
      var annan = design.sektioner[i];
      if (annan.id === sek.id) continue;

      if (kant.riktning === 'h') {
        // Kolla om granne har kant vid samma y
        if (Math.abs(kant.pos - annan.y) < TOL || Math.abs(kant.pos - (annan.y + annan.l)) < TOL) {
          var oStart = Math.max(kant.start, annan.x);
          var oSlut  = Math.min(kant.slut, annan.x + annan.b);
          if (oSlut - oStart > TOL) {
            subtraktioner.push({ start: oStart, slut: oSlut });
          }
        }
      } else {
        if (Math.abs(kant.pos - annan.x) < TOL || Math.abs(kant.pos - (annan.x + annan.b)) < TOL) {
          var oStart2 = Math.max(kant.start, annan.y);
          var oSlut2  = Math.min(kant.slut, annan.y + annan.l);
          if (oSlut2 - oStart2 > TOL) {
            subtraktioner.push({ start: oStart2, slut: oSlut2 });
          }
        }
      }
    }

    // Subtrahera intervall
    var kvar = [{ start: kant.start, slut: kant.slut }];

    for (var s = 0; s < subtraktioner.length; s++) {
      var sub = subtraktioner[s];
      var nytt = [];
      for (var j = 0; j < kvar.length; j++) {
        var seg = kvar[j];
        if (sub.slut <= seg.start || sub.start >= seg.slut) {
          nytt.push(seg);
        } else {
          if (sub.start > seg.start) nytt.push({ start: seg.start, slut: sub.start });
          if (sub.slut < seg.slut)   nytt.push({ start: sub.slut, slut: seg.slut });
        }
      }
      kvar = nytt;
    }

    return kvar.map(function (seg) {
      return { sida: kant.sida, riktning: kant.riktning, pos: kant.pos, start: seg.start, slut: seg.slut };
    });
  }

  // ==========================================================
  // Publikt API
  // ==========================================================
  return {
    skapa: skapa,
    laggTillSektion: laggTillSektion,
    andraSektion: andraSektion,
    taBortSektion: taBortSektion,
    bounds: bounds,
    hittaGrannar: hittaGrannar,
    ytterkanter: ytterkanter,
    snapKandidater: snapKandidater,
    spara: spara,
    ladda: ladda
  };

})();
