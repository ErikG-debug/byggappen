"""
CadQuery CAD-server för Byggappen.
Genererar 2D-ritningar (färgkodade SVG) och 3D-modeller (STL) per lager.
"""

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
import cadquery as cq
from cadquery import exporters
from cadquery.occ_impl.shapes import Shape, Compound
from cadquery.occ_impl.geom import BoundBox
from cadquery.occ_impl.exporters.svg import makeSVGedge, TOLERANCE
import tempfile
import os
import base64

from OCP.gp import gp_Ax2, gp_Pnt, gp_Dir
from OCP.BRepLib import BRepLib
from OCP.HLRBRep import HLRBRep_Algo, HLRBRep_HLRToShape
from OCP.HLRAlgo import HLRAlgo_Projector

from modeller.altan import bygg_altan
from modeller.lekstuga import bygg_lekstuga
from modeller.pergola import bygg_pergola

app = FastAPI(title="Byggappen CAD Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODELLER = {
    "altan": bygg_altan,
    "lekstuga": bygg_lekstuga,
    "pergola": bygg_pergola,
}

# Lager-grupper: mappa namnprefix i CadQuery till lagernamn
LAGER_MAP = {
    "altan": {
        "stolpe":      {"etikett": "Stolpar",    "farg": [0.55, 0.40, 0.22], "svg_farg": "#8B4513"},
        "barlina":     {"etikett": "Bärlinor",   "farg": [0.65, 0.47, 0.28], "svg_farg": "#D2691E"},
        "regel":       {"etikett": "Reglar",     "farg": [0.65, 0.47, 0.28], "svg_farg": "#2E86C1"},
        "trall":       {"etikett": "Trall",      "farg": [0.72, 0.55, 0.35], "svg_farg": "#27AE60"},
        "kantbrada":   {"etikett": "Kantbräda",  "farg": [0.68, 0.50, 0.30], "svg_farg": "#E67E22"},
        "racke":       {"etikett": "Räcke",      "farg": [0.60, 0.44, 0.26], "svg_farg": "#8E44AD"},
        "ledstang":    {"etikett": "Räcke",      "farg": [0.60, 0.44, 0.26], "svg_farg": "#8E44AD"},
        "mellanstang": {"etikett": "Räcke",      "farg": [0.60, 0.44, 0.26], "svg_farg": "#8E44AD"},
        "spjala":      {"etikett": "Räcke",      "farg": [0.60, 0.44, 0.26], "svg_farg": "#8E44AD"},
        "trappvang":   {"etikett": "Trappa",     "farg": [0.55, 0.40, 0.22], "svg_farg": "#C0392B"},
        "trappsteg":   {"etikett": "Trappa",     "farg": [0.72, 0.55, 0.35], "svg_farg": "#C0392B"},
    },
    "lekstuga": {
        "golvregel":   {"etikett": "Golvreglar",  "farg": [0.65, 0.47, 0.28], "svg_farg": "#D2691E"},
        "golv":        {"etikett": "Golv",         "farg": [0.72, 0.55, 0.35], "svg_farg": "#27AE60"},
        "stomme":      {"etikett": "Stomme",       "farg": [0.55, 0.40, 0.22], "svg_farg": "#8B4513"},
        "tak":         {"etikett": "Tak",          "farg": [0.45, 0.30, 0.18], "svg_farg": "#7D3C98"},
        "panel":       {"etikett": "Panel",        "farg": [0.70, 0.25, 0.20], "svg_farg": "#C0392B"},
        "dorr":        {"etikett": "Dörr",         "farg": [0.85, 0.85, 0.75], "svg_farg": "#F39C12"},
        "fonster":     {"etikett": "Fönster",      "farg": [0.75, 0.85, 0.95], "svg_farg": "#3498DB"},
    },
    "pergola": {
        "stolpe":      {"etikett": "Stolpar",      "farg": [0.55, 0.40, 0.22], "svg_farg": "#8B4513"},
        "balk":        {"etikett": "Bärbalkar",    "farg": [0.65, 0.47, 0.28], "svg_farg": "#D2691E"},
        "spjala":      {"etikett": "Spjälor",      "farg": [0.60, 0.44, 0.26], "svg_farg": "#E67E22"},
    },
}

# Vy-titlar
VY_TITLAR = {
    "plan": "PLANVY (ovanifrån)",
    "front": "FRONTVY (framifrån)",
    "sida": "SIDOVY (från sidan)",
    "iso": "ISOMETRISK VY",
}


