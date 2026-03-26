// ============================================================
// REGLER — Regelmotor for byggkonstruktioner
// ============================================================
//
// Varje projekttyp registrerar en regeluppsattning som
// automatiskt tillampas pa designen. Anvandaren kan aldrig
// skapa en osaker konstruktion — systemet justerar automatiskt.
//
// Regelsystemet ar generiskt: att lagga till en ny projekttyp
// kraver bara en ny regelregistrering, inte ny kod.
//
// Anropsmonstret:
//   ByggRegler.tillampa(design) → { berakning }
//
// ============================================================
//
// REGELVERK OCH STANDARDER
//
// Alla konstruktionsregler i denna fil foljer svensk lagstiftning,
// europeiska konstruktionsstandarder och branschpraxis:
//
// 1. BBR — Boverkets byggregler (BFS 2011:6 t.o.m. BFS 2024:14, BBR 31)
//    Avsnitt 8: Sakerhet vid anvandning
//    - 8:231  Skydd mot fall — krav pa racken vid nivaer med fallrisk
//    - 8:2321 Racken — hojdkrav, klattringsskydd, max oppning
//    OBS: BBR ersatts successivt av BFS 2024:9 fran 1 juli 2025.
//    Under overgangsperioden (t.o.m. 30 juni 2026) galler bada.
//
// 2. BFS 2024:9 — Boverkets foreskrifter om sakerhet vid anvandning
//    Ny foreskrift som ersatter BBR avsnitt 8.
//    2 kap. 10 ss.: Racken och fallskydd.
//
// 3. EKS 12 — Boverkets konstruktionsregler (BFS 2011:10, BFS 2022:4)
//    Sveriges implementering av Eurokoderna.
//    Avsnitt J: Trakonstruktioner (hanvisar till SS-EN 1995-1-1).
//    Innehaller Sveriges nationella val (NDP:er) for Eurokoderna.
//
// 4. SS-EN 1995-1-1:2004/A2:2014 (Eurokod 5)
//    Dimensionering av trakonstruktioner — Del 1-1: Allmanna regler.
//    Berakningsgrund for spannvidder, balkdimensioner, stolpavstand.
//    Nationella parametrar anges i EKS avsnitt J.
//
// 5. SS-EN 1990:2002 (Eurokod 0)
//    Grundlaggande dimensioneringsregler — lastfaktorer, sakerhetsklasser.
//
// 6. SS-EN 1991-1-1:2002 (Eurokod 1)
//    Laster pa barverk — egentyngd och nyttig last for bostader.
//
// 7. Svenskt Tra / TraGuiden (traguiden.se)
//    Branschpraxis for tradimensionering, baserad pa Eurokod 5.
//    Altanbjalklag: rekommenderade c/c-avstand, balkdimensioner,
//    trallmatt och infastning. Anvands som praktisk dimensioneringsguide.
//    Ref: Lathunden, utgava 8:2021 (Svenskt Tra).
//
// 8. AMA Hus 24
//    Allman material- och arbetsbeskrivning for husbyggnad.
//    Kapitel M: Utforande av trakonstruktioner.
//    Branschstandard for kvalitet och utforande (ej bindande lag).
//
// 9. PBL — Plan- och bygglagen (2010:900)
//    Fran 1 december 2025: nya regler for bygglov och
//    bygglovsbefriade komplementbyggnader (ersatter friggebod/attefall).
//    Altan: bygglov kravs vid hojd > 1,8 m inom 3,6 m fran byggnad,
//    eller > 1,2 m langre bort. Minst 4,5 m till tomtgrans.
//
// ============================================================

