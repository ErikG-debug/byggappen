# Plan: Bildanalys-endpoint + AI-kvalitetsförbättringar

## Context

Vi har just lagt om flowet till "WOW-first": användaren laddar upp en bild på sin tomt → en vision-analys föreslår mått och kameravinkel → CAD-modellen står ungefär rätt placerad i perspektiveditorn → FLUX Fill Pro genererar en realistisk bild. Frontend är klar och fall-tillbakar tyst på trygga defaults när proxy-endpointen saknas.

Två saker återstår:
1. **Backend**: bygga `/api/analysera-bild` på proxyservern så bildanalysen faktiskt körs.
2. **AI-kvalitet**: höja realism och trovärdighet i FLUX-genereringen så slutresultatet motsvarar WOW-löftet.

Den här planen täcker båda. Punkt 1–2 är minsta insats för fungerande WOW-flow. Punkt 3–6 är iterativa kvalitetshöjningar i prioritetsordning.

---

## 1. Proxy-endpoint: `/api/analysera-bild`

**Plats**: proxyservern (separat repo, samma som kör `/api/visualisera`).

**Request**:
```json
POST /api/analysera-bild
Content-Type: application/json
{
  "image": "data:image/jpeg;base64,...",
  "projektTyp": "altan" | "lekstuga" | "pergola"
}
```

**Response (success)**:
```json
{
  "b": 3.5,
  "l": 4.0,
  "h": 0.4,
  "kameraTransform": {
    "yaw": -15,
    "pitch": -8,
    "x": 0.1,
    "y": -0.2
  },
  "ljus": {
    "typ": "golden hour" | "overcast" | "midday" | "soft afternoon",
    "skuggriktning": "vänster" | "höger" | "framifrån" | "bakifrån",
    "intensitet": "stark" | "mjuk"
  }
}
```

**Response (fel)**: HTTP 500 + `{"error": "..."}`. Klienten fall-tillbakar tyst på defaults — användaren ska aldrig se ett analysfel.

**Implementation**:
- Använd **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) via Anthropic API. Snabb, billig, multimodal, bra på strukturerad JSON-output.
- Skicka bilden som vision-input + en strukturerad prompt:
  > "Du är en arkitekt som hjälper en husägare placera en {projektTyp} i sin trädgård. Här är en bild på tomten. Uppgifter:
  >
  > 1. Uppskatta synlig markyta i meter (bredd × djup).
  > 2. Föreslå rimliga mått för en {projektTyp} som skulle få plats där, med realistiska proportioner. Bredd b, längd l, höjd h i meter.
  > 3. Föreslå en grov kamera-transform (yaw, pitch i grader; x, y som offset i normaliserade bild-koordinater -1 till 1) som beskriver var i bilden modellen rimligen skulle stå.
  > 4. Bedöm ljuset: typ (golden hour / overcast / midday / soft afternoon), skuggriktning (vänster/höger/framifrån/bakifrån), intensitet (stark/mjuk).
  >
  > Svara ENBART med JSON enligt detta schema, inga förklaringar:
  > `{b, l, h, kameraTransform: {yaw, pitch, x, y}, ljus: {typ, skuggriktning, intensitet}}`"
- Validera JSON innan retur. Om Claude returnerar text utöver JSON: extrahera med regex eller strukturerad output (Anthropic stöder JSON mode).
- Vid valideringsfel eller API-fel: returnera HTTP 500.
- **Cache aldrig** — varje bild är unik.

**Notering**: ljus-fältet är förberedelse för punkt 3 (ljusmatching) — frontend behöver inte använda det förrän depth+ljus-prompten är på plats. Returnera det redan från start så slipper vi en till endpoint-revision.

---

## 2. Frontend: passera ljus-fältet vidare

Klienten lagrar idag bara `b/l/h/kameraTransform`. När `ljus`-fältet finns ska det sparas globalt så det kan injiceras i FLUX-prompten vid generering.

**Filer**:
- `byggappen/app.js`: ny global `aktuelltLjus = null`. I `gaVidare()` efter analys-resultatet: `if (analysResultat.ljus) aktuelltLjus = analysResultat.ljus`.
- `byggappen/ai-visualisering.js`: `byggPrompt(projektTyp, dim, ljus)` tar emot ljus-objektet och injicerar i prompten (se punkt 4).
- `byggappen/app.js`: `startaAIGenerering` skickar `aktuelltLjus` vidare till `AIVisualisering.generera`.