def _get_lager_key(part_name, projekt):
    """Bestäm vilken lagergrupp en del tillhör baserat på namn."""
    lager_map = LAGER_MAP.get(projekt, {})
    for prefix in lager_map:
        if part_name.startswith(prefix):
            return lager_map[prefix]["etikett"]
    return "Övrigt"


def _get_svg_farger(projekt):
    """Hämta unika SVG-färger per lager-etikett."""
    lager_map = LAGER_MAP.get(projekt, {})
    farger = {}
    for info in lager_map.values():
        if info["etikett"] not in farger:
            farger[info["etikett"]] = info.get("svg_farg", "#333333")
    return farger


def _group_assembly_shapes(assy, projekt):
    """Gruppera assembly-delar per lager som CadQuery Shape-objekt."""
    groups = {}
    for child in assy.children:
        if not hasattr(child, "obj") or child.obj is None:
            continue
        if not hasattr(child.obj, "val"):
            continue

        s = child.obj.val()
        loc = child.loc
        if loc:
            s = s.moved(loc)

        lager_key = _get_lager_key(child.name, projekt)
        if lager_key not in groups:
            groups[lager_key] = []
        groups[lager_key].append(s)

    return groups


def _hlr_edges_for_shape(shape, projector):
    """Kör HLR på en shape med given projektor och returnera synliga kanter som SVG-paths."""
    hlr = HLRBRep_Algo()
    hlr.Add(shape.wrapped)
    hlr.Projector(projector)
    hlr.Update()
    hlr.Hide()

    hlr_shapes = HLRBRep_HLRToShape(hlr)

    visible = []
    visible_sharp = hlr_shapes.VCompound()
    if not visible_sharp.IsNull():
        visible.append(visible_sharp)

    visible_smooth = hlr_shapes.Rg1LineVCompound()
    if not visible_smooth.IsNull():
        visible.append(visible_smooth)

    visible_contour = hlr_shapes.OutLineVCompound()
    if not visible_contour.IsNull():
        visible.append(visible_contour)

    # Fix underlying geometry
    for el in visible:
        BRepLib.BuildCurves3d_s(el, TOLERANCE)

    # Convert to paths
    paths = []
    for s in visible:
        for e in Shape(s).Edges():
            paths.append(makeSVGedge(e))

    return paths


def _build_svg_legend(farger, x_start, y_start):
    """Bygg en horisontell teckenförklaring."""
    svg = f'<g id="legend" transform="translate({x_start},{y_start})">\n'
    svg += f'  <text x="0" y="0" font-size="11" font-weight="600" fill="#555" font-family="Inter, Arial, sans-serif">Teckenförklaring</text>\n'

    x = 0
    y = 18
    spacing = 0
    items = list(farger.items())

    for i, (namn, farg) in enumerate(items):
        svg += f'  <line x1="{x + spacing}" y1="{y}" x2="{x + spacing + 24}" y2="{y}" stroke="{farg}" stroke-width="3" stroke-linecap="round"/>\n'
        svg += f'  <text x="{x + spacing + 30}" y="{y + 4}" font-size="11" fill="#444" font-family="Inter, Arial, sans-serif">{namn}</text>\n'
        # Beräkna bredd för nästa item
        text_width = len(namn) * 7 + 40
        spacing += text_width

    svg += '</g>\n'
    return svg


def _build_dimension_lines(direction, dimensioner, bb_pixels, width, height):
    """Bygg måttlinjer baserat på ritningens pixel-bounding-box."""
    bredd_mm = int(dimensioner["bredd"] * 1000)
    langd_mm = int(dimensioner["langd"] * 1000)
    hojd_mm = int(dimensioner["hojd"] * 1000)

    # bb_pixels = (px_left, px_top, px_right, px_bottom) i SVG pixel-space
    px_left, px_top, px_right, px_bottom = bb_pixels

    svg = '<g id="dimensions" fill="#555" font-family="Inter, Arial, sans-serif" font-size="12">\n'

    margin_offset = 30

    if direction == "plan":
        # Bredd = horisontell, Djup = vertikal
        svg += _dim_line_h(px_left, px_right, px_bottom + margin_offset, f"{bredd_mm} mm")
        svg += _dim_line_v(px_right + margin_offset, px_top, px_bottom, f"{langd_mm} mm")

    elif direction == "front":
        # Bredd = horisontell, Höjd = vertikal
        svg += _dim_line_h(px_left, px_right, px_bottom + margin_offset, f"{bredd_mm} mm")
        svg += _dim_line_v(px_right + margin_offset, px_top, px_bottom, f"{hojd_mm} mm")

    elif direction == "sida":
        # Djup = horisontell, Höjd = vertikal
        svg += _dim_line_h(px_left, px_right, px_bottom + margin_offset, f"{langd_mm} mm")
        svg += _dim_line_v(px_right + margin_offset, px_top, px_bottom, f"{hojd_mm} mm")

    svg += '</g>\n'
    return svg


