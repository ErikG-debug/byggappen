// ============================================================
// PROJEKT-DATA
// ============================================================
//
// ATT LAGGA TILL ETT NYTT PROJEKT:
//
// 1. projekt-data.js — Lagg till i `projekt`-objektet:
//    { namn, ikon, beskrivning, sammanfattning, nyckelord, kommande,
//      tid, svarighetsgrad, personer, steg[], verktyg, material }
//
// 2. regler.js — Registrera regler:
//    ByggRegler.registrera('mittProjekt', {
//      dim, standard, lager, ytaTips, ui, struktur, tillampa()
//    })
//
// 3. generator.js — Registrera sektionstyp + standarddesign:
//    ByggGenerator.registreraSektionstyp('typnamn', function(...) {...})
//    ByggGenerator.registreraStandardDesign('mittProjekt', function(...) {...})
//
// 4. bygg3d.js — Lagg till material i PALETTER (om nya material behovs)
//
// Inget annat behovs — sokbara, lager, preview genereras automatiskt.
//
// ============================================================

// ============================================================
// ILLUSTRATIONER (SVG) — en per steg
// ============================================================

const svgLekstuga = [
  // Steg 1 — Markarbete och utstakning
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="s1arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6Z" fill="#2563eb"/></marker>
      <marker id="s1dim" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6Z" fill="#333"/></marker>
    </defs>
    <rect width="260" height="180" fill="#fff"/>
    <!-- Isometrisk markyta -->
    <polygon points="50,130 130,90 210,130 130,170" fill="#f0f0f0" stroke="#333" stroke-width="1.5"/>
    <!-- Grävd ursparning (mörkare) -->
    <polygon points="65,130 130,100 195,130 130,160" fill="#e8e8e8" stroke="#333" stroke-width="1" stroke-dasharray="5,3"/>
    <!-- Hörnpinnar -->
    <line x1="65" y1="125" x2="65" y2="135" stroke="#333" stroke-width="2"/>
    <line x1="195" y1="125" x2="195" y2="135" stroke="#333" stroke-width="2"/>
    <line x1="130" y1="95" x2="130" y2="105" stroke="#333" stroke-width="2"/>
    <line x1="130" y1="155" x2="130" y2="165" stroke="#333" stroke-width="2"/>
    <!-- Streckad röd markering (snöre) -->
    <polygon points="65,130 130,100 195,130 130,160" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="6,3"/>
    <circle cx="65" cy="130" r="4" fill="#dc2626"/>
    <circle cx="195" cy="130" r="4" fill="#dc2626"/>
    <circle cx="130" cy="100" r="4" fill="#dc2626"/>
    <circle cx="130" cy="160" r="4" fill="#dc2626"/>
    <!-- Måttpilar -->
    <line x1="65" y1="76" x2="195" y2="76" stroke="#333" stroke-width="1" marker-start="url(#s1dim)" marker-end="url(#s1dim)"/>
    <text x="130" y="72" text-anchor="middle" font-size="10" fill="#333">200 cm</text>
    <!-- Blå pil ner i grävd yta -->
    <line x1="160" y1="108" x2="160" y2="125" stroke="#2563eb" stroke-width="2" marker-end="url(#s1arr)"/>
    <text x="175" y="113" font-size="9" fill="#2563eb">10 cm</text>
    <!-- Makadam-textur -->
    <circle cx="110" cy="128" r="2" fill="none" stroke="#333" stroke-width="0.5"/>
    <circle cx="120" cy="135" r="2.5" fill="none" stroke="#333" stroke-width="0.5"/>
    <circle cx="140" cy="130" r="2" fill="none" stroke="#333" stroke-width="0.5"/>
    <circle cx="150" cy="138" r="1.5" fill="none" stroke="#333" stroke-width="0.5"/>
    <circle cx="130" cy="142" r="2" fill="none" stroke="#333" stroke-width="0.5"/>
  </svg>`,

  // Steg 2 — Gjut eller placera grundplintar
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="s2dim" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6Z" fill="#333"/></marker>
    </defs>
    <rect width="260" height="180" fill="#fff"/>
    <!-- Grusyta isometrisk -->
    <polygon points="50,130 130,90 210,130 130,170" fill="#f0f0f0" stroke="#333" stroke-width="1"/>
    <!-- Plint ① vänster -->
    <polygon points="62,127 75,121 88,127 75,133" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <polygon points="62,127 62,120 75,114 75,121" fill="#fff" stroke="#333" stroke-width="1.5"/>
    <polygon points="88,127 88,120 75,114 75,121" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <circle cx="75" cy="121" r="4" fill="#dc2626"/><text x="75" y="113" text-anchor="middle" font-size="9" fill="#333">①</text>
    <!-- Plint ② bak -->
    <polygon points="122,97 135,91 148,97 135,103" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <polygon points="122,97 122,90 135,84 135,91" fill="#fff" stroke="#333" stroke-width="1.5"/>
    <polygon points="148,97 148,90 135,84 135,91" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <circle cx="135" cy="91" r="4" fill="#dc2626"/><text x="135" y="83" text-anchor="middle" font-size="9" fill="#333">②</text>
    <!-- Plint ③ höger -->
    <polygon points="172,127 185,121 198,127 185,133" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <polygon points="172,127 172,120 185,114 185,121" fill="#fff" stroke="#333" stroke-width="1.5"/>
    <polygon points="198,127 198,120 185,114 185,121" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <circle cx="185" cy="121" r="4" fill="#dc2626"/><text x="185" y="113" text-anchor="middle" font-size="9" fill="#333">③</text>
    <!-- Plint ④ fram -->
    <polygon points="122,157 135,151 148,157 135,163" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <polygon points="122,157 122,150 135,144 135,151" fill="#fff" stroke="#333" stroke-width="1.5"/>
    <polygon points="148,157 148,150 135,144 135,151" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <circle cx="135" cy="151" r="4" fill="#dc2626"/><text x="135" y="143" text-anchor="middle" font-size="9" fill="#333">④</text>
    <!-- Vattenpass (grön) -->
    <rect x="85" y="25" width="90" height="8" rx="3" fill="#d4edda" stroke="#2b6a3a" stroke-width="1"/>
    <circle cx="130" cy="29" r="3" fill="none" stroke="#2b6a3a" stroke-width="1"/><circle cx="130" cy="29" r="1" fill="#2b6a3a"/>
    <text x="130" y="21" text-anchor="middle" font-size="9" fill="#333">Kontrollera vater</text>
    <!-- Måttlinje -->
    <line x1="75" y1="74" x2="185" y2="74" stroke="#333" stroke-width="1" stroke-dasharray="5,3" marker-start="url(#s2dim)" marker-end="url(#s2dim)"/>
    <text x="130" y="70" text-anchor="middle" font-size="10" fill="#333">200 cm</text>
  </svg>`,

  // Steg 3 — Bygg grundramen (explosionsvy)
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="s3arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6Z" fill="#2563eb"/></marker>
    </defs>
    <rect width="260" height="180" fill="#fff"/>
    <!-- Vänster regel (svävar ut) -->
    <polygon points="30,135 40,130 40,95 30,100" fill="#fff" stroke="#333" stroke-width="1.5"/>
    <polygon points="40,130 55,123 55,88 40,95" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <!-- Höger regel (svävar ut) -->
    <polygon points="205,135 215,130 215,95 205,100" fill="#fff" stroke="#333" stroke-width="1.5"/>
    <polygon points="215,130 230,123 230,88 215,95" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <!-- Bakre regel (svävar ut) -->
    <polygon points="55,78 130,48 205,78 130,108" fill="none" stroke="#333" stroke-width="1.5"/>
    <polygon points="55,78 55,72 130,42 130,48" fill="#fff" stroke="#333" stroke-width="1.5"/>
    <polygon points="205,78 205,72 130,42 130,48" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <!-- Främre regel (svävar ut) -->
    <polygon points="55,158 130,128 205,158 130,170" fill="none" stroke="#333" stroke-width="1.5"/>
    <polygon points="55,158 55,152 130,122 130,128" fill="#fff" stroke="#333" stroke-width="1.5"/>
    <polygon points="205,158 205,152 130,122 130,128" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <!-- Blå monteringspilar -->
    <line x1="42" y1="110" x2="55" y2="117" stroke="#2563eb" stroke-width="2" marker-end="url(#s3arr)"/>
    <line x1="220" y1="110" x2="207" y2="117" stroke="#2563eb" stroke-width="2" marker-end="url(#s3arr)"/>
    <line x1="130" y1="60" x2="130" y2="72" stroke="#2563eb" stroke-width="2" marker-end="url(#s3arr)"/>
    <line x1="130" y1="150" x2="130" y2="140" stroke="#2563eb" stroke-width="2" marker-end="url(#s3arr)"/>
    <!-- Röda skruvpunkter i hörnen -->
    <circle cx="55" cy="123" r="4" fill="#dc2626"/>
    <circle cx="205" cy="123" r="4" fill="#dc2626"/>
    <circle cx="130" cy="78" r="4" fill="#dc2626"/>
    <circle cx="130" cy="155" r="4" fill="#dc2626"/>
    <!-- Diagonal streckad -->
    <line x1="55" y1="123" x2="205" y2="78" stroke="#333" stroke-width="1" stroke-dasharray="5,3"/>
    <text x="140" y="95" font-size="9" fill="#333">283 cm</text>
    <!-- Etikett -->
    <text x="130" y="14" text-anchor="middle" font-size="10" fill="#333">45×95 mm</text>
  </svg>`,

  // Steg 4 — Lägg golvreglar (bjälklag)
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="s4arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6Z" fill="#2563eb"/></marker>
    </defs>
    <rect width="260" height="180" fill="#fff"/>
    <!-- Yttre ram (monterad, sett uppifrån isometrisk) -->
    <polygon points="50,120 130,80 210,120 130,160" fill="none" stroke="#333" stroke-width="2"/>
    <!-- Mellanreglar c/c 500 -->
    <!-- Regel 1 -->
    <line x1="70" y1="130" x2="150" y2="90" stroke="#333" stroke-width="2"/>
    <line x1="72" y1="131" x2="152" y2="91" stroke="#e8e8e8" stroke-width="1"/>
    <!-- Regel 2 -->
    <line x1="90" y1="140" x2="170" y2="100" stroke="#333" stroke-width="2"/>
    <!-- Regel 3 -->
    <line x1="110" y1="150" x2="190" y2="110" stroke="#333" stroke-width="2"/>
    <!-- Blå pilar (reglar läggs ner) -->
    <line x1="80" y1="120" x2="80" y2="132" stroke="#2563eb" stroke-width="2" marker-end="url(#s4arr)"/>
    <line x1="100" y1="125" x2="100" y2="138" stroke="#2563eb" stroke-width="2" marker-end="url(#s4arr)"/>
    <line x1="120" y1="132" x2="120" y2="145" stroke="#2563eb" stroke-width="2" marker-end="url(#s4arr)"/>
    <!-- c/c-linjer streckade -->
    <line x1="70" y1="74" x2="90" y2="74" stroke="#333" stroke-width="1" stroke-dasharray="3,2"/>
    <text x="80" y="70" text-anchor="middle" font-size="9" fill="#333">c/c 500</text>
    <!-- Röda skruvpunkter -->
    <circle cx="70" cy="130" r="3" fill="#dc2626"/>
    <circle cx="150" cy="90" r="3" fill="#dc2626"/>
    <circle cx="90" cy="140" r="3" fill="#dc2626"/>
    <circle cx="170" cy="100" r="3" fill="#dc2626"/>
    <circle cx="110" cy="150" r="3" fill="#dc2626"/>
    <circle cx="190" cy="110" r="3" fill="#dc2626"/>
    <!-- Inzoomad detalj: vinkelskruvning -->
    <rect x="10" y="10" width="60" height="50" rx="3" fill="#fff" stroke="#333" stroke-width="1"/>
    <line x1="15" y1="45" x2="65" y2="45" stroke="#333" stroke-width="2"/>
    <line x1="40" y1="45" x2="40" y2="20" stroke="#333" stroke-width="2"/>
    <line x1="38" y1="40" x2="30" y2="48" stroke="#2563eb" stroke-width="1.5"/>
    <circle cx="30" cy="48" r="2" fill="#dc2626"/>
    <text x="40" y="16" text-anchor="middle" font-size="8" fill="#333">Vinkelskruv</text>
  </svg>`,

  // Steg 5 — Lägg golvbräder
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="s5arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6Z" fill="#2563eb"/></marker>
    </defs>
    <rect width="260" height="180" fill="#fff"/>
    <!-- Ram+bjälklag tunna linjer -->
    <polygon points="50,120 130,80 210,120 130,160" fill="none" stroke="#333" stroke-width="1" opacity="0.4"/>
    <line x1="70" y1="130" x2="150" y2="90" stroke="#333" stroke-width="0.5" opacity="0.4"/>
    <line x1="90" y1="140" x2="170" y2="100" stroke="#333" stroke-width="0.5" opacity="0.4"/>
    <line x1="110" y1="150" x2="190" y2="110" stroke="#333" stroke-width="0.5" opacity="0.4"/>
    <!-- Lagda bräder (vänster→höger, halva på plats) -->
    <polygon points="52,119 90,100 93,101 55,120" fill="#e8e8e8" stroke="#333" stroke-width="1"/>
    <polygon points="56,121 94,102 97,103 59,122" fill="#f0f0f0" stroke="#333" stroke-width="1"/>
    <polygon points="60,123 98,104 101,105 63,124" fill="#e8e8e8" stroke="#333" stroke-width="1"/>
    <polygon points="64,125 102,106 105,107 67,126" fill="#f0f0f0" stroke="#333" stroke-width="1"/>
    <polygon points="68,127 106,108 109,109 71,128" fill="#e8e8e8" stroke="#333" stroke-width="1"/>
    <polygon points="72,129 110,110 113,111 75,130" fill="#f0f0f0" stroke="#333" stroke-width="1"/>
    <!-- Nästa bräda svävar -->
    <polygon points="82,128 120,109 123,110 85,129" fill="#e8e8e8" stroke="#333" stroke-width="1.5" stroke-dasharray="3,2"/>
    <!-- Blå pil för svävande bräda -->
    <line x1="110" y1="112" x2="105" y2="115" stroke="#2563eb" stroke-width="2" marker-end="url(#s5arr)"/>
    <!-- 5mm callout -->
    <line x1="73" y1="126" x2="76" y2="124" stroke="#333" stroke-width="1"/>
    <text x="82" y="122" font-size="9" fill="#333">5 mm</text>
    <!-- Röda skruvpunkter -->
    <circle cx="56" cy="119" r="2.5" fill="#dc2626"/>
    <circle cx="60" cy="121" r="2.5" fill="#dc2626"/>
    <circle cx="64" cy="123" r="2.5" fill="#dc2626"/>
    <circle cx="68" cy="125" r="2.5" fill="#dc2626"/>
    <!-- Spackelikon -->
    <rect x="200" y="145" width="25" height="6" rx="1" fill="#e8e8e8" stroke="#333" stroke-width="1"/>
    <text x="212" y="160" text-anchor="middle" font-size="8" fill="#333">spacer</text>
  </svg>`,

  // Steg 6 — Bygg väggramar — långväggar
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <rect width="260" height="180" fill="#fff"/>
    <!-- Väggram liggande platt (isometrisk) -->
    <!-- Syll (botten) ① -->
    <polygon points="20,155 130,115 240,155 130,168" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <text x="20" y="170" font-size="9" fill="#333">①syll</text>
    <!-- Hammarband (topp) ② -->
    <polygon points="20,85 130,45 240,85 130,98" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <text x="20" y="80" font-size="9" fill="#333">②hammarband</text>
    <!-- Vertikala reglar ③ c/c 600 -->
    <line x1="50" y1="147" x2="50" y2="93" stroke="#333" stroke-width="2"/>
    <line x1="86" y1="135" x2="86" y2="81" stroke="#333" stroke-width="2"/>
    <line x1="122" y1="123" x2="122" y2="69" stroke="#333" stroke-width="2"/>
    <line x1="158" y1="135" x2="158" y2="81" stroke="#333" stroke-width="2"/>
    <line x1="194" y1="147" x2="194" y2="93" stroke="#333" stroke-width="2"/>
    <text x="240" y="75" font-size="9" fill="#333">③ståndare</text>
    <!-- c/c 600 pilar -->
    <line x1="50" y1="40" x2="86" y2="40" stroke="#333" stroke-width="1"/>
    <text x="68" y="36" text-anchor="middle" font-size="9" fill="#333">c/c 600</text>
    <!-- Diagonalstag streckad -->
    <line x1="50" y1="147" x2="158" y2="81" stroke="#333" stroke-width="1" stroke-dasharray="5,3"/>
    <!-- Dörröppning röd streckad -->
    <rect x="86" y="99" width="36" height="36" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="4,3"/>
    <text x="104" y="122" text-anchor="middle" font-size="8" fill="#dc2626">Dörr</text>
    <text x="104" y="131" text-anchor="middle" font-size="7" fill="#dc2626">80×150</text>
    <!-- Andra ramen ghostad bakom -->
    <polygon points="25,150 135,110 245,150 135,163" fill="none" stroke="#333" stroke-width="0.5" opacity="0.3"/>
    <polygon points="25,80 135,40 245,80 135,93" fill="none" stroke="#333" stroke-width="0.5" opacity="0.3"/>
  </svg>`,

  // Steg 7 — Bygg väggramar — gavelväggarna
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <rect width="260" height="180" fill="#fff"/>
    <!-- Pentagonal väggram (rektangel + triangel för 30° takvinkel) -->
    <!-- Yttre ram -->
    <polygon points="40,165 40,80 130,40 220,80 220,165" fill="none" stroke="#333" stroke-width="2"/>
    <!-- Botten syll -->
    <line x1="40" y1="165" x2="220" y2="165" stroke="#333" stroke-width="2"/>
    <!-- Vertikala reglar -->
    <line x1="40" y1="165" x2="40" y2="80" stroke="#333" stroke-width="2"/>
    <line x1="100" y1="165" x2="100" y2="55" stroke="#333" stroke-width="1.5"/>
    <line x1="130" y1="165" x2="130" y2="40" stroke="#333" stroke-width="2"/>
    <line x1="160" y1="165" x2="160" y2="55" stroke="#333" stroke-width="1.5"/>
    <line x1="220" y1="165" x2="220" y2="80" stroke="#333" stroke-width="2"/>
    <!-- Mittregel längre (nock) -->
    <circle cx="130" cy="40" r="4" fill="#dc2626"/>
    <!-- Vinkelmarkör 30° blå -->
    <path d="M220,80 L200,80 L207,68" fill="none" stroke="#2563eb" stroke-width="1.5"/>
    <text x="193" y="76" font-size="10" fill="#2563eb">30°</text>
    <!-- Fönsteröppning röd streckad -->
    <rect x="145" y="100" width="45" height="45" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="4,3"/>
    <text x="167" y="127" text-anchor="middle" font-size="8" fill="#dc2626">Fönster</text>
    <text x="167" y="137" text-anchor="middle" font-size="7" fill="#dc2626">60×60</text>
    <!-- Numrering -->
    <text x="50" y="170" font-size="9" fill="#333">①syll</text>
    <text x="50" y="78" font-size="9" fill="#333">②ståndare</text>
    <text x="130" y="30" text-anchor="middle" font-size="9" fill="#333">③nock</text>
    <!-- Inzoomad detalj: 30°-kap -->
    <rect x="5" y="5" width="55" height="40" rx="3" fill="#fff" stroke="#333" stroke-width="1"/>
    <line x1="10" y1="35" x2="50" y2="35" stroke="#333" stroke-width="2"/>
    <line x1="50" y1="35" x2="35" y2="12" stroke="#333" stroke-width="2"/>
    <text x="30" y="30" font-size="8" fill="#2563eb">30°</text>
  </svg>`,

  // Steg 8 — Res och montera väggarna
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="s8arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6Z" fill="#2563eb"/></marker>
    </defs>
    <rect width="260" height="180" fill="#fff"/>
    <!-- Golv (tunna linjer) -->
    <polygon points="50,155 130,125 210,155 130,170" fill="#f0f0f0" stroke="#333" stroke-width="1" opacity="0.5"/>
    <!-- En vägg står (vänster långvägg) -->
    <polygon points="50,155 50,85 95,68 95,138" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <line x1="60" y1="150" x2="60" y2="88" stroke="#333" stroke-width="1"/>
    <line x1="70" y1="145" x2="70" y2="84" stroke="#333" stroke-width="1"/>
    <line x1="80" y1="140" x2="80" y2="78" stroke="#333" stroke-width="1"/>
    <!-- Röda skruvar längs syll -->
    <circle cx="55" cy="153" r="3" fill="#dc2626"/>
    <circle cx="70" cy="147" r="3" fill="#dc2626"/>
    <circle cx="85" cy="141" r="3" fill="#dc2626"/>
    <!-- Andra väggen lyfts (45° vinkel) -->
    <polygon points="160,155 200,155 200,110 160,110" fill="#e8e8e8" stroke="#333" stroke-width="1.5" opacity="0.7" transform="rotate(-35,180,155)"/>
    <!-- Stor böjd blå pil "Res!" -->
    <path d="M200,145 Q215,110 195,85" fill="none" stroke="#2563eb" stroke-width="2" marker-end="url(#s8arr)"/>
    <text x="218" y="110" font-size="10" fill="#2563eb" font-weight="bold">Res!</text>
    <!-- Tillfälligt diagonalstag streckad -->
    <line x1="55" y1="150" x2="80" y2="85" stroke="#333" stroke-width="1.5" stroke-dasharray="5,3"/>
    <text x="45" y="78" font-size="8" fill="#333">stag</text>
    <!-- Gavelväggarna ghostade -->
    <polygon points="95,138 130,80 130,155" fill="none" stroke="#333" stroke-width="0.7" opacity="0.25" stroke-dasharray="4,3"/>
    <polygon points="50,155 95,100 95,155" fill="none" stroke="#333" stroke-width="0.7" opacity="0.25" stroke-dasharray="4,3"/>
  </svg>`,

  // Steg 9 — Montera nockbräda och takstolar
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="s9arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6Z" fill="#2563eb"/></marker>
    </defs>
    <rect width="260" height="180" fill="#fff"/>
    <!-- Väggar i tunna linjer -->
    <polygon points="40,155 40,95 130,65 130,125" fill="none" stroke="#333" stroke-width="1" opacity="0.4"/>
    <polygon points="220,155 220,95 130,65 130,125" fill="none" stroke="#333" stroke-width="1" opacity="0.4"/>
    <line x1="40" y1="155" x2="220" y2="155" stroke="#333" stroke-width="1" opacity="0.4"/>
    <!-- Gavelspetsar -->
    <line x1="40" y1="95" x2="85" y2="68" stroke="#333" stroke-width="1.5"/>
    <line x1="85" y1="68" x2="130" y2="95" stroke="#333" stroke-width="1.5"/>
    <!-- Nockbräda svävar (①) -->
    <line x1="85" y1="45" x2="175" y2="45" stroke="#333" stroke-width="3"/>
    <line x1="85" y1="42" x2="175" y2="42" stroke="#e8e8e8" stroke-width="2"/>
    <text x="130" y="38" text-anchor="middle" font-size="9" fill="#333">①nockbräda</text>
    <!-- Blå pil ner från nockbräda -->
    <line x1="130" y1="50" x2="130" y2="62" stroke="#2563eb" stroke-width="2" marker-end="url(#s9arr)"/>
    <!-- Takstol monterad (triangel) -->
    <polygon points="55,125 85,78 115,125" fill="none" stroke="#333" stroke-width="2"/>
    <!-- Takstol svävar ner (②) -->
    <polygon points="95,100 125,55 155,100" fill="none" stroke="#333" stroke-width="1.5" stroke-dasharray="4,3"/>
    <line x1="125" y1="62" x2="125" y2="72" stroke="#2563eb" stroke-width="2" marker-end="url(#s9arr)"/>
    <text x="165" y="72" font-size="9" fill="#333">②takstol</text>
    <!-- Tredje takstol ghostad -->
    <polygon points="135,125 165,78 195,125" fill="none" stroke="#333" stroke-width="0.7" opacity="0.3" stroke-dasharray="4,3"/>
    <!-- c/c 600 -->
    <line x1="85" y1="132" x2="165" y2="132" stroke="#333" stroke-width="1"/>
    <text x="125" y="142" text-anchor="middle" font-size="9" fill="#333">c/c 600</text>
  </svg>`,

  // Steg 10 — Lägg takunderlag (råspont + takpapp)
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="s10arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6Z" fill="#2563eb"/></marker>
    </defs>
    <rect width="260" height="180" fill="#fff"/>
    <!-- Husets stomme i tunna linjer -->
    <polygon points="40,145 40,90 130,60 220,90 220,145" fill="none" stroke="#333" stroke-width="1" opacity="0.4"/>
    <line x1="40" y1="145" x2="220" y2="145" stroke="#333" stroke-width="1" opacity="0.4"/>
    <!-- Nock -->
    <line x1="85" y1="60" x2="175" y2="60" stroke="#333" stroke-width="2"/>
    <!-- Vänstra takplanet — fullt av brädor (horisontella linjer) -->
    <polygon points="35,92 85,60 175,60 125,92" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <line x1="40" y1="89" x2="170" y2="61" stroke="#333" stroke-width="0.5"/>
    <line x1="43" y1="86" x2="165" y2="62" stroke="#333" stroke-width="0.5"/>
    <line x1="46" y1="83" x2="160" y2="63" stroke="#333" stroke-width="0.5"/>
    <line x1="49" y1="80" x2="155" y2="64" stroke="#333" stroke-width="0.5"/>
    <!-- Högra takplanet — halvfärdigt -->
    <!-- Nedre brädor -->
    <polygon points="175,60 225,92 225,82 175,60" fill="#e8e8e8" stroke="#333" stroke-width="1"/>
    <polygon points="175,60 225,80 225,75 175,60" fill="#f0f0f0" stroke="#333" stroke-width="0.7"/>
    <!-- Övre visar takstolar i streck -->
    <line x1="185" y1="68" x2="225" y2="92" stroke="#333" stroke-width="1" stroke-dasharray="5,3"/>
    <line x1="195" y1="63" x2="225" y2="82" stroke="#333" stroke-width="1" stroke-dasharray="5,3"/>
    <!-- Blå pil uppåt längs tak -->
    <line x1="230" y1="95" x2="200" y2="68" stroke="#2563eb" stroke-width="2" marker-end="url(#s10arr)"/>
    <text x="238" y="80" font-size="9" fill="#2563eb">↑</text>
    <!-- Callout utsprång -->
    <line x1="30" y1="92" x2="38" y2="92" stroke="#333" stroke-width="2"/>
    <text x="18" y="100" font-size="8" fill="#333">10 cm</text>
    <!-- Takpapprulle nertill -->
    <ellipse cx="50" cy="160" rx="12" ry="8" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <ellipse cx="50" cy="160" rx="5" ry="3" fill="#fff" stroke="#333" stroke-width="1"/>
    <text x="50" y="175" text-anchor="middle" font-size="8" fill="#333">takpapp</text>
  </svg>`,

  // Steg 11 — Lägg taktäckning
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="s11arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6Z" fill="#2563eb"/></marker>
    </defs>
    <rect width="260" height="180" fill="#fff"/>
    <!-- Hus med bar stomme (väggar syns) -->
    <polygon points="40,145 40,90 130,55 220,90 220,145" fill="none" stroke="#333" stroke-width="1" opacity="0.4"/>
    <line x1="40" y1="145" x2="220" y2="145" stroke="#333" stroke-width="1" opacity="0.4"/>
    <!-- Vänstra takplanet med korrugerad plåt (vågiga linjer) -->
    <polygon points="35,92 85,55 175,55 125,92" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <path d="M38,90 Q42,88 46,90 Q50,92 54,90 Q58,88 62,90 Q66,92 70,90 Q74,88 78,90 Q82,92 86,90 Q90,88 94,90 Q98,92 102,90 Q106,88 110,90 Q114,92 118,90 Q122,88 125,90" fill="none" stroke="#333" stroke-width="0.7"/>
    <path d="M50,84 Q54,82 58,84 Q62,86 66,84 Q70,82 74,84 Q78,86 82,84 Q86,82 90,84 Q94,86 98,84 Q102,82 106,84 Q110,86 114,84 Q118,82 122,84 Q126,86 130,84 Q134,82 138,84" fill="none" stroke="#333" stroke-width="0.7"/>
    <path d="M62,78 Q66,76 70,78 Q74,80 78,78 Q82,76 86,78 Q90,80 94,78 Q98,76 102,78 Q106,80 110,78 Q114,76 118,78 Q122,80 126,78 Q130,76 134,78 Q138,80 142,78 Q146,76 150,78" fill="none" stroke="#333" stroke-width="0.7"/>
    <!-- Högra takplanet med korrugerad plåt -->
    <polygon points="175,55 225,92 135,92 85,55" fill="#f0f0f0" stroke="#333" stroke-width="1.5"/>
    <path d="M135,90 Q139,88 143,90 Q147,92 151,90 Q155,88 159,90 Q163,92 167,90 Q171,88 175,90 Q179,92 183,90 Q187,88 191,90 Q195,92 199,90 Q203,88 207,90 Q211,92 215,90 Q219,88 223,90" fill="none" stroke="#333" stroke-width="0.7"/>
    <path d="M120,84 Q124,82 128,84 Q132,86 136,84 Q140,82 144,84 Q148,86 152,84 Q156,82 160,84 Q164,86 168,84 Q172,82 176,84 Q180,86 184,84 Q188,82 192,84 Q196,86 200,84 Q204,82 208,84" fill="none" stroke="#333" stroke-width="0.7"/>
    <!-- Nockplåt svävar -->
    <rect x="75" y="38" width="110" height="8" rx="2" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <line x1="130" y1="48" x2="130" y2="53" stroke="#2563eb" stroke-width="2" marker-end="url(#s11arr)"/>
    <text x="130" y="34" text-anchor="middle" font-size="9" fill="#333">nockplåt</text>
    <!-- Röda skruvpunkter i vågdalar -->
    <circle cx="42" cy="90" r="2.5" fill="#dc2626"/>
    <circle cx="54" cy="90" r="2.5" fill="#dc2626"/>
    <circle cx="66" cy="90" r="2.5" fill="#dc2626"/>
    <circle cx="78" cy="90" r="2.5" fill="#dc2626"/>
    <!-- Inzoomad detalj: skruv med gummibricka -->
    <rect x="190" y="110" width="60" height="45" rx="3" fill="#fff" stroke="#333" stroke-width="1"/>
    <line x1="220" y1="140" x2="220" y2="125" stroke="#333" stroke-width="2"/>
    <circle cx="220" cy="124" r="4" fill="#e8e8e8" stroke="#333" stroke-width="1"/>
    <ellipse cx="220" cy="128" rx="6" ry="2" fill="#e8e8e8" stroke="#333" stroke-width="0.7"/>
    <text x="220" y="150" text-anchor="middle" font-size="7" fill="#333">gummibricka</text>
  </svg>`,

  // Steg 12 — Klä väggarna med locklistpanel
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="s12arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6Z" fill="#2563eb"/></marker>
    </defs>
    <rect width="260" height="180" fill="#fff"/>
    <!-- Tak klart (tunna linjer) -->
    <polygon points="35,82 130,45 225,82" fill="none" stroke="#333" stroke-width="1" opacity="0.4"/>
    <!-- Framsida helt panelklädd (vertikala linjer) -->
    <rect x="35" y="82" width="95" height="75" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <line x1="48" y1="82" x2="48" y2="157" stroke="#333" stroke-width="1"/>
    <line x1="61" y1="82" x2="61" y2="157" stroke="#333" stroke-width="1"/>
    <line x1="74" y1="82" x2="74" y2="157" stroke="#333" stroke-width="1"/>
    <line x1="87" y1="82" x2="87" y2="157" stroke="#333" stroke-width="1"/>
    <line x1="100" y1="82" x2="100" y2="157" stroke="#333" stroke-width="1"/>
    <line x1="113" y1="82" x2="113" y2="157" stroke="#333" stroke-width="1"/>
    <!-- Dörröppning -->
    <rect x="55" y="107" width="30" height="50" fill="#fff" stroke="#333" stroke-width="1.5"/>
    <!-- Fönsteröppning -->
    <rect x="95" y="100" width="25" height="25" fill="#fff" stroke="#333" stroke-width="1.5"/>
    <!-- Sida halvklädd -->
    <polygon points="130,82 225,82 225,157 130,157" fill="none" stroke="#333" stroke-width="1" opacity="0.3"/>
    <!-- Nedre del panel -->
    <rect x="130" y="130" width="95" height="27" fill="#f0f0f0" stroke="#333" stroke-width="1"/>
    <line x1="143" y1="130" x2="143" y2="157" stroke="#333" stroke-width="0.7"/>
    <line x1="156" y1="130" x2="156" y2="157" stroke="#333" stroke-width="0.7"/>
    <line x1="169" y1="130" x2="169" y2="157" stroke="#333" stroke-width="0.7"/>
    <!-- Övre visar stomme -->
    <line x1="140" y1="82" x2="140" y2="130" stroke="#333" stroke-width="1" stroke-dasharray="5,3"/>
    <line x1="160" y1="82" x2="160" y2="130" stroke="#333" stroke-width="1" stroke-dasharray="5,3"/>
    <line x1="180" y1="82" x2="180" y2="130" stroke="#333" stroke-width="1" stroke-dasharray="5,3"/>
    <!-- Panel svävar med blå pil -->
    <rect x="184" y="100" width="8" height="55" fill="#e8e8e8" stroke="#333" stroke-width="1.5" stroke-dasharray="3,2"/>
    <line x1="192" y1="127" x2="186" y2="127" stroke="#2563eb" stroke-width="2" marker-end="url(#s12arr)"/>
    <!-- Röda skruvpunkter -->
    <circle cx="186" cy="110" r="2.5" fill="#dc2626"/>
    <circle cx="186" cy="140" r="2.5" fill="#dc2626"/>
    <!-- Nedifrån upp med pil -->
    <line x1="240" y1="155" x2="240" y2="90" stroke="#2563eb" stroke-width="2" marker-end="url(#s12arr)"/>
    <text x="248" y="125" font-size="8" fill="#2563eb" transform="rotate(-90,248,125)">Nedifrån upp</text>
  </svg>`,

  // Steg 13 — Montera dörr och fönster
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="s13arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6Z" fill="#2563eb"/></marker>
    </defs>
    <rect width="260" height="180" fill="#fff"/>
    <!-- Vägg (närbild/zoom) -->
    <rect x="10" y="30" width="180" height="140" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <!-- Panellinjer -->
    <line x1="25" y1="30" x2="25" y2="170" stroke="#333" stroke-width="0.7"/>
    <line x1="40" y1="30" x2="40" y2="170" stroke="#333" stroke-width="0.7"/>
    <line x1="55" y1="30" x2="55" y2="170" stroke="#333" stroke-width="0.7"/>
    <line x1="140" y1="30" x2="140" y2="170" stroke="#333" stroke-width="0.7"/>
    <line x1="155" y1="30" x2="155" y2="170" stroke="#333" stroke-width="0.7"/>
    <line x1="170" y1="30" x2="170" y2="170" stroke="#333" stroke-width="0.7"/>
    <!-- Fönster monterat (①) -->
    <rect x="20" y="55" width="50" height="50" fill="#f0f0f0" stroke="#333" stroke-width="2"/>
    <line x1="45" y1="55" x2="45" y2="105" stroke="#333" stroke-width="1"/>
    <line x1="20" y1="80" x2="70" y2="80" stroke="#333" stroke-width="1"/>
    <text x="45" y="50" text-anchor="middle" font-size="8" fill="#333">①fönsterkarm</text>
    <!-- Skum runt fönsterkarm -->
    <rect x="17" y="52" width="56" height="56" fill="none" stroke="#dc2626" stroke-width="1" stroke-dasharray="3,2"/>
    <text x="78" y="68" font-size="7" fill="#dc2626">PU-skum</text>
    <!-- Dörröppning -->
    <rect x="90" y="60" width="55" height="110" fill="#fff" stroke="#333" stroke-width="1.5"/>
    <!-- Dörr exploderad (svävar utanför, ②) -->
    <rect x="195" y="55" width="50" height="105" fill="#f0f0f0" stroke="#333" stroke-width="2"/>
    <text x="220" y="48" text-anchor="middle" font-size="8" fill="#333">②dörr</text>
    <!-- Blå pilar från dörr mot öppning -->
    <line x1="193" y1="80" x2="150" y2="80" stroke="#2563eb" stroke-width="2" marker-end="url(#s13arr)"/>
    <line x1="193" y1="120" x2="150" y2="120" stroke="#2563eb" stroke-width="2" marker-end="url(#s13arr)"/>
    <line x1="193" y1="150" x2="150" y2="150" stroke="#2563eb" stroke-width="2" marker-end="url(#s13arr)"/>
    <!-- Gångjärnspositioner med röda cirklar (③) -->
    <circle cx="90" cy="75" r="4" fill="#dc2626"/>
    <circle cx="90" cy="115" r="4" fill="#dc2626"/>
    <circle cx="90" cy="155" r="4" fill="#dc2626"/>
    <text x="80" y="73" text-anchor="end" font-size="8" fill="#333">③gångjärn</text>
    <!-- Trycke (④) -->
    <circle cx="237" cy="115" r="4" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <line x1="237" y1="115" x2="248" y2="115" stroke="#333" stroke-width="2"/>
    <text x="248" y="126" font-size="7" fill="#333">④trycke</text>
  </svg>`,

  // Steg 14 — Slutförning och detaljer
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <rect width="260" height="180" fill="#fff"/>
    <!-- Komplett lekstuga isometrisk -->
    <!-- Golv -->
    <polygon points="50,145 130,115 210,145 130,165" fill="#f0f0f0" stroke="#333" stroke-width="1"/>
    <!-- Vänster vägg -->
    <polygon points="50,145 50,85 95,68 95,128" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <!-- Panel -->
    <line x1="58" y1="142" x2="58" y2="87" stroke="#333" stroke-width="0.5"/>
    <line x1="66" y1="139" x2="66" y2="84" stroke="#333" stroke-width="0.5"/>
    <line x1="74" y1="136" x2="74" y2="81" stroke="#333" stroke-width="0.5"/>
    <line x1="82" y1="133" x2="82" y2="78" stroke="#333" stroke-width="0.5"/>
    <!-- Höger vägg -->
    <polygon points="210,145 210,85 165,68 165,128" fill="#f0f0f0" stroke="#333" stroke-width="1.5"/>
    <line x1="202" y1="142" x2="202" y2="87" stroke="#333" stroke-width="0.5"/>
    <line x1="194" y1="139" x2="194" y2="84" stroke="#333" stroke-width="0.5"/>
    <line x1="186" y1="136" x2="186" y2="81" stroke="#333" stroke-width="0.5"/>
    <line x1="178" y1="133" x2="178" y2="78" stroke="#333" stroke-width="0.5"/>
    <!-- Fönster på höger vägg -->
    <rect x="177" y="90" width="22" height="22" fill="#f0f0f0" stroke="#333" stroke-width="1.5"/>
    <line x1="188" y1="90" x2="188" y2="112" stroke="#333" stroke-width="0.7"/>
    <line x1="177" y1="101" x2="199" y2="101" stroke="#333" stroke-width="0.7"/>
    <!-- Dörr på framsida -->
    <rect x="115" y="120" width="20" height="35" fill="#f0f0f0" stroke="#333" stroke-width="1.5"/>
    <circle cx="132" cy="138" r="2" fill="#333"/>
    <!-- Tak vänster -->
    <polygon points="45,85 95,55 130,68 50,85" fill="#e8e8e8" stroke="#333" stroke-width="1.5"/>
    <!-- Tak höger -->
    <polygon points="215,85 165,55 130,68 210,85" fill="#f0f0f0" stroke="#333" stroke-width="1.5"/>
    <!-- Nock -->
    <line x1="95" y1="55" x2="165" y2="55" stroke="#333" stroke-width="2"/>
    <!-- Nockplåt -->
    <rect x="93" y="53" width="74" height="5" rx="1" fill="#e8e8e8" stroke="#333" stroke-width="1"/>
    <!-- Vindskivor markerade med röda pilar -->
    <line x1="40" y1="85" x2="90" y2="55" stroke="#dc2626" stroke-width="2"/>
    <line x1="220" y1="85" x2="170" y2="55" stroke="#dc2626" stroke-width="2"/>
    <text x="30" y="75" font-size="8" fill="#dc2626">vindskiva</text>
    <!-- Hörnlister med röda cirklar -->
    <circle cx="50" cy="145" r="4" fill="#dc2626"/>
    <circle cx="210" cy="145" r="4" fill="#dc2626"/>
    <circle cx="95" cy="128" r="4" fill="#dc2626"/>
    <circle cx="165" cy="128" r="4" fill="#dc2626"/>
    <text x="220" y="150" font-size="8" fill="#dc2626">hörnlist</text>
    <!-- Checkmark -->
    <circle cx="235" cy="25" r="14" fill="none" stroke="#2563eb" stroke-width="2"/>
    <polyline points="226,25 233,32 245,18" fill="none" stroke="#2563eb" stroke-width="2.5"/>
  </svg>`
];