var ByggRegler = (function () {

  var _register = {};

  // ----------------------------------------------------------
  // Generiska hjalpfunktioner (anvands av alla regeltyper)
  // ----------------------------------------------------------

  // Fordela positioner langs en stracka med maximalt avstand.
  // Strukturell grund: max stolp/regelavstand enligt Eurokod 5
  // via spannviddstabeller i TraGuiden.
  function fordela(langd, maxAvstand) {
    var arr = [];
    var p = 0;
    while (true) {
      arr.push(parseFloat(Math.min(p, langd).toFixed(3)));
      if (p >= langd) break;
      p = Math.min(p + maxAvstand, langd);
    }
    return arr;
  }

  // Klamma ett varde till min/max, eventuellt avrunda till steg
  function klamma(varde, min, max, steg) {
    var v = Math.max(min, Math.min(max, varde));
    if (steg) v = Math.round(v / steg) * steg;
    return parseFloat(v.toFixed(4));
  }

  // ----------------------------------------------------------
  // Registrera regler for en projekttyp
  // ----------------------------------------------------------
  function registrera(projektTyp, regelDef) {
    _register[projektTyp] = regelDef;
  }

  // ----------------------------------------------------------
  // Tillampa regler pa en design
  // ----------------------------------------------------------
  function tillampa(design) {
    var def = _register[design.projektTyp];
    if (!def) return { berakning: { perSektion: {} } };
    return def.tillampa(design);
  }

  // ----------------------------------------------------------
  // Hamta regler for en projekttyp (for UI, t.ex. slider-granser)
  // ----------------------------------------------------------
  function hamta(projektTyp) {
    return _register[projektTyp] || null;
  }

  return {
    registrera: registrera,
    tillampa: tillampa,
    hamta: hamta,
    fordela: fordela,
    klamma: klamma
  };

})();


// ============================================================
// ALTANREGLER
// ============================================================
//
// Sektionstyp: 'plattform' (upphojd yta med barande konstruktion)
// Ateranvandbar for: altan, brygga, poolplattform, uteplats
//
// Varje regel nedan refererar till sin kalla i kommentaren.
// ============================================================