def _dim_line_h(x0, x1, y, label):
    """Horisontell måttlinje med tick-markeringar."""
    tick = 5
    mid = (x0 + x1) / 2
    s = ''
    # Förlängningslinjer
    s += f'  <line x1="{x0:.1f}" y1="{y-tick:.1f}" x2="{x0:.1f}" y2="{y+tick:.1f}" stroke="#888" stroke-width="0.8"/>\n'
    s += f'  <line x1="{x1:.1f}" y1="{y-tick:.1f}" x2="{x1:.1f}" y2="{y+tick:.1f}" stroke="#888" stroke-width="0.8"/>\n'
    # Måttlinje
    s += f'  <line x1="{x0:.1f}" y1="{y:.1f}" x2="{x1:.1f}" y2="{y:.1f}" stroke="#888" stroke-width="0.8"/>\n'
    # Text
    s += f'  <text x="{mid:.1f}" y="{y+18:.1f}" text-anchor="middle" font-size="12" font-weight="600" fill="#444">{label}</text>\n'
    return s


def _dim_line_v(x, y0, y1, label):
    """Vertikal måttlinje med tick-markeringar."""
    tick = 5
    mid = (y0 + y1) / 2
    s = ''
    # Förlängningslinjer
    s += f'  <line x1="{x-tick:.1f}" y1="{y0:.1f}" x2="{x+tick:.1f}" y2="{y0:.1f}" stroke="#888" stroke-width="0.8"/>\n'
    s += f'  <line x1="{x-tick:.1f}" y1="{y1:.1f}" x2="{x+tick:.1f}" y2="{y1:.1f}" stroke="#888" stroke-width="0.8"/>\n'
    # Måttlinje
    s += f'  <line x1="{x:.1f}" y1="{y0:.1f}" x2="{x:.1f}" y2="{y1:.1f}" stroke="#888" stroke-width="0.8"/>\n'
    # Text (roterad)
    s += f'  <text x="{x+16:.1f}" y="{mid:.1f}" text-anchor="middle" font-size="12" font-weight="600" fill="#444" transform="rotate(-90,{x+16:.1f},{mid:.1f})">{label}</text>\n'
    return s


def assembly_to_workplane(assy):
    """Konverterar en CadQuery Assembly till en Workplane för export."""
    shapes = []
    for child in assy.children:
        if hasattr(child, "obj") and child.obj is not None:
            if hasattr(child.obj, "val"):
                s = child.obj.val()
                loc = child.loc
                if loc:
                    s = s.moved(loc)
                shapes.append(s)
    if not shapes:
        raise ValueError("Inga shapes hittades i assemblyt")
    compound = cq.Compound.makeCompound(shapes)
    return cq.Workplane("XY").newObject([compound])


def assembly_to_layers(assy, projekt):
    """Gruppera assembly-delar per lager och exportera varje som STL."""
    groups = {}
    for child in assy.children:
        if not hasattr(child, "obj") or child.obj is None:
            continue
        if not hasattr(child.obj, "val"):
            continue

        s = child.obj.val()
        loc = child.loc
        if loc:
            s = s.moved(loc)

        lager_key = _get_lager_key(child.name, projekt)
        if lager_key not in groups:
            groups[lager_key] = []
        groups[lager_key].append(s)

    result = {}
    for lager_key, shapes in groups.items():
        compound = cq.Compound.makeCompound(shapes)
        wp = cq.Workplane("XY").newObject([compound])
        tmp = tempfile.mktemp(suffix=".stl")
        exporters.export(wp, tmp, exporters.ExportTypes.STL)
        with open(tmp, "rb") as f:
            data = f.read()
        os.unlink(tmp)
        result[lager_key] = base64.b64encode(data).decode("ascii")

    return result