const svgAltan = [
  // Steg 1 - Markplanering
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <rect width="260" height="180" fill="#fff"/>
    <!-- Hus -->
    <rect x="20" y="40" width="70" height="80" fill="#e0e0e0" stroke="#999" stroke-width="2"/>
    <text x="55" y="85" text-anchor="middle" font-size="12" fill="#666">Hus</text>
    <!-- Altanyta -->
    <rect x="90" y="80" width="150" height="80" fill="#f5deb3" stroke="#8B4513" stroke-width="2" stroke-dasharray="6,3"/>
    <text x="165" y="124" text-anchor="middle" font-size="11" fill="#8B4513">Altanyta</text>
    <!-- Pilar -->
    <line x1="90" y1="170" x2="240" y2="170" stroke="#333" stroke-width="1.5"/>
    <text x="165" y="180" text-anchor="middle" font-size="11" fill="#333">400 cm</text>
    <line x1="250" y1="80" x2="250" y2="160" stroke="#333" stroke-width="1.5"/>
    <text x="258" y="124" text-anchor="middle" font-size="11" fill="#333" transform="rotate(90,258,124)">300 cm</text>
    <!-- Hörn-markeringar -->
    <circle cx="90" cy="80" r="5" fill="#e05"/>
    <circle cx="240" cy="80" r="5" fill="#e05"/>
    <circle cx="90" cy="160" r="5" fill="#e05"/>
    <circle cx="240" cy="160" r="5" fill="#e05"/>
  </svg>`,

  // Steg 2 - Grundstolpar
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <rect width="260" height="180" fill="#fff"/>
    <!-- Mark -->
    <rect x="10" y="130" width="240" height="40" fill="#c8b89a" stroke="#a09070" stroke-width="1"/>
    <!-- Betong -->
    <ellipse cx="60" cy="132" rx="18" ry="8" fill="#bbb" stroke="#999" stroke-width="1.5"/>
    <ellipse cx="130" cy="132" rx="18" ry="8" fill="#bbb" stroke="#999" stroke-width="1.5"/>
    <ellipse cx="200" cy="132" rx="18" ry="8" fill="#bbb" stroke="#999" stroke-width="1.5"/>
    <!-- Stolpar -->
    <rect x="52" y="50" width="16" height="82" fill="#d4a96a" stroke="#8B4513" stroke-width="2"/>
    <rect x="122" y="50" width="16" height="82" fill="#d4a96a" stroke="#8B4513" stroke-width="2"/>
    <rect x="192" y="50" width="16" height="82" fill="#d4a96a" stroke="#8B4513" stroke-width="2"/>
    <!-- Justerbar stolpfot -->
    <rect x="48" y="122" width="24" height="10" rx="2" fill="#888" stroke="#555" stroke-width="1.5"/>
    <rect x="118" y="122" width="24" height="10" rx="2" fill="#888" stroke="#555" stroke-width="1.5"/>
    <rect x="188" y="122" width="24" height="10" rx="2" fill="#888" stroke="#555" stroke-width="1.5"/>
    <!-- Vattenpass -->
    <rect x="30" y="42" width="200" height="10" rx="3" fill="#d4edda" stroke="#2b6a3a" stroke-width="1.5"/>
    <circle cx="130" cy="47" r="4" fill="none" stroke="#2b6a3a" stroke-width="1.5"/>
    <circle cx="130" cy="47" r="1.5" fill="#2b6a3a"/>
    <text x="130" y="34" text-anchor="middle" font-size="10" fill="#2b6a3a">Kontrollera lod!</text>
  </svg>`,

  // Steg 3 - Bärlinor
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <rect width="260" height="180" fill="#fff"/>
    <!-- Stolpar -->
    <rect x="40" y="70" width="16" height="100" fill="#d4a96a" stroke="#8B4513" stroke-width="2"/>
    <rect x="122" y="90" width="16" height="80" fill="#d4a96a" stroke="#8B4513" stroke-width="2"/>
    <rect x="204" y="70" width="16" height="100" fill="#d4a96a" stroke="#8B4513" stroke-width="2"/>
    <!-- Bärlinor (balkar) -->
    <rect x="30" y="55" width="200" height="20" rx="3" fill="#c4904a" stroke="#8B4513" stroke-width="2"/>
    <rect x="30" y="80" width="200" height="16" rx="2" fill="#c4904a" stroke="#8B4513" stroke-width="2"/>
    <!-- Dubbel balk mot hus -->
    <rect x="30" y="55" width="200" height="9" rx="0" fill="#b07830" stroke="#8B4513" stroke-width="1"/>
    <!-- Skruv/bult -->
    <circle cx="55" cy="64" r="4" fill="#777" stroke="#555" stroke-width="1"/>
    <circle cx="130" cy="64" r="4" fill="#777" stroke="#555" stroke-width="1"/>
    <circle cx="205" cy="64" r="4" fill="#777" stroke="#555" stroke-width="1"/>
    <text x="130" y="25" text-anchor="middle" font-size="11" fill="#555">45×195 mm balk</text>
    <line x1="130" y1="28" x2="130" y2="53" stroke="#999" stroke-width="1" stroke-dasharray="3,2"/>
  </svg>`,

  // Steg 4 - Golvbräder
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <rect width="260" height="180" fill="#fff"/>
    <!-- Balk i botten -->
    <rect x="20" y="140" width="220" height="16" rx="2" fill="#c4904a" stroke="#8B4513" stroke-width="2"/>
    <rect x="20" y="100" width="220" height="16" rx="2" fill="#c4904a" stroke="#8B4513" stroke-width="2"/>
    <!-- Trallbräder -->
    <rect x="24" y="55" width="19" height="88" rx="2" fill="#e8c87a" stroke="#8B4513" stroke-width="1.5"/>
    <rect x="48" y="55" width="19" height="88" rx="2" fill="#ddb96a" stroke="#8B4513" stroke-width="1.5"/>
    <rect x="72" y="55" width="19" height="88" rx="2" fill="#e8c87a" stroke="#8B4513" stroke-width="1.5"/>
    <rect x="96" y="55" width="19" height="88" rx="2" fill="#ddb96a" stroke="#8B4513" stroke-width="1.5"/>
    <rect x="120" y="55" width="19" height="88" rx="2" fill="#e8c87a" stroke="#8B4513" stroke-width="1.5"/>
    <rect x="144" y="55" width="19" height="88" rx="2" fill="#ddb96a" stroke="#8B4513" stroke-width="1.5"/>
    <rect x="168" y="55" width="19" height="88" rx="2" fill="#e8c87a" stroke="#8B4513" stroke-width="1.5"/>
    <rect x="192" y="55" width="19" height="88" rx="2" fill="#ddb96a" stroke="#8B4513" stroke-width="1.5"/>
    <rect x="216" y="55" width="19" height="88" rx="2" fill="#e8c87a" stroke="#8B4513" stroke-width="1.5"/>
    <!-- 5mm glapp -->
    <line x1="43" y1="44" x2="48" y2="44" stroke="#e05" stroke-width="1.5"/>
    <text x="45" y="38" text-anchor="middle" font-size="9" fill="#e05">5mm</text>
  </svg>`,

  // Steg 5 - Räcke
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <rect width="260" height="180" fill="#fff"/>
    <!-- Altangolv -->
    <rect x="20" y="130" width="220" height="14" rx="2" fill="#e8c87a" stroke="#8B4513" stroke-width="1.5"/>
    <rect x="20" y="118" width="220" height="14" rx="2" fill="#ddb96a" stroke="#8B4513" stroke-width="1.5"/>
    <!-- Räckesstolpar -->
    <rect x="30" y="55" width="12" height="75" rx="2" fill="#c4904a" stroke="#8B4513" stroke-width="2"/>
    <rect x="80" y="60" width="12" height="65" rx="2" fill="#c4904a" stroke="#8B4513" stroke-width="2"/>
    <rect x="130" y="60" width="12" height="65" rx="2" fill="#c4904a" stroke="#8B4513" stroke-width="2"/>
    <rect x="180" y="60" width="12" height="65" rx="2" fill="#c4904a" stroke="#8B4513" stroke-width="2"/>
    <rect x="218" y="55" width="12" height="75" rx="2" fill="#c4904a" stroke="#8B4513" stroke-width="2"/>
    <!-- Ledstång -->
    <rect x="28" y="50" width="204" height="12" rx="5" fill="#b07830" stroke="#8B4513" stroke-width="2"/>
    <!-- Mellanstänger -->
    <line x1="55" y1="62" x2="55" y2="125" stroke="#c4904a" stroke-width="6" stroke-linecap="round"/>
    <line x1="105" y1="62" x2="105" y2="125" stroke="#c4904a" stroke-width="6" stroke-linecap="round"/>
    <line x1="155" y1="62" x2="155" y2="125" stroke="#c4904a" stroke-width="6" stroke-linecap="round"/>
    <line x1="205" y1="62" x2="205" y2="125" stroke="#c4904a" stroke-width="6" stroke-linecap="round"/>
    <!-- Mått -->
    <line x1="30" y1="170" x2="80" y2="170" stroke="#555" stroke-width="1"/>
    <text x="55" y="180" text-anchor="middle" font-size="10" fill="#555">900mm</text>
  </svg>`,

  // Steg 6 - Trappa
  `<svg viewBox="0 0 260 180" xmlns="http://www.w3.org/2000/svg">
    <rect width="260" height="180" fill="#fff"/>
    <!-- Altankant -->
    <rect x="20" y="50" width="100" height="16" rx="2" fill="#e8c87a" stroke="#8B4513" stroke-width="2"/>
    <!-- Trappsteg 1 -->
    <rect x="120" y="66" width="50" height="14" rx="2" fill="#ddb96a" stroke="#8B4513" stroke-width="2"/>
    <rect x="120" y="80" width="50" height="30" rx="0" fill="#e8c87a" stroke="#8B4513" stroke-width="1.5"/>
    <!-- Trappsteg 2 -->
    <rect x="170" y="96" width="50" height="14" rx="2" fill="#ddb96a" stroke="#8B4513" stroke-width="2"/>
    <rect x="170" y="110" width="50" height="30" rx="0" fill="#e8c87a" stroke="#8B4513" stroke-width="1.5"/>
    <!-- Mark -->
    <rect x="20" y="140" width="220" height="30" fill="#c8b89a" stroke="#a09070" stroke-width="1"/>
    <!-- Pil nedåt -->
    <line x1="245" y1="50" x2="245" y2="135" stroke="#2b6a3a" stroke-width="2" marker-end="url(#pilGron2)"/>
    <text x="248" y="95" font-size="10" fill="#2b6a3a" transform="rotate(90,248,95)">Höjd = altanens höjd</text>
    <defs>
      <marker id="pilGron2" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#2b6a3a"/>
      </marker>
    </defs>
  </svg>`
];

// ============================================================
// PROJEKTDATA
// ============================================================

const projekt = {
  lekstuga: {
    namn: "Lekstuga",
    genus: "en",
    ikon: "",
    beskrivning: "Ca 2×2 m, för barn 3–10 år",
    sammanfattning: "En enkel lekstuga i trä med sadeltak, dörr och fönster. Perfekt som första byggprojekt med barnen. Bygger på regelstomme med utvändiga väggar och enkel grundläggning på betongplintar.",
    nyckelord: ['lekstuga', 'koja', 'lekbod', 'barnhus', 'barns', 'lekplats'],
    kommande: false,
    tid: "2 dagar",
    svarighetsgrad: "Medel",
    personer: "2 personer",
    steg: [
      {
        rubrik: "Markarbete och utstakning",
        substeg: function (b, l) {
          var markB = b ? (b + 1).toFixed(1) : '3';
          var markL = l ? (l + 1).toFixed(1) : '3';
          var bCm = b ? Math.round(b * 100) : 200;
          var lCm = l ? Math.round(l * 100) : 200;
          return [
            'Markera en yta på minst ' + markB + ' × ' + markL + ' m med pinnar och snöre.',
            'Gräv ur 10 cm jord inom den markerade ytan.',
            'Fyll med makadam (8–16 mm) för dränering.',
            'Kompaktera makadamen med en vibratorplatta eller handstamp.'
          ];
        }
      },
      {
        rubrik: "Gjut eller placera grundplintar",
        substeg: function (b, l) {
          var bCm = b ? Math.round(b * 100) : 200;
          var lCm = l ? Math.round(l * 100) : 200;
          return [
            'Placera 4 betongplintar i hörnen — avstånd ' + bCm + ' × ' + lCm + ' cm (c/c).',
            'Kontrollera att plintarnas ovansida är i vater med vattenpass och rätskiva.',
            'Mät diagonalerna — de ska vara lika långa för att hörnen är rätvinkliga.',
            'Låt betongen härda minst 24 timmar innan du lastar plintarna.'
          ];
        }
      },
      {
        rubrik: "Bygg grundramen",
        substeg: function (b, l) {
          var bCm = b ? Math.round(b * 100) : 200;
          var lCm = l ? Math.round(l * 100) : 200;
          var diag = Math.round(Math.sqrt(bCm * bCm + lCm * lCm));
          return [
            'Kapa 2 reglar (45×95 mm) till ' + bCm + ' cm och 2 reglar till ' + lCm + ' cm.',
            'Skruva ihop till en rektangulär ram med 2 st 120 mm konstruktionsskruvar per hörn.',
            'Mät diagonalerna — de ska båda vara ca ' + diag + ' cm.',
            'Fäst ramen mot de 4 plintarna med vinkeljärn eller stolpfötter.'
          ];
        }
      },
      {
        rubrik: "Lägg golvreglar (bjälklag)",
        substeg: function (b, l) {
          var bCm = b ? Math.round(b * 100) : 200;
          var antal = Math.max(1, Math.round(bCm / 50) - 1);
          return [
            'Kapa ' + antal + ' mellanreglar (45×95 mm) till ramens inre bredd.',
            'Placera mellanreglarna tvärs med c/c 500 mm.',
            'Skruva fast med vinkelskruv (2 skruvar per ände) i ytterramen.',
            'Kontrollera att bjälklaget är plant med vattenpass.'
          ];
        }
      },
      {
        rubrik: "Lägg golvbräder",
        substeg: function (b, l) {
          var lCm = l ? Math.round(l * 100) + 10 : 210;
          var antalBrader = b ? Math.ceil(b / 0.125) : 18;
          return [
            'Lägg golvbräder (120×22 mm, ' + (lCm / 100).toFixed(1) + ' m) tvärs över bjälklaget.',
            'Lämna 5 mm mellanrum mellan bräderna — använd en spackel som distans.',
            'Skruva 2 skruvar per bräda och regel — totalt ca ' + antalBrader + ' bräder.',
            'Börja från ena kanten och arbeta dig systematiskt till den andra.'
          ];
        }
      },
      {
        rubrik: "Bygg väggramar — långväggar",
        substeg: function (b, l, h) {
          var hCm = h ? Math.round(h * 100) : 180;
          var bCm = b ? Math.round(b * 100) : 200;
          return [
            'Bygg 2 identiska ramar med syll + hammarband + reglar c/c 600 mm. Höjd: ' + hCm + ' cm, längd: ' + bCm + ' cm.',
            'Lämna en dörröppning (80×150 cm) i ena ramen — dubbla reglar runt öppningen.',
            'Montera ett diagonalstag i varje ram för att förhindra att den vrider sig.',
            'Märk delarna: ①syll ②hammarband ③regelståndare.'
          ];
        }
      },
      {
        rubrik: "Bygg väggramar — gavelväggarna",
        substeg: function (b, l, h) {
          var hCm = h ? Math.round(h * 100) : 180;
          var lCm = l ? Math.round(l * 100) : 200;
          return [
            'Bygg 2 gavelramar — rektangel + triangel med 30° takvinkel. Bredd: ' + lCm + ' cm.',
            'Mittregel görs längre för att bära nocken — kapas med 30° i toppen.',
            'Lämna en fönsteröppning (60×60 cm) i ena gaveln — dubbla reglar runt öppningen.',
            'Märk delarna: ①syll ②ståndare ③nockregel.'
          ];
        }
      },
      {
        rubrik: "Res och montera väggarna",
        substeg: function (b, l) {
          return [
            'Res första långväggen och skruva fast syllen mot grundramen (skruv c/c 400 mm).',
            'Staga väggen tillfälligt med diagonalbrädor mot golvet.',
            'Res den andra långväggen och skruva fast på samma sätt.',
            'Res gavelväggarna och skruva ihop alla 4 hörnen med konstruktionsskruvar.'
          ];
        }
      },
      {
        rubrik: "Montera nockbräda och takstolar",
        substeg: function (b, l) {
          var antalStolar = l ? Math.max(2, Math.ceil(l / 0.6) - 1) : 3;
          return [
            'Montera nockbrädan (45×95 mm) längsgående mellan gavelspetsarna.',
            'Kapa ' + antalStolar + ' st A-formade takstolar med 30° vinkel, c/c 600 mm.',
            'Skruva fast takstolarna i hammarbandet och nockbrädan.',
            'Kontrollera att nocklinjen är rak med snöre.'
          ];
        }
      },
      {
        rubrik: "Lägg takunderlag (råspont + takpapp)",
        substeg: function (b, l) {
          return [
            'Spika 22 mm råspont från takfoten uppåt — börja med nedre raden.',
            'Låt bräderna sticka ut 10 cm utanför väggliv (takutsprång).',
            'Rulla takpapp med 10 cm överlapp, nerifrån och upp.',
            'Vik takpappen över nocken så att båda sidor överlappar.'
          ];
        }
      },
      {
        rubrik: "Lägg taktäckning",
        substeg: function (b, l) {
          return [
            'Lägg korrugerad plåt från takfoten uppåt med 15 cm överlapp.',
            'Skruva i vågdalarna med plåtskruvar med gummibricka — c/c 300 mm.',
            'Montera nockplåt längst upp med överlapp åt båda sidor.',
            'Kontrollera att alla skruvar sitter tätt och att plåtarna inte skramlar.'
          ];
        }
      },
      {
        rubrik: "Klä väggarna med locklistpanel",
        substeg: function (b, l, h) {
          var vaggYta = (b && l && h) ? (2 * (b + l) * h).toFixed(1) : '18';
          return [
            'Montera locklistpanel (120×22 mm) nedifrån och upp med 3 cm överlapp.',
            'Skär ut dörr- och fönsteröppningar med sticksåg.',
            'Total väggyta ca ' + vaggYta + ' m² — grundmåla alla ytor innan montering.',
            'Skruva 2 skruvar per panel och regel.'
          ];
        }
      },
      {
        rubrik: "Montera dörr och fönster",
        substeg: [
          'Montera fönsterkarm (60×60 cm) i öppningen — kila, loda, skruva fast.',
          'Isolera runt fönsterkarmen med PU-skum — spraya i tunna lager.',
          'Häng dörren (80×150 cm) på 3 gångjärn — kontrollera att den öppnar fritt.',
          'Montera trycke med lås.'
        ]
      },
      {
        rubrik: "Slutförning och detaljer",
        substeg: function (b, l, h) {
          return [
            'Montera vindskivor längs gaveltakfoten — skruva med c/c 300 mm.',
            'Montera hörnlister i alla 4 ytterhörn för att täcka ändträ.',
            'Måla hela lekstugan med utomhusfärg — 2 lager med torktid emellan.',
            'Slutkontroll: gå igenom att alla skruvar sitter, alla fogar är täta, dörr och fönster fungerar.'
          ];
        }
      }
    ],
    lagerPerSteg: [
      null,                                                                              // 1. Markarbete
      null,                                                                              // 2. Grundplintar
      { vyer: [                                                                          // 3. Grundramen
        { namn: "Översikt", nya: ["Golvreglar"], gamla: [] },
      ]},
      { vyer: [                                                                          // 4. Golvreglar
        { namn: "Översikt", nya: ["Golvreglar"], gamla: [] },
      ]},
      { vyer: [                                                                          // 5. Golvbräder
        { namn: "Översikt", nya: ["Golv"], gamla: ["Golvreglar"] },
      ]},
      { vyer: [                                                                          // 6. Väggramar — långväggar
        { namn: "Översikt", nya: ["Stomme"], gamla: ["Golvreglar", "Golv"] },
      ]},
      { vyer: [                                                                          // 7. Väggramar — gavlar
        { namn: "Översikt", nya: ["Stomme"], gamla: ["Golvreglar", "Golv"] },
      ]},
      { vyer: [                                                                          // 8. Res väggarna
        { namn: "Översikt", nya: ["Stomme"], gamla: ["Golvreglar", "Golv"] },
      ]},
      { vyer: [                                                                          // 9. Nockbräda + takstolar
        { namn: "Översikt", nya: ["Tak"], gamla: ["Golvreglar", "Golv", "Stomme"] },
      ]},
      { vyer: [                                                                          // 10. Takunderlag
        { namn: "Översikt", nya: ["Tak"], gamla: ["Golvreglar", "Golv", "Stomme"] },
      ]},
      { vyer: [                                                                          // 11. Taktäckning
        { namn: "Översikt", nya: ["Tak"], gamla: ["Golvreglar", "Golv", "Stomme"] },
      ]},
      { vyer: [                                                                          // 12. Väggpanel
        { namn: "Översikt", nya: ["Panel"], gamla: ["Golvreglar", "Golv", "Stomme", "Tak"] },
      ]},
      { vyer: [                                                                          // 13. Dörr + fönster
        { namn: "Översikt", nya: ["Dörr", "Fönster"], gamla: ["Golvreglar", "Golv", "Stomme", "Tak", "Panel"] },
      ]},
      null,                                                                              // 14. Slutförning
    ],
    svgar: svgLekstuga,
    inkop: [
      { kategori: "Grund och golv" },
      { namn: "Stolpe, tryckimpregnerad", dim: "120×120 mm, 2,4 m", antal: 4, enhet: "st", not: "Hörn", totalt: 880, skala: "fast" },
      { namn: "Regel", dim: "45×95 mm, 3,6 m", antal: 6, enhet: "st", not: "Grundram", totalt: 480, skala: "perimeter", lager: "Golvreglar" },
      { namn: "Golvbräda, tryckimpregnerad", dim: "120×22 mm, 2,1 m", antal: 18, enhet: "st", not: "", totalt: 990, skala: "area", lager: "Golv" },
      { namn: "Makadam", dim: "8–16 mm", antal: 1, enhet: "m³", not: "Dränering", totalt: 175, skala: "area" },
      { kategori: "Stomme och väggar" },
      { namn: "Regel", dim: "45×95 mm, 3,6 m", antal: 8, enhet: "st", not: "Syll & hammarband", totalt: 640, skala: "perimeter", lager: "Syllar och hammarband" },
      { namn: "Regel", dim: "45×95 mm, 3,6 m", antal: 12, enhet: "st", not: "Stående väggreglar", totalt: 960, skala: "perimeter", lager: "Väggreglar" },
      { namn: "Locklistpanel", dim: "120×22 mm, 3,6 m", antal: 30, enhet: "st", not: "Fasad", totalt: 2100, skala: "perimeter", lager: "Panel" },
      { namn: "Råspont", dim: "22 mm, 3,6 m", antal: 15, enhet: "st", not: "Takbeklädnad", totalt: 900, skala: "area", lager: "Råspont/takpanel" },
      { kategori: "Tak" },
      { namn: "Takstolsvirke", dim: "45×95 mm, 3,0 m", antal: 8, enhet: "st", not: "", totalt: 560, skala: "area" },
      { namn: "Takpapp", dim: "—", antal: 1, enhet: "rulle", not: "Underlagstak", totalt: 450, skala: "fast" },
      { namn: "Korrugerad plåt", dim: "—", antal: 6, enhet: "m²", not: "Alt. träfjäll", totalt: 810, skala: "area" },
      { namn: "Nockplåt", dim: "—", antal: 2, enhet: "m", not: "", totalt: 240, skala: "fast" },
      { kategori: "Dörr och fönster" },
      { namn: "Fönsterparti", dim: "60×60 cm", antal: 1, enhet: "st", not: "Färdigt paket", totalt: 950, skala: "fast", lager: "Fönster" },
      { namn: "Dörr", dim: "80×150 cm", antal: 1, enhet: "st", not: "Enkel innerdörr", totalt: 700, skala: "fast", lager: "Dörr" },
      { namn: "Gångjärn", dim: "—", antal: 3, enhet: "st", not: "Till dörren", totalt: 195, skala: "fast" },
      { namn: "Trycke med lås", dim: "—", antal: 1, enhet: "st", not: "", totalt: 200, skala: "fast" },
      { kategori: "Fästelement" },
      { namn: "Konstruktionsskruv", dim: "120 mm", antal: 100, enhet: "st", not: "", totalt: 290, skala: "area" },
      { namn: "Träskruv", dim: "50 mm", antal: 200, enhet: "st", not: "", totalt: 160, skala: "area" },
      { namn: "Plåtskruv", dim: "—", antal: 50, enhet: "st", not: "Till takplåt", totalt: 95, skala: "fast" },
      { namn: "Justerbar stolpfot", dim: "120×120 mm", antal: 4, enhet: "st", not: "", totalt: 400, skala: "fast" },
      { kategori: "Ytbehandling" },
      { namn: "Grundfärg, utomhus", dim: "—", antal: 3, enhet: "liter", not: "", totalt: 300, skala: "perimeter" },
      { namn: "Täckfärg, utomhus", dim: "—", antal: 5, enhet: "liter", not: "2 lager", totalt: 750, skala: "perimeter" },
      { namn: "Fogmassa, utomhus", dim: "—", antal: 2, enhet: "st", not: "Runt karm", totalt: 200, skala: "fast" }
    ],
    verktyg: {
      maste: [
        "Skruvdragare (gärna slagskruvdragare)",
        "Cirkelsåg eller kap/gersåg",
        "Måttband, 5 m",
        "Vattenpass, 60 cm",
        "Hammare",
        "Vinkelhake",
        "Blyertspenna för markering",
        "Skyddsglasögon",
        "Arbetshandskar"
      ],
      bra: [
        "Borrmaskin med bits",
        "Fogpistol (för fogmassa)",
        "Penslar och roller (för målning)",
        "Snörslå (för raka linjer)",
        "Lod",
        "Stege, 3–4 m",
        "Skiftnyckel"
      ]
    },
    inspiration: {
      gradientColors: ['#f5e6d3', '#d4a574'],
      galleri: [
        { gradient: 'linear-gradient(135deg, #f5e6d3, #c4956a)', text: 'Foto kommer snart' },
        { gradient: 'linear-gradient(135deg, #d4a574, #8b6914)', text: 'Foto kommer snart' },
        { gradient: 'linear-gradient(135deg, #e8d5b7, #a8d5ba)', text: 'Foto kommer snart' }
      ],
      budskap: 'Ett litet hus att försvinna in i. Barnens favoritplats i trädgården — och ditt roligaste bygge hittills.',
      kostnadRange: '5 000 – 12 000 kr',
      inkluderar: ['Steg-för-steg instruktioner med bilder', 'Komplett inköpslista', '3D-modell du kan vrida och vända', 'Detaljritningar med mått']
    }
  },

  altan: {
    namn: "Altan",
    genus: "en",
    ikon: "",
    beskrivning: "Ca 4×3 m, fristående eller mot hus",
    sammanfattning: "En klassisk trallad altan på stolpfundament — stabil, snygg och enkel att bygga själv. Fungerar både fristående och mot husvägg, och kan anpassas i storlek, höjd och räcke efter din tomt.",
    nyckelord: ['altan', 'terrass', 'uteplats', 'trall', 'trädäck', 'däck', 'utomhus', 'veranda'],
    kommande: false,
    tid: "2–3 dagar",
    svarighetsgrad: "Medel",
    personer: "2 personer",
    steg: [
      {
        rubrik: "Planering och markarbete",
        substeg: (b, l) => [
          `Mät upp altanytan (${b} × ${l} m) och markera hörnen med pinnar och snöre.`,
          "Kontrollera att vinklarna är 90° — mäta diagonalerna, de ska vara lika långa.",
          "Rensa bort gräs, rötter och växter inom ytan.",
          "Bestäm altanens höjd ovanför marken — styr om räcke krävs och hur lång trappa du behöver."
        ]
      },
      {
        rubrik: "Sätt grundstolpar",
        substeg: (b, l) => [
          `Markera stolppositioner i hörnen och längs kanterna — max 1,8 m mellanrum längs ${b} m-sidan och ${l} m-sidan.`,
          "Gräv 60 cm djupa hål eller gjut betongfundament för varje stolpe.",
          "Montera justerbara stolpfötter i betongen och låt betong härda minst ett dygn.",
          "Kontrollera att alla stolpar är i lod och på rätt höjd med vattenpass."
        ]
      },
      {
        rubrik: "Montera bärlinor (balkar)",
        substeg: (b, l) => [
          `Kapa bärlinorna (45×195 mm) till ${b} m (längsbalkar) och ${l} m (tvärbalkar).`,
          "Skruva fast bärlinorna mot stolparna med konstruktionsskruvar eller bultförband M12.",
          `Mot huset monteras en skuldra (45×195 mm, ${b} m) direkt i husväggsfasaden.`,
          "Täta rikligt med fogmassa runt skuldran och kontrollera att balkarna är i vater."
        ]
      },
      {
        rubrik: "Lägg trallbräderna",
        substeg: (b, l) => [
          `Kapa tryckimpregnerade trallbräder (28×120 mm) till ${l} m längd.`,
          "Börja lägga bräderna med 5–8 mm mellanrum — använd en spackel eller träbit som spacer.",
          "Skruva med 2 rostfria trallskruvar per bräda och balk — viktigt: använd rostfria skruvar.",
          `Kapa ev. överskjutande ändar längs ${b} m-sidan med cirkelsåg när alla bräder är lagda.`
        ]
      },
      {
        rubrik: "Bygg räcket",
        substeg: (_b, _l, h) => [
          h > 0.5
            ? `Räcke är obligatoriskt — altanen är ${Math.round(h * 100)} cm hög (Boverket kräver räcke när höjden överstiger 50 cm).`
            : `Altanen är ${Math.round(h * 100)} cm hög — räcke krävs inte men rekommenderas (gränsen är 50 cm).`,
          "Montera räckesstolpar (70×70 mm, 1,1 m) med max 90 cm mellanrum längs altankanten.",
          "Fäst ledstång (45×70 mm) på stolparnas topp — räcket ska vara minst 90 cm högt.",
          "Montera mellanstänger med max 10 cm gap för barnsäkerhet."
        ]
      },
      {
        rubrik: "Bygg trappa",
        substeg: (_b, _l, h) => {
          const nSteg = Math.max(1, Math.round(h / 0.175));
          return [
            `Mät höjden från altangolvet till marken: ${Math.round(h * 100)} cm — ger ca ${nSteg} trappsteg à ${Math.round(h / nSteg * 100)} cm.`,
            "Skär trappvångarna (45×220 mm) med stegutskärningar för steglösen.",
            "Montera steglösen (28×120 mm, 2 bräder per steg) och skruva fast i vångarna.",
            "Fäst trappan mot altankanten och förankra nederkanten i marken."
          ];
        }
      }
    ],
    lagerPerSteg: [
      null,                                                              // 1. Planering — ingen 3D
      { vyer: [                                                          // 2. Grundstolpar
        { namn: "Översikt", nya: ["Stolpar"], gamla: [] },
      ]},
      { vyer: [                                                          // 3. Bärlinor + reglar
        { namn: "Översikt", nya: ["Bärlinor", "Reglar"], gamla: ["Stolpar"] },
        { namn: "Regelinfästning", nya: ["Reglar"], gamla: ["Stolpar", "Bärlinor"],
          kamera: { position: [600, 300, 600], target: [0, 200, 0] },
          bildtext: "Golvreglarna fästs i bärlinorna med regelbeslag eller skruvinfästning" },
      ]},
      { vyer: [                                                          // 4. Trallbrädor
        { namn: "Översikt", nya: ["Trall", "Kantbräda"], gamla: ["Stolpar", "Bärlinor", "Reglar"] },
        { namn: "Tralldetalj", nya: ["Trall"], gamla: ["Reglar"],
          kamera: { position: [400, 150, 400], target: [0, 250, 0] },
          bildtext: "5\u20138 mm mellanrum mellan brädorna, 2 rostfria skruvar per korsning" },
      ]},
      { vyer: [                                                          // 5. Räcke
        { namn: "Översikt", nya: ["Räcke"], gamla: ["Stolpar", "Bärlinor", "Reglar", "Trall", "Kantbräda"] },
      ]},
      { vyer: [                                                          // 6. Trappa
        { namn: "Översikt", nya: ["Trappa"], gamla: ["Stolpar", "Bärlinor", "Reglar", "Trall", "Kantbräda", "Räcke"] },
      ]},
    ],
    svgar: svgAltan,
    inkop: [
      { kategori: "Grund" },
      { namn: "Stolpe, tryckimpregnerad", dim: "120×120 mm, 1,8 m", antal: 6,  enhet: "st", not: "",                  totalt: 1140, skala: "perimeter", lager: "Stolpar" },
      { namn: "Justerbar stolpfot",        dim: "120×120 mm",        antal: 6,  enhet: "st", not: "Betongmontage",    totalt: 600,  skala: "perimeter" },
      { namn: "Betong (färdigblandad)",     dim: "—",                 antal: 3,  enhet: "säckar", not: "Fundament",   totalt: 300,  skala: "perimeter" },
      { kategori: "Bärlinor och reglar" },
      { namn: "Balk",                       dim: "45×195 mm, 4,2 m", antal: 4,  enhet: "st", not: "Bärlinor",         totalt: 1000, skala: "area", lager: "Bärlinor" },
      { namn: "Balk",                       dim: "45×145 mm, 3,0 m", antal: 6,  enhet: "st", not: "Tvärbalkar",       totalt: 1080, skala: "area", lager: "Reglar" },
      { namn: "Skuldra mot hus",            dim: "45×195 mm, 4,2 m", antal: 1,  enhet: "st", not: "Fasadmontage",     totalt: 250,  skala: "fast",  lager: "Bärlinor" },
      { kategori: "Trallgolv" },
      { namn: "Trallbräda, tryckimpregnerad", dim: "28×120 mm, 4,2 m", antal: 35, enhet: "st", not: "",              totalt: 3325, skala: "area", lager: "Trall" },
      { kategori: "Räcke" },
      { namn: "Räckesstolpe",              dim: "70×70 mm, 1,1 m",   antal: 10, enhet: "st", not: "",                totalt: 1500, skala: "perimeter", lager: "Räckesstolpar" },
      { namn: "Ledstång",                  dim: "45×70 mm, 4,2 m",   antal: 3,  enhet: "st", not: "Topp + mellan",   totalt: 540,  skala: "perimeter", lager: "Ledstänger" },
      { namn: "Räckesspjälor",             dim: "28×45 mm, 0,9 m",   antal: 40, enhet: "st", not: "Max 10 cm gap",   totalt: 1600, skala: "perimeter", lager: "Räckesspjälor" },
      { kategori: "Trappa" },
      { namn: "Trappvång",                 dim: "45×220 mm, 2,4 m",  antal: 2,  enhet: "st", not: "",                totalt: 460,  skala: "fast", lager: "Trappvångar" },
      { namn: "Trappsteg",                 dim: "28×120 mm, 90 cm",  antal: 8,  enhet: "st", not: "2 bräder/steg",   totalt: 560,  skala: "fast", lager: "Trappsteg" },
      { kategori: "Fästelement" },
      { namn: "Konstruktionsskruv",        dim: "120 mm",            antal: 100, enhet: "st", not: "",               totalt: 290,  skala: "area" },
      { namn: "Trallskruv, rostfri",       dim: "50 mm",             antal: 400, enhet: "st", not: "Viktigt: rostfri!", totalt: 420, skala: "area" },
      { namn: "Bultförband",               dim: "M12, 150 mm",       antal: 20, enhet: "st", not: "Stolpar mot balkar", totalt: 900, skala: "perimeter" },
      { namn: "Fasadankare",               dim: "—",                 antal: 6,  enhet: "st", not: "Skuldra mot hus",  totalt: 390,  skala: "fast" },
      { namn: "Fogmassa, utomhus",         dim: "—",                 antal: 3,  enhet: "st", not: "Runt skuldra",     totalt: 300,  skala: "fast" }
    ],
    verktyg: {
      maste: [
        "Slagskruvdragare",
        "Cirkelsåg",
        "Måttband, 8 m",
        "Vattenpass, 100 cm",
        "Hammare",
        "Borrmaskin (för bulthål)",
        "Vinkelhake",
        "Skyddsglasögon",
        "Arbetshandskar"
      ],
      bra: [
        "Kap/gersåg (för exakta vinklar)",
        "Fogpistol",
        "Snörslå",
        "Lod",
        "Stege",
        "Skiftnyckel och ringnyckel M12",
        "Spade (för grundhål)"
      ]
    },
    inspiration: {
      gradientColors: ['#e8d5b7', '#8b7355'],
      galleri: [
        { bild: 'assets/altan-1.jpg' },
        { bild: 'assets/altan-2.jpg' },
        { bild: 'assets/altan-3.jpg' },
        { bild: 'assets/altan-4.jpg' }
      ],
      budskap: 'Ett extra rum under bar himmel. Morgonkaffet, sena middagar — sommaren börjar här.',
      kostnadRange: '8 000 – 20 000 kr',
      inkluderar: ['Steg-för-steg instruktioner med bilder', 'Komplett inköpslista', '3D-modell du kan vrida och vända', 'Detaljritningar med mått']
    }
  },

  pergola: {
    namn: "Pergola",
    genus: "en",
    ikon: "\u{1F33F}",
    beskrivning: "Öppet lusthus med spjältak",
    sammanfattning: "En fristående pergola i trä med stolpar, bärbalkar och spjältak. Ger behaglig halvskugga och kan kläs med klätterväxter. Enkel konstruktion som passar de flesta trädgårdar.",
    nyckelord: ['pergola', 'spaljé', 'lusthus', 'klätterväxt', 'trädgård', 'skugga'],
    kommande: false,
    tid: "1\u20132 dagar",
    svarighetsgrad: "Lätt\u2013Medel",
    personer: "2 personer",
    steg: [
      {
        rubrik: "Markera och gräv för plintar",
        substeg: function (b, l) {
          return [
            'Markera stolppositionerna med pinnar \u2014 ' + Math.round(b * 100) + ' \u00d7 ' + Math.round(l * 100) + ' cm.',
            'Gräv hål (ca 30\u00d730 cm, 50 cm djupa) för varje stolpe.',
            'Kontrollera att diagonalerna är lika för räta vinklar.'
          ];
        }
      },
      {
        rubrik: "Sätt stolpar",
        substeg: function (b, l) {
          return [
            'Placera 120\u00d7120 mm stolpar i hålen.',
            'Använd vattenpass och kontrollera att stolparna är lodräta.',
            'Gjut fast med betong eller använd markhylsor.',
            'Kapa stolparna i önskad höjd med vattenpass mellan dem.'
          ];
        }
      },
      {
        rubrik: "Montera bärbalkar",
        substeg: function (b, l) {
          return [
            'Skruva fast 45\u00d7195 mm bärbalkar ovanpå stolparna i djupled.',
            'Balkarna ska sticka ut ca 15 cm förbi yttre stolpar.',
            'Använd vinkeljärn eller genomgående bult.'
          ];
        }
      },
      {
        rubrik: "Montera spjälor",
        substeg: function (b, l) {
          var antal = Math.round(b / 0.15) + 1;
          return [
            'Lägg upp 45\u00d770 mm spjälor tvärs över balkarna med c/c 150 mm.',
            'Det blir ca ' + antal + ' spjälor totalt.',
            'Förskruva varje spjäla i varje bärbalk med 2 st rostfria skruv.',
            'Låt spjälorna sticka ut ca 10 cm förbi yttre balkarna.'
          ];
        }
      },
      {
        rubrik: "Ytbehandla",
        substeg: function () {
          return [
            'Slipa eventuella ojämnheter.',
            'Stryk med träolja eller lasyr i valfri kulör.',
            'Vänta minst 24 timmar innan användning.'
          ];
        }
      }
    ],
    lagerPerSteg: [
      null,                                                                              // 1. Markera + gräv
      { vyer: [                                                                          // 2. Stolpar
        { namn: "Översikt", nya: ["Stolpar"], gamla: [] },
      ]},
      { vyer: [                                                                          // 3. Bärbalkar
        { namn: "Översikt", nya: ["Bärbalkar"], gamla: ["Stolpar"] },
      ]},
      { vyer: [                                                                          // 4. Spjälor
        { namn: "Översikt", nya: ["Spjälor"], gamla: ["Stolpar", "Bärbalkar"] },
      ]},
      null,                                                                              // 5. Ytbehandla
    ],
    verktyg: {
      maste: [
        "\u26A1 Skruvdragare med bits",
        "\u{1FA9A} Cirkels\u00e5g eller kaps\u00e5g",
        "\u{1F4CF} M\u00e5ttband (5 m)",
        "\u{1F4D0} Vattenpass (1 m)"
      ],
      bra: [
        "\u{1F527} Skiftnyckel (f\u00f6r bult)",
        "\u{1FA9C} Hammare",
        "\u270F\uFE0F Blyertspenna",
        "\u{1F9F9} Sandpapper eller slipmaskin"
      ]
    },
    inkop: [
      { kategori: "Stomme" },
      { namn: "Stolpe, tryckimpregnerad", dim: "120\u00d7120 mm, 3,0 m", antal: 4, enhet: "st", not: "", totalt: 1156, skala: "perimeter", lager: "Stolpar" },
      { namn: "B\u00e4rbalk", dim: "45\u00d7195 mm, 3,6 m", antal: 2, enhet: "st", not: "Djupled", totalt: 370, skala: "perimeter", lager: "B\u00e4rbalkar" },
      { kategori: "Spj\u00e4ltak" },
      { namn: "Spj\u00e4la", dim: "45\u00d770 mm, 3,6 m", antal: 21, enhet: "st", not: "c/c 150 mm", totalt: 1155, skala: "area", lager: "Spj\u00e4lor" },
      { kategori: "Infastning" },
      { namn: "Betong (torrbruk)", dim: "25 kg", antal: 4, enhet: "s\u00e4ck", not: "Fundament", totalt: 316, skala: "perimeter" },
      { namn: "Rostfri skruv", dim: "5\u00d780 mm, 200 st", antal: 1, enhet: "f\u00f6rp", not: "", totalt: 249, skala: "fast" },
      { namn: "Vinkelj\u00e4rn", dim: "\u2014", antal: 8, enhet: "st", not: "Stolpe\u2013balk", totalt: 232, skala: "perimeter" },
      { kategori: "Ytbehandling" },
      { namn: "Tr\u00e4olja/lasyr", dim: "\u2014", antal: 2, enhet: "liter", not: "", totalt: 378, skala: "area" }
    ],
    inspiration: {
      gradientColors: ['#d4edda', '#87CEEB'],
      galleri: [
        { gradient: 'linear-gradient(135deg, #d4edda, #a8d5ba)', text: 'Foto kommer snart' },
        { gradient: 'linear-gradient(135deg, #87CEEB, #5fa8d3)', text: 'Foto kommer snart' },
        { gradient: 'linear-gradient(135deg, #c8e6c9, #d4a574)', text: 'Foto kommer snart' }
      ],
      budskap: 'Skugga, rumskänsla och en ram för klätterväxter. En pergola gör trädgården till en plats du inte vill lämna.',
      kostnadRange: '4 000 \u2013 10 000 kr',
      inkluderar: ['Steg-f\u00f6r-steg instruktioner med bilder', 'Komplett ink\u00f6pslista', '3D-modell du kan vrida och v\u00e4nda', 'Detaljritningar med m\u00e5tt']
    }
  }
};

// Sokbara genereras automatiskt fran projekt-objektet + kommande projekt
const sokbara = [
  // Implementerade projekt (fran projekt-objektet)
  ...Object.entries(projekt).map(([id, p]) => ({
    id,
    namn: p.namn,
    ikon: p.ikon,
    beskrivning: p.beskrivning,
    nyckelord: p.nyckelord || [],
    kommande: p.kommande || false,
    tid: p.tid,
    svarighetsgrad: p.svarighetsgrad,
    kostnadRange: p.inspiration ? p.inspiration.kostnadRange : null,
    gradientColors: p.inspiration ? p.inspiration.gradientColors : null
  })),
  // Kommande projekt (annu ej implementerade)
  { id: 'staket', namn: 'Staket / Plank', ikon: '\u{1F532}', beskrivning: 'Trä- eller plankstaket', nyckelord: ['staket', 'plank', 'inhägnad', 'grind', 'tomtgräns', 'spjäla'], kommande: true },
  { id: 'sandlada', namn: 'Sandlåda', ikon: '\u{1F3D6}\uFE0F', beskrivning: 'Klassisk sandlåda med sits och lock', nyckelord: ['sandlåda', 'sand', 'barn', 'lek', 'lekplats', 'barnsand'], kommande: true },
  { id: 'odlingslada', namn: 'Odlingslåda', ikon: '\u{1F331}', beskrivning: 'Pallkrage eller odlingslåda för grönsaker och blommor', nyckelord: ['odlingslåda', 'pallkrage', 'odling', 'grönsaker', 'kryddor', 'trädgårdsodling', 'raised bed'], kommande: true },
  { id: 'vedforrad', namn: 'Vedförråd', ikon: '\u{1FAB5}', beskrivning: 'Luftigt förråd för ved med tak', nyckelord: ['vedförråd', 'vedställ', 'vedbod', 'ved', 'förvaring', 'brännved'], kommande: true },
  { id: 'utekök', namn: 'Utekök / Grillplats', ikon: '\u{1F525}', beskrivning: 'Enkel arbetsbänk och grillplats utomhus', nyckelord: ['utekök', 'grillplats', 'grill', 'utomhuskök', 'matlagning', 'bänk utomhus'], kommande: true },
  { id: 'brygga', namn: 'Brygga', ikon: '\u{1F6A4}', beskrivning: 'Enkel träbrygga för sjö eller hav', nyckelord: ['brygga', 'sjö', 'vatten', 'båt', 'pir', 'flytbrygga', 'strandbrygga'], kommande: true },
  { id: 'bastu', namn: 'Bastu', ikon: '\u{1F9D6}', beskrivning: 'Fristående utomhusbastu', nyckelord: ['bastu', 'sauna', 'bastustuga', 'badbastu', 'relaxavdelning', 'ångbastu'], kommande: true },
  { id: 'skjul', namn: 'Trädgårdsförråd', ikon: '\u{1F3DA}\uFE0F', beskrivning: 'Liten bod för trädgårdsredskap', nyckelord: ['skjul', 'förråd', 'redskapsbod', 'trädgårdsbod', 'bod', 'garageuppgång'], kommande: true }
];