ByggRegler.registrera('altan', {

  // -----------------------------------------------------------
  // DIMENSIONSGRANSER
  // Giltiga intervall for sektionsdimensioner.
  // Baserade pa vanliga virkeslangder (max 6,0 m standard) och
  // praktiska byggstorlekar enligt Svenskt Tra / TraGuiden.
  // -----------------------------------------------------------
  dim: {
    b: { min: 1.5, max: 12, steg: 0.5 },
    l: { min: 1,   max: 8,  steg: 0.5 },
    h: { min: 0.15, max: 2.0, steg: 0.1 }
  },

  standard: { b: 4, l: 3, h: 0.6 },

  lager: [
    { nyckel: 'trall',   etikett: 'Trall' },
    { nyckel: 'reglar',  etikett: 'Reglar' },
    { nyckel: 'stolpar', etikett: 'Stolpar' },
    { nyckel: 'racke',   etikett: 'Räcke' },
    { nyckel: 'husvagg', etikett: 'Husvägg' },
    { nyckel: 'matt',    etikett: 'Mått' }
  ],

  ytaTips: [
    { max: 6,  text: '\u{1F4A1} Räcker för en liten mysig uteplats' },
    { max: 12, text: '\u{1F4A1} Lagom stor för en familj' },
    { max: 20, text: '\u{1F4A1} Gott om plats för sällskap och utemöbler' },
    { max: Infinity, text: '\u{1F4A1} Rymlig altan \u2014 tänk på att det kan krävas bygglov' }
  ],

  varningar: function(h) {
    if (h > 0.5) return '\u26A0\uFE0F Räcke krävs enligt Boverkets regler när altanen är högre än 50 cm. Räcket byggs automatiskt in i ritningen.';
    return null;
  },

  planExtras: {
    husvagg: true
  },

  ui: {
    sliders: [
      { nyckel: 'b', etikett: 'Bredd', enhet: 'm', format: function (v) { return v + ' m'; } },
      { nyckel: 'l', etikett: 'Djup',  enhet: 'm', format: function (v) { return v + ' m'; } }
    ],
    avancerat: [
      { nyckel: 'h', etikett: 'Höjd från mark', enhet: 'cm', format: function (v) { return Math.round(v * 100) + ' cm'; } }
    ],
    visaYta: true,
    ytaEtikett: 'Yta',
    sektionstyp: 'plattform'
  },

  // -----------------------------------------------------------
  // STRUKTURELLA PARAMETRAR
  //
  // Dimensionering enligt:
  //   Eurokod 5 (SS-EN 1995-1-1) med nationella val i EKS avsnitt J
  //   Spannviddstabeller: Svenskt Tra, TraGuiden (altanbjalklag)
  //   Virkesklass: C24 konstruktionsvirke
  //   Impregnering: NTR AB (ovan mark) / NTR A (markkontakt)
  // -----------------------------------------------------------
  struktur: {
    // Max c/c-avstand for stolpar och barlinor.
    // Grund: spannviddstabell for 45x195 mm balk, C24,
    // nyttig last 2,0 kN/m2 (bostadsaltan), sakerhetsklass 2.
    // Ref: TraGuiden altanbjalklag, EKS → Eurokod 5
    stolpMaxAvstand: 1.8,            // meter

    // Stolpdimension: 120x120 mm tryckimpregnerad
    // Ref: TraGuiden, branschpraxis for altanstolpar
    stolpDim: 0.12,                  // meter (120 mm)

    // Balkdimension: 45x195 mm konstruktionsvirke C24
    // Ger spannvidd upp till ca 3,0 m vid c/c 600 mm
    // Ref: TraGuiden spannviddstabell, Eurokod 5
    balkDim: [0.045, 0.195],         // [bredd, hojd] i meter

    // Trallbrada: 28x120 mm tryckimpregnerad furu
    // Ref: TraGuiden, standarddimension for altantrall
    trallDim: [0.028, 0.12],         // [tjocklek, bredd] i meter

    // Mellanrum mellan trallbrader: 5-8 mm
    // Ref: TraGuiden — for vattenavrinning och rojelsemarginal
    trallGap: 0.008,                 // meter (8 mm)

    // Kantbrada: 22 mm tjocklek
    kantTjocklek: 0.022              // meter (22 mm)
  },

  // -----------------------------------------------------------
  // SAKERHETSREGLER
  //
  // Personsaker enligt:
  //   BBR 8:231, 8:2321 (BFS 2011:6 t.o.m. BFS 2024:14)
  //   BFS 2024:9, 2 kap. 10 ss. (ny foreskrift fran 1 juli 2025)
  //
  // Under overgangsperioden (1 juli 2025 — 30 juni 2026) galler
  // bade BBR och nya foreskriften. Varden nedan uppfyller bada.
  // -----------------------------------------------------------
  sakerhet: {
    // Racke kravs vid hojdskillnad over 0,5 m
    // Ref: BBR 8:231, 8:2321 — "racke ska finnas dar det finns
    // risk for personskador till foljd av fall och hojdskillnaden
    // ar mer an 0,5 meter"
    rackeHojdGrans: 0.5,             // meter

    // Racke minst 0,9 m hogt (bostader, inte balkong)
    // Ref: BBR 8:2321 — "rackets hojd ska vara minst 0,9 m
    // i trapplop"
    // For balkonger och langgangsloftgangar: 1,1 m
    // (hallare varde anvands om altanen klassas som balkong)
    rackeHojd: 0.9,                  // meter

    // Max oppning i racke: 100 mm (barnsaker)
    // Ref: BBR 8:2321 — oppningar i racken fa inte vara storre
    // an 100 mm upp till 0,8 m hojd (klattringsskydd)
    // Oppningar 110-230 mm ska undvikas (huvudinklamnrisk)
    rackeMaxGap: 0.1                 // meter (100 mm)
  },

  // -----------------------------------------------------------
  // BYGGLOVSINFORMATION
  //
  // Ref: PBL 9 kap., andringar fran 1 december 2025
  // -----------------------------------------------------------
  bygglov: {
    // Altan inom 3,6 m fran bostadshus: bygglovsfri upp till 1,8 m hojd
    // Altan langre an 3,6 m fran hus: bygglovsfri upp till 1,2 m hojd
    // Avstand till tomtgrans: minst 4,5 m (annars grannes medgivande)
    maxHojdUtanLov:       1.8,       // meter (nara hus)
    maxHojdUtanLovAvstand: 1.2,      // meter (langre fran hus)
    minAvstandTomtgrans:  4.5        // meter
  },

  // -----------------------------------------------------------
  // TILLAMPNINGSFUNKTION
  // Kor alla regler pa designen och returnerar berakning
  // -----------------------------------------------------------
  tillampa: function (design) {
    var regler = this;
    var berakning = { perSektion: {} };

    for (var i = 0; i < design.sektioner.length; i++) {
      var sek = design.sektioner[i];

      // Klamma dimensioner till giltiga varden
      sek.b = ByggRegler.klamma(sek.b, regler.dim.b.min, regler.dim.b.max, regler.dim.b.steg);
      sek.l = ByggRegler.klamma(sek.l, regler.dim.l.min, regler.dim.l.max, regler.dim.l.steg);

      var h = sek.egenskaper.h !== undefined
        ? ByggRegler.klamma(sek.egenskaper.h, regler.dim.h.min, regler.dim.h.max, regler.dim.h.steg)
        : 0.6;
      sek.egenskaper.h = h;

      // Stolppositioner — automatiskt placerade med max c/c-avstand
      // Ref: Eurokod 5 via TraGuiden spannviddstabeller
      var stolpPosB = ByggRegler.fordela(sek.b, regler.struktur.stolpMaxAvstand);
      var stolpPosL = ByggRegler.fordela(sek.l, regler.struktur.stolpMaxAvstand);

      // Rackebehov — automatiskt vid hojd over 50 cm
      // Ref: BBR 8:2321 / BFS 2024:9
      var harRacke = h > regler.sakerhet.rackeHojdGrans;

      // Trappbehov
      var harTrapp = h > 0.3;
      var antalTrappsteg = harTrapp ? Math.max(1, Math.round(h / 0.175)) : 0;

      // Vagghojd (for husvagg-rendering)
      var vaggHojd = Math.min(2.5, h + 1.6);

      // Bygglovsvarning
      var bygglovKravs = h > regler.bygglov.maxHojdUtanLov;

      berakning.perSektion[sek.id] = {
        stolpPosB:      stolpPosB,
        stolpPosL:      stolpPosL,
        h:              h,
        harRacke:       harRacke,
        rackeHojd:      harRacke ? regler.sakerhet.rackeHojd : 0,
        harTrapp:       harTrapp,
        antalTrappsteg: antalTrappsteg,
        vaggHojd:       vaggHojd,
        bygglovKravs:   bygglovKravs,
        // Strukturdata (fran regler, ej hardkodade i generatorn)
        stolpDim:       regler.struktur.stolpDim,
        balkDim:        regler.struktur.balkDim,
        trallDim:       regler.struktur.trallDim,
        trallGap:       regler.struktur.trallGap,
        kantTjocklek:   regler.struktur.kantTjocklek
      };
    }

    // Designniva-berakningar
    berakning.ytterkanter = DesignModell.ytterkanter(design);
    berakning.bounds      = DesignModell.bounds(design);
    berakning.totalYta    = design.sektioner.reduce(function (s, sek) {
      return s + sek.b * sek.l;
    }, 0);

    return { berakning: berakning };
  }
});