Liten ändring. ~15 rader.

---

## 3. Depth-map som extra ControlNet-input (största kvalitetshoppet)

**Varför**: canny ger modellen kanter, men inte 3D-form/avstånd. Depth ger modellen perspektiv och proportioner gratis. Resultat: CAD-objektet sitter realistiskt i scenen istället för att se "klistrat" ut.

**Frontend-arbete** i `byggappen/ai-visualisering.js`, funktionen `genereraCannyOchMask`:

- Idag renderar den canny + mask via Three.js (eller SVG, kolla nuvarande implementation).
- Lägg till en parallell render av en **depth-map**: samma kameravinkel, samma CAD-modell, men med en `MeshDepthMaterial` (Three.js inbyggd). Output: gråskale-PNG där närmare = ljusare.
- Returnera nytt fält `cadDepthDataUrl` utöver befintliga `cadCannyDataUrl` och `maskDataUrl`.
- Skicka `cadDepth` som extra fält i POST till `/api/visualisera`.

**Three.js depth-render-snippet** (~50 rader, kan ligga i `genereraCannyOchMask`):
```js
function renderDepthMap(cadScene, camera, width, height) {
  var depthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
  });
  var renderTarget = new THREE.WebGLRenderTarget(width, height);
  var prevOverride = cadScene.overrideMaterial;
  cadScene.overrideMaterial = depthMat;

  var renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setSize(width, height);
  renderer.setRenderTarget(renderTarget);
  renderer.render(cadScene, camera);

  // Läs ut till canvas → toDataURL
  var pixels = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels);
  // ... konvertera till canvas och toDataURL('image/png')

  cadScene.overrideMaterial = prevOverride;
  renderer.dispose();
  return canvas.toDataURL('image/png');
}
```

**Backend-arbete** (proxyserver):
- `/api/visualisera` ska ta emot nytt valfritt fält `cadDepth` (base64 PNG).
- Vidarebefordra till FLUX Fill Pro-modellen som depth-control input.
- **Viktigt**: kontrollera vilken Replicate-modell ni använder. Standard `flux-fill-pro` stödjer inte ControlNet-depth direkt. Ni måste antingen:
  - Byta till `flux-controlnet` eller en variant som stödjer multi-controlnet (canny + depth)
  - Eller använda en pipeline-modell på Replicate som accepterar både inpainting och multi-controlnet
- Alternativt: skicka depth som *referensbild* via en separat IP-Adapter-input om modellen stödjer det.

**Verifiering**: jämför AI-output med och utan depth på samma bild. Skuggor och perspektiv ska vara märkbart bättre med depth aktiverat.

---

## 4. Prompt-specificitet + ljusmatching

**Plats**: `byggappen/ai-visualisering.js`, funktionen `byggPrompt`.

**Idag** (typiskt): generisk text typ "an altan in a backyard, dimensions {b} x {l} m".

**Förslag**: rikare, naturligt språk + projekt-specifika materialord + dynamisk ljus-injektion.

```js
var _materialBeskrivningar = {
  altan: 'a pressure-treated pine deck with silver-grey weathered boards, '
       + 'visible joists underneath, simple wooden railings',
  lekstuga: 'a small Scandinavian-style children\'s playhouse, faluröd '
          + '(falu red) painted vertical board cladding, white window trim, '
          + 'asphalt shingle gable roof',
  pergola: 'a minimalist wooden pergola with pressure-treated posts and '
         + 'horizontal slatted roof, natural pine finish',
};

var _ljusBeskrivningar = {
  'golden hour': 'warm golden hour lighting, long soft shadows, low sun angle',
  'overcast':    'soft overcast daylight, diffused shadows, even lighting',
  'midday':      'bright midday sunlight, sharp defined shadows, high contrast',
  'soft afternoon': 'soft late afternoon light, gentle warm tones',
};

function byggPrompt(projektTyp, dim, ljus) {
  var material = _materialBeskrivningar[projektTyp] || 'a wooden structure';
  var dimText = 'approximately ' + dim.b + ' meters wide and ' + dim.l + ' meters deep';
  var ljusText = (ljus && _ljusBeskrivningar[ljus.typ])
    ? _ljusBeskrivningar[ljus.typ]
    : 'natural daylight';
  var skuggor = (ljus && ljus.skuggriktning)
    ? ', shadows falling toward the ' + _engelskaSkuggor(ljus.skuggriktning)
    : '';

  return material + ', ' + dimText + ', '
       + 'in a residential backyard, photorealistic architectural photography, '
       + ljusText + skuggor + ', '
       + 'shallow depth of field, ultra-detailed, professional outdoor photography';
}

function _engelskaSkuggor(s) {
  return { 'vänster': 'left', 'höger': 'right', 'framifrån': 'foreground', 'bakifrån': 'background' }[s] || 'side';
}
```

