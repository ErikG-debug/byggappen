"""
Parametrisk pergolamodell i CadQuery.

Baserad på svenska konstruktionsstandarder:
- Stolpar: 120×120 mm tryckimpregnerad, max cc 2500 mm
- Bärbalkar: 45×195 mm, längs bredden
- Spjälor: 45×70 mm, cc 150 mm, tvärs över balkarna
"""

import cadquery as cq
import math


def bygg_pergola(bredd: float = 3.0, langd: float = 3.0, hojd: float = 2.4):
    """
    Bygger en komplett pergolamodell.

    Args:
        bredd: Pergolans bredd i meter
        langd: Pergolans djup i meter
        hojd: Stolphöjd i meter

    Returns:
        CadQuery Assembly med namngivna delar
    """
    assy = cq.Assembly(name="pergola")

    # Konvertera till mm
    B = bredd * 1000
    L = langd * 1000
    H = hojd * 1000

    # ══════════════════════════════════════════
    # VIRKESDIMENSIONER
    # ══════════════════════════════════════════

    # Stolpar — 120×120 mm
    stolpe_dim = 120
    plint_djup = 400

    # Bärbalkar — 45×195 mm (längs L-riktningen, bärs av stolparna)
    balk_b = 45
    balk_h = 195

    # Spjälor — 45×70 mm, cc 150 mm (tvärs, vilar på balkarna)
    spjal_b = 45
    spjal_h = 70
    spjal_cc = 150

    # Max cc mellan stolpar
    max_stolp_cc = 2500

    # ══════════════════════════════════════════
    # BERÄKNADE STOLPPOSITIONER
    # ══════════════════════════════════════════

    def fordela_positioner(langd_mm, max_cc):
        """Fördela stolpar jämnt med max cc-avstånd."""
        positioner = [0, langd_mm]
        if langd_mm > max_cc:
            n_mellan = math.ceil(langd_mm / max_cc) - 1
            avst = langd_mm / (n_mellan + 1)
            for i in range(1, n_mellan + 1):
                positioner.append(round(i * avst))
        positioner.sort()
        return positioner

    stolp_pos_b = fordela_positioner(B, max_stolp_cc)
    stolp_pos_l = fordela_positioner(L, max_stolp_cc)

    # ══════════════════════════════════════════
    # 1. STOLPAR
    # ══════════════════════════════════════════
    stolpe_total_h = H + plint_djup
    stolpe_form = cq.Workplane("XY").box(stolpe_dim, stolpe_dim, stolpe_total_h)

    for i, xp in enumerate(stolp_pos_b):
        for j, yp in enumerate(stolp_pos_l):
            x = xp - B / 2
            y = yp - L / 2
            z = H / 2 - plint_djup / 2
            assy.add(
                stolpe_form,
                name=f"stolpe_{i}_{j}",
                loc=cq.Location(cq.Vector(x, y, z)),
                color=cq.Color(0.55, 0.40, 0.22, 1),
            )

    # ══════════════════════════════════════════
    # 2. BÄRBALKAR (längs L, en per stolprad i B-riktningen)
    # ══════════════════════════════════════════
    # Balkarna sticker ut lite utanför stolparna
    balk_utsprang = 200
    balk_langd = L + 2 * balk_utsprang
    balk_form = cq.Workplane("XY").box(balk_b, balk_langd, balk_h)

    balk_z = H + balk_h / 2  # ovanpå stolparna

    for i, xp in enumerate(stolp_pos_b):
        x = xp - B / 2
        assy.add(
            balk_form,
            name=f"balk_{i}",
            loc=cq.Location(cq.Vector(x, 0, balk_z)),
            color=cq.Color(0.65, 0.47, 0.28, 1),
        )

    # ══════════════════════════════════════════
    # 3. SPJÄLOR (tvärs, cc 150 mm, vilar på balkarna)
    # ══════════════════════════════════════════
    spjal_utsprang = 150
    spjal_langd = B + 2 * spjal_utsprang
    spjal_form = cq.Workplane("XY").box(spjal_langd, spjal_b, spjal_h)

    spjal_z = balk_z + balk_h / 2 + spjal_h / 2  # ovanpå balkarna

    n_spjalor = int(balk_langd / spjal_cc)
    spjal_start = -(balk_langd / 2) + spjal_b / 2

    for i in range(n_spjalor):
        y = spjal_start + i * spjal_cc
        assy.add(
            spjal_form,
            name=f"spjala_{i}",
            loc=cq.Location(cq.Vector(0, y, spjal_z)),
            color=cq.Color(0.60, 0.44, 0.26, 1),
        )

    return assy