// ============================================================
// LEKSTUGAREGLER
// ============================================================
//
// Sektionstyp: 'byggnad' (byggnad med vaggar, tak, golv)
// Anpassad for lekstuga, men ateranvandbar for friggebod,
// forrad, gaststuga m.m.
//
// ============================================================

ByggRegler.registrera('lekstuga', {

  dim: {
    b: { min: 1.5, max: 4,   steg: 0.1 },
    l: { min: 1.5, max: 3,   steg: 0.1 },
    h: { min: 1.8, max: 2.8, steg: 0.1 }
  },

  standard: { b: 2, l: 2, h: 2.2 },

  lager: [
    { nyckel: 'golv',    etikett: 'Golv' },
    { nyckel: 'vaggar',  etikett: 'Väggar' },
    { nyckel: 'stomme',  etikett: 'Stomme' },
    { nyckel: 'tak',     etikett: 'Tak' },
    { nyckel: 'dorr',    etikett: 'Dörr' },
    { nyckel: 'fonster', etikett: 'Fönster' },
    { nyckel: 'matt',    etikett: 'Mått' }
  ],

  ytaTips: [
    { max: 3, text: '\u{1F4A1} Kompakt kojkänsla, perfekt för små barn' },
    { max: 5, text: '\u{1F4A1} Bra storlek för lek och pyssel' },
    { max: Infinity, text: '\u{1F4A1} Rymlig lekstuga med plats för kompisar' }
  ],

  ui: {
    sliders: [
      { nyckel: 'b', etikett: 'Bredd', enhet: 'm', format: function (v) { return v + ' m'; } },
      { nyckel: 'l', etikett: 'Djup',  enhet: 'm', format: function (v) { return v + ' m'; } },
      { nyckel: 'h', etikett: 'Vägghöjd', enhet: 'm', format: function (v) { return v + ' m'; } }
    ],
    avancerat: [],
    visaYta: true,
    ytaEtikett: 'Golvyta',
    sektionstyp: 'byggnad'
  },

  struktur: {
    regelDim:       [0.045, 0.095],   // 45x95 mm
    regelMaxAvstand: 0.6,              // c/c 600 mm
    golvDim:        [0.022, 0.12],     // 22x120 mm
    golvGap:         0.005,            // 5 mm
    panelDim:       [0.022, 0.12],     // 22x120 mm locklistpanel
    takVinkel:       30,               // grader
    dorrDim:        [0.8, 1.5],        // bredd x hojd i meter
    fonsterDim:     [0.6, 0.6],        // bredd x hojd i meter
    takUtsprang:     0.15              // meter
  },

  tillampa: function (design) {
    var regler = this;
    var berakning = { perSektion: {} };

    for (var i = 0; i < design.sektioner.length; i++) {
      var sek = design.sektioner[i];

      // Klamma dimensioner
      sek.b = ByggRegler.klamma(sek.b, regler.dim.b.min, regler.dim.b.max, regler.dim.b.steg);
      sek.l = ByggRegler.klamma(sek.l, regler.dim.l.min, regler.dim.l.max, regler.dim.l.steg);
      var h = sek.egenskaper.h !== undefined
        ? ByggRegler.klamma(sek.egenskaper.h, regler.dim.h.min, regler.dim.h.max, regler.dim.h.steg)
        : 2.2;
      sek.egenskaper.h = h;

      // Regelpositioner langs vagger (c/c max 600 mm)
      var regelPosB = ByggRegler.fordela(sek.b, regler.struktur.regelMaxAvstand);
      var regelPosL = ByggRegler.fordela(sek.l, regler.struktur.regelMaxAvstand);

      // Takberakning
      var takVinkelRad = regler.struktur.takVinkel * Math.PI / 180;
      var nockHojd = h + Math.tan(takVinkelRad) * (sek.b / 2);
      var takUtsprang = regler.struktur.takUtsprang;

      // Dorr (sydsidan, centrerad)
      var dorrB = regler.struktur.dorrDim[0];
      var dorrH = regler.struktur.dorrDim[1];
      var dorrX = (sek.b - dorrB) / 2;

      // Fonster (ostsidan, centrerad vertikalt)
      var fonsterB = regler.struktur.fonsterDim[0];
      var fonsterH = regler.struktur.fonsterDim[1];
      var fonsterY = (sek.l - fonsterB) / 2;
      var fonsterZ = h * 0.45;

      berakning.perSektion[sek.id] = {
        h:             h,
        regelPosB:     regelPosB,
        regelPosL:     regelPosL,
        regelDim:      regler.struktur.regelDim,
        golvDim:       regler.struktur.golvDim,
        golvGap:       regler.struktur.golvGap,
        panelDim:      regler.struktur.panelDim,
        takVinkel:     regler.struktur.takVinkel,
        takVinkelRad:  takVinkelRad,
        nockHojd:      nockHojd,
        takUtsprang:   takUtsprang,
        dorrX:         dorrX,
        dorrB:         dorrB,
        dorrH:         dorrH,
        fonsterY:      fonsterY,
        fonsterB:      fonsterB,
        fonsterH:      fonsterH,
        fonsterZ:      fonsterZ
      };
    }

    berakning.bounds   = DesignModell.bounds(design);
    berakning.totalYta = design.sektioner.reduce(function (s, sek) {
      return s + sek.b * sek.l;
    }, 0);

    return { berakning: berakning };
  }
});


