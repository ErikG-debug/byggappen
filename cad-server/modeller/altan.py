"""
Parametrisk altanmodell i CadQuery.

Baserad på svenska konstruktionsstandarder (TräGuiden, Boverket BBR):
- Stolpar: 95×95 mm tryckimpregnerad (NTR/A), max cc 1200 mm
- Bärlinor: 45×195 mm (NTR/A), vilar på stolparna
- Golvreglar (joists): 45×145 mm, cc 600 mm (standardavstånd)
- Trallbrädor: 28×120 mm tryckimpregnerad furu, cc 126 mm (6 mm gap)
- Kantbräda: 28×120 mm runt altankant
- Räcke: krävs vid höjd > 500 mm (BBR), min 900 mm högt, max 100 mm spjälgap
- Trappa: stegdjup 250-300 mm, steghöjd 150-200 mm

Källor:
- TräGuiden (traguiden.se) — altanbjälklag, principlösning
- Byggahus.se — virkesdimensioner
- Husgrunder.com — regelavstånd och plintar
- Boverket BBR — krav på räcke och säkerhet
"""

import cadquery as cq
import math


def bygg_altan(bredd: float = 4.0, langd: float = 3.0, hojd: float = 0.6):
    """
    Bygger en komplett altanmodell enligt svenska konstruktionsstandarder.

    Args:
        bredd: Altanens bredd i meter (längs husväggen)
        langd: Altanens djup i meter (ut från huset)
        hojd: Höjd från mark till trallgolvets ovansida i meter

    Returns:
        CadQuery Assembly med namngivna delar
    """
    assy = cq.Assembly(name="altan")

    # Konvertera till mm
    B = bredd * 1000
    L = langd * 1000
    H = hojd * 1000

    # ══════════════════════════════════════════
    # VIRKESDIMENSIONER (svenska standardmått)
    # ══════════════════════════════════════════

    # Stolpar — 95×95 mm, tryckimpregnerad NTR/A
    # Tillräckligt för altanhöjder upp till ~1.5m
    stolpe_w = 95
    stolpe_d = 95
    plint_djup = 400  # del under mark (betongplint)

    # Bärlinor — 45×195 mm, bär golvreglarna
    barlina_b = 45
    barlina_h = 195

    # Golvreglar — 45×145 mm, cc 600 mm
    regel_b = 45
    regel_h = 145
    regel_cc = 600  # center-to-center standard

    # Trallbrädor — 28×120 mm, cc 126 mm (6mm gap)
    trall_t = 28    # tjocklek
    trall_w = 120   # bredd
    trall_cc = 126  # cc-avstånd (120 + 6mm gap)

    # Kantbräda — 28×120 mm runt altankant
    kant_t = 28
    kant_h = 120

    # Räcke (BBR: krävs vid höjd > 500 mm)
    racke_stolpe_w = 70
    racke_h_total = 1000   # min 900 mm, standard 1000 mm
    racke_cc = 900          # max avstånd mellan räckesstolpar
    ledstang_b = 45
    ledstang_h = 70
    spjala_b = 20
    spjala_w = 45
    spjala_max_gap = 100    # BBR: max 100 mm för barnsäkerhet

    # Trappa
    steg_djup = 280         # steglöp
    steg_hojd_maal = 175    # målhöjd per steg (150-200 mm intervall)
    trapp_bredd = 900       # standardbredd
    vang_b = 45
    vang_h = 220

    # ══════════════════════════════════════════
    # BERÄKNADE VÄRDEN
    # ══════════════════════════════════════════

    # Golv-ovansida = H (detta är referenspunkten)
    # Trall-underkant = H - trall_t
    # Regel-ovansida = H - trall_t
    # Regel-underkant = H - trall_t - regel_h
    # Bärlina-ovansida = H - trall_t - regel_h
    # Bärlina-underkant = H - trall_t - regel_h - barlina_h

    golv_ok = H
    regel_ok = golv_ok - trall_t
    regel_uk = regel_ok - regel_h
    barlina_ok = regel_uk
    barlina_uk = barlina_ok - barlina_h
    stolpe_ok = barlina_uk  # stolpe bär underkant bärlina

    # Stolphöjd: från plint till underkant bärlina
    stolpe_langd = stolpe_ok + plint_djup

    # ══════════════════════════════════════════
    # 1. STOLPAR (plintar)
    # ══════════════════════════════════════════
    # Max cc 1200 mm mellan stolpar
    stolpe_max_cc = 1200
    n_stolpar_b = max(2, math.ceil(B / stolpe_max_cc) + 1)
    n_stolpar_l = max(2, math.ceil(L / stolpe_max_cc) + 1)

    stolpe_form = cq.Workplane("XY").box(stolpe_w, stolpe_d, stolpe_langd)

    for i in range(n_stolpar_b):
        x = (i / (n_stolpar_b - 1)) * B - B / 2 if n_stolpar_b > 1 else 0
        for j in range(n_stolpar_l):
            y = (j / (n_stolpar_l - 1)) * L - L / 2 if n_stolpar_l > 1 else 0
            # Stolpens centrum z: halva stolplängden, förskjuten nedåt med plintdjup
            z = stolpe_ok - stolpe_langd / 2
            assy.add(
                stolpe_form,
                name=f"stolpe_{i}_{j}",
                loc=cq.Location(cq.Vector(x, y, z)),
                color=cq.Color(0.55, 0.40, 0.22, 1),
            )

    # ══════════════════════════════════════════
    # 2. BÄRLINOR (längs bredd, vilar på stolpar)
    # ══════════════════════════════════════════
    barlina_form = cq.Workplane("XY").box(B, barlina_b, barlina_h)

    # Beräkna y-positioner: en bärlina per stolprad i L-riktningen
    for j in range(n_stolpar_l):
        y = (j / (n_stolpar_l - 1)) * L - L / 2 if n_stolpar_l > 1 else 0
        assy.add(
            barlina_form,
            name=f"barlina_{j}",
            loc=cq.Location(cq.Vector(0, y, barlina_ok - barlina_h / 2)),
            color=cq.Color(0.65, 0.47, 0.28, 1),
        )

    # ══════════════════════════════════════════
    # 3. GOLVREGLAR (tvärs, cc 600 mm, vilar på bärlinor)
    # ══════════════════════════════════════════
    regel_form = cq.Workplane("XY").box(regel_b, L, regel_h)

    n_reglar = max(2, int(B / regel_cc) + 1)
    # Jämnt fördelat, med en regel i varje kant
    for i in range(n_reglar):
        x = (i / (n_reglar - 1)) * B - B / 2 if n_reglar > 1 else 0
        assy.add(
            regel_form,
            name=f"regel_{i}",
            loc=cq.Location(cq.Vector(x, 0, regel_ok - regel_h / 2)),
            color=cq.Color(0.65, 0.47, 0.28, 1),
        )

    # ══════════════════════════════════════════
    # 4. TRALLBRÄDOR (längs bredd, cc 126 mm)
    # ══════════════════════════════════════════
    trall_form = cq.Workplane("XY").box(trall_w, L, trall_t)

    n_trall = int(B / trall_cc)
    offset_x = -B / 2 + trall_w / 2

    for i in range(n_trall):
        x = offset_x + i * trall_cc
        assy.add(
            trall_form,
            name=f"trall_{i}",
            loc=cq.Location(cq.Vector(x, 0, golv_ok - trall_t / 2)),
            color=cq.Color(0.72, 0.55, 0.35, 1),
        )

    # ══════════════════════════════════════════
    # 5. KANTBRÄDA (runt altankant, 28×120 mm)
    # ══════════════════════════════════════════
    # Främre och bakre kant (längs B)
    kant_lang = cq.Workplane("XY").box(B, kant_t, kant_h)
    for ki, ky in enumerate([-L / 2 + kant_t / 2, L / 2 - kant_t / 2]):
        assy.add(
            kant_lang,
            name=f"kantbrada_lang_{ki}",
            loc=cq.Location(cq.Vector(0, ky, golv_ok - kant_h / 2)),
            color=cq.Color(0.68, 0.50, 0.30, 1),
        )

    # Vänster och höger kant (längs L)
    kant_kort = cq.Workplane("XY").box(kant_t, L - 2 * kant_t, kant_h)
    for ki, kx in enumerate([-B / 2 + kant_t / 2, B / 2 - kant_t / 2]):
        assy.add(
            kant_kort,
            name=f"kantbrada_kort_{ki}",
            loc=cq.Location(cq.Vector(kx, 0, golv_ok - kant_h / 2)),
            color=cq.Color(0.68, 0.50, 0.30, 1),
        )

    # ══════════════════════════════════════════
    # 6. RÄCKE (BBR: krävs om H > 500 mm)
    # ══════════════════════════════════════════
    if H > 500:
        racke_stolpe_form = cq.Workplane("XY").box(
            racke_stolpe_w, racke_stolpe_w, racke_h_total
        )

        # Positioner: tre sidor (inte hussidan = bakre/+Y)
        positioner = []

        # Främre sidan (-Y)
        n_fram = max(2, math.ceil(B / racke_cc) + 1)
        for i in range(n_fram):
            x = (i / (n_fram - 1)) * B - B / 2 if n_fram > 1 else 0
            positioner.append((x, -L / 2))

        # Sidorna
        n_sida = max(2, math.ceil(L / racke_cc) + 1)
        for j in range(1, n_sida):  # hoppa över hörn (redan med)
            y = (j / (n_sida - 1)) * L - L / 2 if n_sida > 1 else 0
            positioner.append((-B / 2, y))
            positioner.append((B / 2, y))

        for idx, (rx, ry) in enumerate(positioner):
            assy.add(
                racke_stolpe_form,
                name=f"racke_stolpe_{idx}",
                loc=cq.Location(
                    cq.Vector(rx, ry, golv_ok + racke_h_total / 2)
                ),
                color=cq.Color(0.60, 0.44, 0.26, 1),
            )

        # Ledstång (45×70 mm) längs tre sidor
        ledstang_z = golv_ok + racke_h_total - ledstang_h / 2

        # Främre
        assy.add(
            cq.Workplane("XY").box(B, ledstang_b, ledstang_h),
            name="ledstang_fram",
            loc=cq.Location(cq.Vector(0, -L / 2, ledstang_z)),
            color=cq.Color(0.60, 0.44, 0.26, 1),
        )
        # Sidor
        for si, sx in enumerate([-B / 2, B / 2]):
            assy.add(
                cq.Workplane("XY").box(ledstang_b, L, ledstang_h),
                name=f"ledstang_sida_{si}",
                loc=cq.Location(cq.Vector(sx, 0, ledstang_z)),
                color=cq.Color(0.60, 0.44, 0.26, 1),
            )

        # Mellanstång (halvhöjd, samma dim som ledstång)
        mellan_z = golv_ok + racke_h_total / 2
        assy.add(
            cq.Workplane("XY").box(B, ledstang_b, ledstang_h),
            name="mellanstang_fram",
            loc=cq.Location(cq.Vector(0, -L / 2, mellan_z)),
            color=cq.Color(0.60, 0.44, 0.26, 1),
        )
        for si, sx in enumerate([-B / 2, B / 2]):
            assy.add(
                cq.Workplane("XY").box(ledstang_b, L, ledstang_h),
                name=f"mellanstang_sida_{si}",
                loc=cq.Location(cq.Vector(sx, 0, mellan_z)),
                color=cq.Color(0.60, 0.44, 0.26, 1),
            )

        # Spjälor längs främre sidan (max 100 mm gap)
        spjala_h_eff = racke_h_total - ledstang_h - 50
        spjala_form = cq.Workplane("XY").box(spjala_b, spjala_w, spjala_h_eff)
        spjala_cc = spjala_b + spjala_max_gap  # 20 + 100 = 120 mm cc
        n_spjalor = max(2, int(B / spjala_cc))

        for i in range(n_spjalor):
            x = (i + 0.5) * (B / n_spjalor) - B / 2
            assy.add(
                spjala_form,
                name=f"spjala_{i}",
                loc=cq.Location(
                    cq.Vector(x, -L / 2, golv_ok + 25 + spjala_h_eff / 2)
                ),
                color=cq.Color(0.60, 0.44, 0.26, 1),
            )

    # ══════════════════════════════════════════
    # 7. TRAPPA (centrerad på främre sidan)
    # ══════════════════════════════════════════
    n_steg = max(1, round(H / steg_hojd_maal))
    faktisk_steg_hojd = H / n_steg

    # Trappvångar
    vang_total_langd = math.sqrt((n_steg * steg_djup) ** 2 + H ** 2)
    vang_form = cq.Workplane("XY").box(vang_b, n_steg * steg_djup, vang_h)

    for vi, vx in enumerate([-trapp_bredd / 2, trapp_bredd / 2]):
        assy.add(
            vang_form,
            name=f"trappvang_{vi}",
            loc=cq.Location(
                cq.Vector(vx, -L / 2 - n_steg * steg_djup / 2, H / 2)
            ),
            color=cq.Color(0.55, 0.40, 0.22, 1),
        )

    # Trappsteg (28×120 mm × 2 brädor per steg)
    steg_form = cq.Workplane("XY").box(trapp_bredd - 2 * vang_b, steg_djup * 0.85, trall_t)
    for s in range(n_steg):
        sz = H - (s + 1) * faktisk_steg_hojd + trall_t / 2
        sy = -L / 2 - (s + 0.5) * steg_djup
        assy.add(
            steg_form,
            name=f"trappsteg_{s}",
            loc=cq.Location(cq.Vector(0, sy, sz)),
            color=cq.Color(0.72, 0.55, 0.35, 1),
        )

    return assy
