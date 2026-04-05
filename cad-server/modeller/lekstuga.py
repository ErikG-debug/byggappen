"""
Parametrisk lekstugemodell i CadQuery.

Baserad på svenska konstruktionsstandarder:
- Reglar (stomme): 45×95 mm, max cc 600 mm
- Golvbrädor: 22×120 mm, cc 125 mm (5 mm gap)
- Locklistpanel (väggar): 22×120 mm
- Sadeltak med 30° lutning
- Dörr: 800×1500 mm (barnstorlek)
- Fönster: 600×600 mm
- Takutsprång: 150 mm
"""

import cadquery as cq
import math


def bygg_lekstuga(bredd: float = 2.0, langd: float = 2.0, hojd: float = 2.2):
    """
    Bygger en komplett lekstugemodell.

    Args:
        bredd: Lekstugans bredd i meter (gavelsida, sadeltak åt detta håll)
        langd: Lekstugans djup i meter (långsida)
        hojd: Vägghöjd i meter (till takfot)

    Returns:
        CadQuery Assembly med namngivna delar
    """
    assy = cq.Assembly(name="lekstuga")

    # Konvertera till mm
    B = bredd * 1000
    L = langd * 1000
    H = hojd * 1000

    # ══════════════════════════════════════════
    # VIRKESDIMENSIONER
    # ══════════════════════════════════════════

    # Reglar (stomme) — 45×95 mm
    regel_b = 45
    regel_h = 95
    regel_cc = 600

    # Golvbrädor — 22×120 mm, cc 125 mm
    golv_t = 22
    golv_w = 120
    golv_cc = 125

    # Golvreglar (bjälklag) — 45×95 mm, cc 600 mm
    golvregel_b = 45
    golvregel_h = 95

    # Panel (väggbeklädnad) — 22×120 mm
    panel_t = 22
    panel_w = 120
    panel_cc = 125

    # Tak
    tak_vinkel = 30  # grader
    tak_vinkel_rad = math.radians(tak_vinkel)
    tak_utsprang = 150  # mm
    takpanel_t = 22

    # Dörr — 800×1500 mm (sydsida/framsida, -Y)
    dorr_b = 800
    dorr_h = 1500
    dorr_x = (B - dorr_b) / 2  # centrerad

    # Fönster — 600×600 mm (östsida/högersida, +X)
    fonster_b = 600
    fonster_h = 600
    fonster_z = H * 0.45

    # ══════════════════════════════════════════
    # BERÄKNADE VÄRDEN
    # ══════════════════════════════════════════

    # Nock
    nock_hojd = H + math.tan(tak_vinkel_rad) * (B / 2)
    nock_over_vagg = nock_hojd - H

    # Golv: reglar + brädor
    golv_ok = golvregel_h + golv_t  # golvets ovansida

    # ══════════════════════════════════════════
    # 1. GOLVREGLAR (bjälklag)
    # ══════════════════════════════════════════
    n_golvreglar = max(2, int(B / regel_cc) + 1)
    golvregel_form = cq.Workplane("XY").box(golvregel_b, L, golvregel_h)

    for i in range(n_golvreglar):
        x = (i / (n_golvreglar - 1)) * B - B / 2 if n_golvreglar > 1 else 0
        assy.add(
            golvregel_form,
            name=f"golvregel_{i}",
            loc=cq.Location(cq.Vector(x, 0, golvregel_h / 2)),
            color=cq.Color(0.65, 0.47, 0.28, 1),
        )

    # ══════════════════════════════════════════
    # 2. GOLVBRÄDOR
    # ══════════════════════════════════════════
    golv_form = cq.Workplane("XY").box(golv_w, L, golv_t)
    n_golv = int(B / golv_cc)

    for i in range(n_golv):
        x = -B / 2 + golv_w / 2 + i * golv_cc
        assy.add(
            golv_form,
            name=f"golv_{i}",
            loc=cq.Location(cq.Vector(x, 0, golvregel_h + golv_t / 2)),
            color=cq.Color(0.72, 0.55, 0.35, 1),
        )

    # ══════════════════════════════════════════
    # 3. VÄGGSTOMME (reglar)
    # ══════════════════════════════════════════
    # Syll och hammarband (liggande reglar, 4 st per vägg — ovan/under)
    syll_form_lang = cq.Workplane("XY").box(B, regel_b, regel_h)
    syll_form_kort = cq.Workplane("XY").box(regel_b, L - 2 * regel_b, regel_h)

    # Syllar (underkant väggar, på golvet)
    syll_z = golv_ok + regel_h / 2
    for si, sy in enumerate([-L / 2 + regel_b / 2, L / 2 - regel_b / 2]):
        assy.add(syll_form_lang, name=f"stomme_syll_lang_{si}",
                 loc=cq.Location(cq.Vector(0, sy, syll_z)),
                 color=cq.Color(0.55, 0.40, 0.22, 1))
    for si, sx in enumerate([-B / 2 + regel_b / 2, B / 2 - regel_b / 2]):
        assy.add(syll_form_kort, name=f"stomme_syll_kort_{si}",
                 loc=cq.Location(cq.Vector(sx, 0, syll_z)),
                 color=cq.Color(0.55, 0.40, 0.22, 1))

    # Hammarband (ovankant väggar)
    hammar_z = golv_ok + H - regel_h / 2
    for si, sy in enumerate([-L / 2 + regel_b / 2, L / 2 - regel_b / 2]):
        assy.add(syll_form_lang, name=f"stomme_hammar_lang_{si}",
                 loc=cq.Location(cq.Vector(0, sy, hammar_z)),
                 color=cq.Color(0.55, 0.40, 0.22, 1))
    for si, sx in enumerate([-B / 2 + regel_b / 2, B / 2 - regel_b / 2]):
        assy.add(syll_form_kort, name=f"stomme_hammar_kort_{si}",
                 loc=cq.Location(cq.Vector(sx, 0, hammar_z)),
                 color=cq.Color(0.55, 0.40, 0.22, 1))

    # Stående reglar i väggarna
    vagg_h = H - 2 * regel_h  # höjd mellan syll och hammarband
    stod_form = cq.Workplane("XY").box(regel_b, regel_b, vagg_h)
    stod_z = golv_ok + regel_h + vagg_h / 2

    # Långväggar (y = ±L/2)
    n_stod_lang = max(2, int(B / regel_cc) + 1)
    for si, sy in enumerate([-L / 2 + regel_b / 2, L / 2 - regel_b / 2]):
        for i in range(n_stod_lang):
            x = (i / (n_stod_lang - 1)) * (B - regel_b) - (B - regel_b) / 2 if n_stod_lang > 1 else 0
            assy.add(stod_form, name=f"stomme_stod_lang_{si}_{i}",
                     loc=cq.Location(cq.Vector(x, sy, stod_z)),
                     color=cq.Color(0.55, 0.40, 0.22, 1))

    # Kortväggar/gavlar (x = ±B/2)
    n_stod_kort = max(2, int(L / regel_cc) + 1)
    for si, sx in enumerate([-B / 2 + regel_b / 2, B / 2 - regel_b / 2]):
        for j in range(n_stod_kort):
            y = (j / (n_stod_kort - 1)) * (L - regel_b) - (L - regel_b) / 2 if n_stod_kort > 1 else 0
            assy.add(stod_form, name=f"stomme_stod_kort_{si}_{j}",
                     loc=cq.Location(cq.Vector(sx, y, stod_z)),
                     color=cq.Color(0.55, 0.40, 0.22, 1))

    # ══════════════════════════════════════════
    # 4. TAK (sadeltak)
    # ══════════════════════════════════════════
    # Nockbräda
    nock_z = golv_ok + nock_hojd
    nock_form = cq.Workplane("XY").box(regel_b, L + 2 * tak_utsprang, regel_h)
    assy.add(nock_form, name="tak_nock",
             loc=cq.Location(cq.Vector(0, 0, nock_z - regel_h / 2)),
             color=cq.Color(0.50, 0.35, 0.20, 1))

    # Takpaneler (två sidor av sadeltaket)
    tak_halv_b = B / 2 + tak_utsprang
    tak_langd_sida = tak_halv_b / math.cos(tak_vinkel_rad)
    tak_panel = cq.Workplane("XY").box(tak_langd_sida, L + 2 * tak_utsprang, takpanel_t)

    for ti, sign in enumerate([-1, 1]):
        # Rotera kring Y-axeln (pitch)
        vinkel = sign * tak_vinkel
        cx = sign * tak_halv_b / 2
        cz = golv_ok + H + nock_over_vagg / 2
        assy.add(
            tak_panel,
            name=f"tak_panel_{ti}",
            loc=cq.Location(
                cq.Vector(cx, 0, cz),
                cq.Vector(0, 1, 0), vinkel
            ),
            color=cq.Color(0.45, 0.30, 0.18, 1),
        )

    # ══════════════════════════════════════════
    # 5. VÄGGPANEL (locklistpanel)
    # ══════════════════════════════════════════
    panel_form_lang = cq.Workplane("XY").box(panel_t, panel_w, H - 2 * regel_h)
    panel_form_kort = cq.Workplane("XY").box(panel_w, panel_t, H - 2 * regel_h)
    panel_z = golv_ok + regel_h + (H - 2 * regel_h) / 2

    # Långväggar (y = ±L/2, paneler i x-riktningen)
    n_panel_lang = int(B / panel_cc)
    for si, sy in enumerate([-L / 2, L / 2]):
        y_pos = sy - panel_t / 2 if sy > 0 else sy + panel_t / 2
        for i in range(n_panel_lang):
            x = -B / 2 + panel_w / 2 + i * panel_cc

            # Hoppa över dörröppning på framsidan (-Y)
            if si == 0:  # framsida
                if dorr_x - B / 2 < x + panel_w / 2 and x - panel_w / 2 < dorr_x - B / 2 + dorr_b:
                    continue

            assy.add(panel_form_kort, name=f"panel_lang_{si}_{i}",
                     loc=cq.Location(cq.Vector(x, y_pos, panel_z)),
                     color=cq.Color(0.70, 0.25, 0.20, 1))  # Faluröd

    # Kortväggar (x = ±B/2, paneler i y-riktningen)
    n_panel_kort = int(L / panel_cc)
    for si, sx in enumerate([-B / 2, B / 2]):
        x_pos = sx - panel_t / 2 if sx > 0 else sx + panel_t / 2
        for j in range(n_panel_kort):
            y = -L / 2 + panel_w / 2 + j * panel_cc

            # Hoppa över fönsteröppning på östsidan (+X)
            if si == 1:
                fon_y_start = fonster_b / 2 - L / 2 + (L - fonster_b) / 2
                fon_y_slut = fon_y_start + fonster_b
                if fon_y_start - panel_w / 2 < y + panel_w / 2 and y - panel_w / 2 < fon_y_slut:
                    continue

            assy.add(panel_form_lang, name=f"panel_kort_{si}_{j}",
                     loc=cq.Location(cq.Vector(x_pos, y, panel_z)),
                     color=cq.Color(0.70, 0.25, 0.20, 1))  # Faluröd

    # ══════════════════════════════════════════
    # 6. DÖRR
    # ══════════════════════════════════════════
    dorr_form = cq.Workplane("XY").box(dorr_b, panel_t + 10, dorr_h)
    dorr_z = golv_ok + dorr_h / 2
    assy.add(dorr_form, name="dorr_0",
             loc=cq.Location(cq.Vector(0, -L / 2, dorr_z)),
             color=cq.Color(0.85, 0.85, 0.75, 1))  # Ljus

    # ══════════════════════════════════════════
    # 7. FÖNSTER
    # ══════════════════════════════════════════
    fonster_form = cq.Workplane("XY").box(panel_t + 10, fonster_b, fonster_h)
    fonster_z_pos = golv_ok + fonster_z + fonster_h / 2
    assy.add(fonster_form, name="fonster_0",
             loc=cq.Location(cq.Vector(B / 2, 0, fonster_z_pos)),
             color=cq.Color(0.75, 0.85, 0.95, 1))  # Ljusblå (glas)

    return assy