// ============================================================
// PERGOLAREGLER
// ============================================================
//
// Sektionstyp: 'pergola' (oppen konstruktion med spjaltak)
//
// Pergolan bestar av stolpar, barbalkar och spjalor/ribbor.
// Inga vaggar, inget golv, inget racke.
// ============================================================

ByggRegler.registrera('pergola', {

  dim: {
    b: { min: 2, max: 6, steg: 0.5 },
    l: { min: 2, max: 4, steg: 0.5 },
    h: { min: 2.0, max: 2.8, steg: 0.1 }
  },

  standard: { b: 3, l: 3, h: 2.4 },

  lager: [
    { nyckel: 'spjalor',  etikett: 'Spjälor' },
    { nyckel: 'balkar',   etikett: 'Bärbalkar' },
    { nyckel: 'stolpar',  etikett: 'Stolpar' },
    { nyckel: 'matt',     etikett: 'Mått' }
  ],

  ytaTips: [
    { max: 6,  text: '\u{1F4A1} Mysig pergola för en sittgrupp' },
    { max: 10, text: '\u{1F4A1} Rymlig pergola för matplats och umgänge' },
    { max: Infinity, text: '\u{1F4A1} Stor pergola — perfekt för trädgårdsfester' }
  ],

  ui: {
    sliders: [
      { nyckel: 'b', etikett: 'Bredd', enhet: 'm', format: function (v) { return v + ' m'; } },
      { nyckel: 'l', etikett: 'Djup',  enhet: 'm', format: function (v) { return v + ' m'; } }
    ],
    avancerat: [
      { nyckel: 'h', etikett: 'Höjd', enhet: 'cm', format: function (v) { return Math.round(v * 100) + ' cm'; } }
    ],
    visaYta: true,
    ytaEtikett: 'Yta',
    sektionstyp: 'pergola'
  },

  // -----------------------------------------------------------
  // KONSTRUKTIONSPARAMETRAR
  // -----------------------------------------------------------
  struktur: {
    stolpDim: 0.12,        // 120x120 mm stolpar
    balkDim: [0.045, 0.195], // 45x195 mm barbalkar
    spjalDim: [0.045, 0.070], // 45x70 mm spjalor
    spjalCC: 0.15,         // c/c 150 mm spjalor
    maxStolpCC: 2.5        // Max 2.5 m mellan stolpar
  },

  // -----------------------------------------------------------
  // TILLAMPA — berakna harledda varden
  // -----------------------------------------------------------
  tillampa: function (design) {
    var regler = this;
    var s = regler.struktur;
    var berakning = { perSektion: {} };

    for (var si = 0; si < design.sektioner.length; si++) {
      var sek = design.sektioner[si];

      sek.b = ByggRegler.klamma(sek.b, regler.dim.b.min, regler.dim.b.max, regler.dim.b.steg);
      sek.l = ByggRegler.klamma(sek.l, regler.dim.l.min, regler.dim.l.max, regler.dim.l.steg);

      var h = sek.egenskaper.h !== undefined
        ? ByggRegler.klamma(sek.egenskaper.h, regler.dim.h.min, regler.dim.h.max, regler.dim.h.steg)
        : 2.4;
      sek.egenskaper.h = h;

      var b = sek.b, l = sek.l;

      // Stolppositioner
      var stolpPosB = [0, b];
      if (b > s.maxStolpCC) {
        var nMellan = Math.ceil(b / s.maxStolpCC) - 1;
        var avst = b / (nMellan + 1);
        for (var i = 1; i <= nMellan; i++) {
          stolpPosB.push(parseFloat((i * avst).toFixed(3)));
        }
        stolpPosB.sort(function (a, b2) { return a - b2; });
      }

      var stolpPosL = [0, l];
      if (l > s.maxStolpCC) {
        var nMellanL = Math.ceil(l / s.maxStolpCC) - 1;
        var avstL = l / (nMellanL + 1);
        for (var j = 1; j <= nMellanL; j++) {
          stolpPosL.push(parseFloat((j * avstL).toFixed(3)));
        }
        stolpPosL.sort(function (a, b2) { return a - b2; });
      }

      berakning.perSektion[sek.id] = {
        h: h,
        stolpDim: s.stolpDim,
        stolpPosB: stolpPosB,
        stolpPosL: stolpPosL,
        balkDim: s.balkDim,
        spjalDim: s.spjalDim,
        spjalCC: s.spjalCC
      };
    }

    berakning.bounds = DesignModell.bounds(design);
    berakning.totalYta = design.sektioner.reduce(function (sum, sek) {
      return sum + sek.b * sek.l;
    }, 0);

    return { berakning: berakning };
  }
});