def export_colored_svg_view(assy, projekt, direction, dimensioner, width=800, height=600):
    """Exportera en färgkodad SVG-vy med per-lager färger, teckenförklaring och mått."""
    try:
        # Projektionsriktning
        proj_dirs = {
            "plan":  (0, 0, -1),
            "front": (0, 1, 0),
            "sida":  (1, 0, 0),
            "iso":   (1, 1, 1),
        }
        proj_dir = proj_dirs.get(direction, (0, 0, -1))

        # 1. Gruppera delar per lager
        layer_groups = _group_assembly_shapes(assy, projekt)
        svg_farger = _get_svg_farger(projekt)

        # 2. Bygg compounds per lager + hel-compound för bounding box
        all_shapes = []
        layer_compounds = {}
        for lager_namn, shapes in layer_groups.items():
            compound = cq.Compound.makeCompound(shapes)
            layer_compounds[lager_namn] = compound
            all_shapes.extend(shapes)

        if not all_shapes:
            raise ValueError("Inga shapes att rendera")

        full_compound = cq.Compound.makeCompound(all_shapes)

        # 3. Sätt upp gemensam projektor
        coordinate_system = gp_Ax2(gp_Pnt(), gp_Dir(*proj_dir))
        projector = HLRAlgo_Projector(coordinate_system)

        # 4. Kör HLR på hela compoundern för att beräkna gemensam bounding box
        full_paths = _hlr_edges_for_shape(full_compound, projector)

        # Skapa en temporär compound av alla 2D-kanter för BB-beräkning
        # Vi kör istället getSVG för BB-beräkning via CadQuery
        from cadquery.occ_impl.exporters.svg import getSVG
        ref_svg = getSVG(full_compound, {
            "width": width,
            "height": height,
            "marginLeft": 40,
            "marginTop": 40,
            "projectionDir": proj_dir,
            "showAxes": False,
            "showHidden": False,
            "strokeWidth": -1.0,
        })

        # Extrahera unitScale, xTranslate, yTranslate från referens-SVG:n
        import re
        scale_match = re.search(r'scale\(([\d.e+-]+),\s*-([\d.e+-]+)\)', ref_svg)
        translate_match = re.search(r'translate\(([\d.e+-]+),([\d.e+-]+)\)', ref_svg)

        if not scale_match or not translate_match:
            return ref_svg

        unit_scale = float(scale_match.group(1))
        x_translate = float(translate_match.group(1))
        y_translate = float(translate_match.group(2))

        sw_match = re.search(r'stroke-width="([\d.e+-]+)"', ref_svg)
        stroke_width = float(sw_match.group(1)) if sw_match else 1.0 / unit_scale

        # Beräkna pixel-bounding-box genom att parsa path-koordinater från referens-SVG:n
        coords = re.findall(r'[ML]([-\d.]+),([-\d.]+)', ref_svg)
        if coords:
            xs = [float(c[0]) for c in coords]
            ys = [float(c[1]) for c in coords]
            # Transformera modellkoordinater till pixel-space
            px_left = (min(xs) + x_translate) * unit_scale
            px_right = (max(xs) + x_translate) * unit_scale
            px_top = -(max(ys) + y_translate) * unit_scale
            px_bottom = -(min(ys) + y_translate) * unit_scale
        else:
            px_left, px_top, px_right, px_bottom = 40, 40, width - 40, height - 40

        bb_pixels = (px_left, px_top, px_right, px_bottom)

        # 5. Kör HLR per lager och bygg färgkodade SVG-grupper
        # Renderingsordning: bakgrundslager först, förgrundslager sist
        render_order = ["Stolpar", "Bärlinor", "Reglar", "Kantbräda", "Trall", "Räcke", "Trappa", "Övrigt"]
        sorted_layers = sorted(
            layer_compounds.keys(),
            key=lambda k: render_order.index(k) if k in render_order else 99
        )

        layer_svg_groups = ""
        for lager_namn in sorted_layers:
            compound = layer_compounds[lager_namn]
            farg = svg_farger.get(lager_namn, "#333333")

            # Skapa ny projektor (HLR kan inte återanvändas)
            proj = HLRAlgo_Projector(gp_Ax2(gp_Pnt(), gp_Dir(*proj_dir)))
            paths = _hlr_edges_for_shape(compound, proj)

            if not paths:
                continue

            # Bestäm opacity — trall halvtransparent i planvy
            opacity = ""
            if direction == "plan" and lager_namn == "Trall":
                opacity = ' stroke-opacity="0.35"'

            # CSS-klass för frontend-toggling
            css_class = lager_namn.replace("ä", "a").replace("ö", "o")

            path_content = ""
            for p in paths:
                path_content += f'\t\t\t<path d="{p}" />\n'

            layer_svg_groups += f'\t\t<g stroke="{farg}" class="lager-{css_class}" fill="none"{opacity}>\n'
            layer_svg_groups += path_content
            layer_svg_groups += '\t\t</g>\n'

        # 6. Utökad SVG med extra utrymme för legend + mått
        extra_bottom = 70  # px för legend + mått
        extra_right = 50   # px för vertikalt mått
        total_width = width + extra_right
        total_height = height + extra_bottom

        # 7. Vy-titel
        vy_titel = VY_TITLAR.get(direction, direction.upper())
        b_m = dimensioner["bredd"]
        l_m = dimensioner["langd"]
        h_cm = int(dimensioner["hojd"] * 100)
        titel_text = f'{vy_titel} — Altan {b_m} × {l_m} m, höjd {h_cm} cm'

        # 8. Bygg komplett SVG
        svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{total_width}" height="{total_height}" style="background:#fff">
    <!-- Titel -->
    <text x="{total_width/2:.0f}" y="24" text-anchor="middle" font-size="14" font-weight="600" fill="#333" font-family="Inter, Arial, sans-serif">{titel_text}</text>

    <!-- Ritning -->
    <g transform="scale({unit_scale}, -{unit_scale}) translate({x_translate},{y_translate})" stroke-width="{stroke_width}" fill="none">
{layer_svg_groups}    </g>

    <!-- Måttlinjer -->
{_build_dimension_lines(direction, dimensioner, bb_pixels, width, height)}
    <!-- Teckenförklaring -->
{_build_svg_legend(svg_farger, 30, total_height - 30)}
</svg>'''

        return svg

    except Exception as e:
        import traceback
        traceback.print_exc()
        return f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}"><text x="50" y="50" fill="red">Fel: {e}</text></svg>'


def export_svg_view(assy, direction, width=800, height=600):
    """Exportera en SVG-vy av assemblyt (legacy, monokrom)."""
    try:
        wp = assembly_to_workplane(assy)
        opts = {
            "width": width,
            "height": height,
            "marginLeft": 20,
            "marginTop": 20,
            "showAxes": False,
            "showHidden": False,
        }
        if direction == "plan":
            opts["projectionDir"] = (0, 0, -1)
        elif direction == "front":
            opts["projectionDir"] = (0, 1, 0)
        elif direction == "sida":
            opts["projectionDir"] = (1, 0, 0)
        elif direction == "iso":
            opts["projectionDir"] = (1, 1, 1)

        tmp = tempfile.mktemp(suffix=".svg")
        exporters.export(wp, tmp, exporters.ExportTypes.SVG, opt=opts)
        with open(tmp) as f:
            svg_str = f.read()
        os.unlink(tmp)
        return svg_str
    except Exception as e:
        return f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}"><text x="50" y="50" fill="red">Fel: {e}</text></svg>'


@app.get("/cad/{projekt}")
async def generera(
    projekt: str,
    bredd: float = Query(4.0, ge=1, le=10),
    langd: float = Query(3.0, ge=1, le=10),
    hojd: float = Query(0.6, ge=0.2, le=3.0),
):
    """Generera färgkodade SVG-ritningar för ett projekt."""
    if projekt not in MODELLER:
        return JSONResponse(status_code=404, content={"error": f"Projekt '{projekt}' finns inte."})

    assy = MODELLER[projekt](bredd=bredd, langd=langd, hojd=hojd)
    dimensioner = {"bredd": bredd, "langd": langd, "hojd": hojd}

    svgs = {}
    for vy in ["plan", "front", "sida"]:
        svgs[vy] = export_colored_svg_view(assy, projekt, vy, dimensioner)

    # Skicka med lagernamn och färger för frontend-lagerpanelen
    svg_farger = _get_svg_farger(projekt)

    return JSONResponse(content={
        "projekt": projekt,
        "dimensioner": dimensioner,
        "svgs": svgs,
        "lager": list(svg_farger.keys()),
    })


@app.get("/cad/{projekt}/3d")
async def generera_3d(
    projekt: str,
    bredd: float = Query(4.0, ge=1, le=10),
    langd: float = Query(3.0, ge=1, le=10),
    hojd: float = Query(0.6, ge=0.2, le=3.0),
):
    """Generera 3D-modell per lager (STL base64) för ett projekt."""
    if projekt not in MODELLER:
        return JSONResponse(status_code=404, content={"error": f"Projekt '{projekt}' finns inte."})

    assy = MODELLER[projekt](bredd=bredd, langd=langd, hojd=hojd)
    layers = assembly_to_layers(assy, projekt)

    # Färgkarta per lager
    lager_map = LAGER_MAP.get(projekt, {})
    farger = {}
    for prefix, info in lager_map.items():
        if info["etikett"] not in farger:
            farger[info["etikett"]] = info["farg"]

    return JSONResponse(content={
        "projekt": projekt,
        "dimensioner": {"bredd": bredd, "langd": langd, "hojd": hojd},
        "lager": list(layers.keys()),
        "farger": farger,
        "stl": layers,
    })


@app.get("/health")
async def health():
    return {"status": "ok", "modeller": list(MODELLER.keys())}