**Verifiering**: jämför två genereringar av samma projekt — en med gamla prompten, en med nya. Materialdetaljer ska vara märkbart rikare.

---

## 5. Seed-återanvändning för iterationer

**Plats**: `byggappen/ai-visualisering.js` + `app.js`.

**Idag**: `_lastSeed` lagras efter varje generering men används aldrig vid nästa anrop.

**Förslag**:
- I `generera()`: om `dim` är "nära" föregående generering (samma projektTyp, samma bild, måtten skiljer mindre än 20%), skicka `seed: _lastSeed` i payload till proxy.
- Annars (helt ny bild eller stor måttändring): låt servern välja ny seed.
- Lägg en användar-knapp "Skapa helt ny variant" som rensar `_lastSeed` så användaren kan tvinga fram en ny tolkning om de inte gillar nuvarande.

**Backend**: `/api/visualisera` accepterar redan `seed` (de flesta Replicate-modeller gör det). Bara verifiera att det skickas vidare till FLUX-anropet.

**Verifiering**: ändra bredd 3m → 3.2m och generera om. Resultatet ska vara "samma altan, lite bredare", inte "helt ny altan".

---

## 6. Strength-tuning för inpainting

**Plats**: proxyservern, anropet till FLUX Fill Pro.

**Idag**: antagligen default-strength.

**Förslag**: experimentera med `prompt_strength` (FLUX Fill Pro-parameter):
- Lågt värde (~0.6): bevarar mer av originalbilden, modellen "smyger in" objektet
- Högt värde (~0.9): mer kreativ frihet, mer realistiskt objekt men risk för avdrift
- Sweet spot för vårt use case är troligen **0.75–0.85**.

**Verifiering**: A/B-test på samma bild med strength 0.6, 0.75, 0.9. Välj den som balanserar realism mot bevarande av tomten bäst.

---

## Prioritetsordning för implementation

1. **Endpoint `/api/analysera-bild`** (punkt 1) — krävs för att hela WOW-flowet ska fungera över huvud taget. Utan detta får användaren alltid trygga defaults.
2. **Frontend ljus-passthrough** (punkt 2) — trivialt, gör samtidigt som punkt 1 så ljus följer med.
3. **Depth-map** (punkt 3) — största kvalitetshoppet. Kräver både frontend-arbete och eventuellt byte av Replicate-modell.
4. **Prompt-specificitet + ljusmatching** (punkt 4) — billigt, rent frontend, ger märkbar förbättring.
5. **Seed-återanvändning** (punkt 5) — bra UX för iterationer, lite arbete på båda sidor.
6. **Strength-tuning** (punkt 6) — finjustering, görs sist när allt annat är på plats.

## Kritiska filer

**Frontend (denna repo)**:
- `byggappen/ai-visualisering.js` — `analysera`, `byggPrompt`, `genereraCannyOchMask`, `generera`
- `byggappen/app.js` — `gaVidare`, `startaAIGenerering`, ny global `aktuelltLjus`

**Backend (proxyserver, separat repo)**:
- Ny route `/api/analysera-bild`
- Befintlig route `/api/visualisera` — utöka för `cadDepth` + `seed` + `prompt_strength`

## Verifiering — end-to-end

1. Implementera punkt 1 + 2. Ladda upp en bild på en trädgård. Verifiera i devtools att `/api/analysera-bild` anropas och svaret innehåller rimliga `b/l/h/kameraTransform/ljus`. Verifiera att modellen står ungefär rätt i editorn direkt.
2. Implementera punkt 4. Generera en bild. Verifiera i nätverkstabben att prompten innehåller materialord och ljusbeskrivning.
3. Implementera punkt 3. Generera samma bild som tidigare. Jämför visuellt — perspektiv/skuggor ska vara märkbart bättre.
4. Implementera punkt 5. Ändra bredd lite, generera om. Resultatet ska se ut som samma objekt, bara annan storlek.
5. Implementera punkt 6. Finjustera tills A/B-testning visar bästa balans.
