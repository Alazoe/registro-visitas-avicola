#!/usr/bin/env python3
"""
Genera los carteles QR imprimibles (A4) de cada sector de Agrícola Las Rastras.

Uso:
    python3 carteles/generar_carteles.py            # usa assets/logo-las-rastras.png si existe
    python3 carteles/generar_carteles.py --logo otra/ruta.png
    python3 carteles/generar_carteles.py --logo-en-qr   # además pone el logo al centro del QR
                                                        # (solo para logos cuadrados)

Salida (en carteles/):
    cartel-<sector>.pdf            un cartel por sector
    carteles-las-rastras.pdf       los 4 juntos para imprimir de una vez

Requiere: pip install qrcode reportlab pillow
Comprobación de lectura (opcional): pip install opencv-python y tener pdftoppm (poppler).
"""
import argparse
import io
import os
import shutil
import subprocess
import sys
import tempfile

import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Fuente incrustada en el PDF (se imprime igual en cualquier equipo).
# Si no existe Arial (macOS), se usa Helvetica estándar.
FUENTE, FUENTE_B = "Helvetica", "Helvetica-Bold"
for normal, negrita in [
    ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
]:
    if os.path.exists(normal) and os.path.exists(negrita):
        pdfmetrics.registerFont(TTFont("Cartel", normal))
        pdfmetrics.registerFont(TTFont("Cartel-Bold", negrita))
        FUENTE, FUENTE_B = "Cartel", "Cartel-Bold"
        break

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(AQUI)
URL_BASE = "https://avivet.cl/registro-visitas-avicola/"

EMPRESA = "Agrícola Las Rastras"
SECTORES = [
    # id, nombre, rup, etapa, aviso de noches de vacío
    ("lr-junquillar", "Junquillar", "07.1.01.0171", "Recría",
     "Si en los últimos 3 días estuvo en otro plantel avícola, planta o matadero, "
     "o con aves de casa, o en las últimas 2 noches en un sector de postura de Las Rastras:"),
    ("lr-san-francisco", "San Francisco", "07.1.09.0505", "Postura",
     "Si en los últimos 3 días estuvo en otro plantel avícola, planta o matadero, o con aves de casa:"),
    ("lr-mariposa", "Mariposa", "07.1.09.1386", "Postura",
     "Si en los últimos 3 días estuvo en otro plantel avícola, planta o matadero, o con aves de casa:"),
    ("lr-ranquimili", "Ranquimili", "07.1.01.0170", "Postura",
     "Si en los últimos 3 días estuvo en otro plantel avícola, planta o matadero, o con aves de casa:"),
]

VERDE = HexColor("#1E5B3A")
OSCURO = HexColor("#1A1A18")
ROJO = HexColor("#B3261E")
GRIS = HexColor("#55584F")
CREMA = HexColor("#F5F0E8")


def qr_imagen(url, logo_path=None, px=1200):
    """QR con corrección H (aguanta ~30 % tapado). El logo ocupa como máx. 22 % del ancho."""
    q = qrcode.QRCode(error_correction=ERROR_CORRECT_H, box_size=20, border=4)
    q.add_data(url)
    q.make(fit=True)
    img = q.make_image(fill_color="#000000", back_color="#FFFFFF").convert("RGB")
    img = img.resize((px, px), Image.NEAREST)
    if logo_path:
        logo = Image.open(logo_path).convert("RGBA")
        lado = int(px * 0.22)
        logo.thumbnail((lado, lado), Image.LANCZOS)
        pad = int(px * 0.018)
        caja = Image.new("RGB", (logo.width + 2 * pad, logo.height + 2 * pad), "white")
        caja.paste(logo, (pad, pad), logo)
        img.paste(caja, ((px - caja.width) // 2, (px - caja.height) // 2))
    return img


def texto_ajustado(c, texto, fuente, tam, ancho_max):
    """Divide un texto en líneas que caben en ancho_max."""
    palabras, lineas, actual = texto.split(), [], ""
    for p in palabras:
        prueba = (actual + " " + p).strip()
        if c.stringWidth(prueba, fuente, tam) <= ancho_max:
            actual = prueba
        else:
            lineas.append(actual)
            actual = p
    if actual:
        lineas.append(actual)
    return lineas


def dibujar_cartel(c, sector, logo_path, logo_en_qr=False):
    sid, nombre, rup, etapa, aviso = sector
    url = URL_BASE + "?s=" + sid
    W, H = A4
    M = 15 * mm

    # Banda superior
    c.setFillColor(VERDE)
    c.rect(0, H - 34 * mm, W, 34 * mm, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont(FUENTE_B, 25)
    c.drawCentredString(W / 2, H - 17 * mm, "REGISTRO OBLIGATORIO")
    c.setFont(FUENTE, 14)
    c.drawCentredString(W / 2, H - 26 * mm, "de visitas y vehículos · Plan de bioseguridad (SAG)")

    # Empresa: logo si existe, si no el nombre en texto
    y = H - 44 * mm
    if logo_path:
        logo = ImageReader(logo_path)
        lw, lh = logo.getSize()
        alto = 21 * mm
        ancho = min(lw * alto / lh, W - 2 * M)
        alto = ancho * lh / lw
        c.drawImage(logo, (W - ancho) / 2, y - alto, ancho, alto, mask="auto")
        y -= alto + 5 * mm
        c.setFillColor(GRIS)
        c.setFont(FUENTE, 12)
        c.drawCentredString(W / 2, y - 1 * mm, EMPRESA)
        y -= 4 * mm
    else:
        c.setFillColor(OSCURO)
        c.setFont(FUENTE_B, 20)
        c.drawCentredString(W / 2, y - 7 * mm, EMPRESA.upper())
        y -= 14 * mm

    # Sector y RUP
    c.setFillColor(OSCURO)
    titulo, tam = "SECTOR " + nombre.upper(), 46
    while c.stringWidth(titulo, FUENTE_B, tam) > W - 2 * M - 10 * mm:
        tam -= 1
    c.setFont(FUENTE_B, tam)
    c.drawCentredString(W / 2, y - 14 * mm, titulo)
    c.setFillColor(GRIS)
    c.setFont(FUENTE, 15)
    c.drawCentredString(W / 2, y - 23 * mm, f"RUP {rup}  ·  {etapa}")
    y -= 29 * mm

    # QR
    lado = 112 * mm
    img = qr_imagen(url, logo_path if logo_en_qr else None)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    c.drawImage(ImageReader(buf), (W - lado) / 2, y - lado, lado, lado)
    y -= lado + 6 * mm

    # Pasos
    pasos = [
        "1  Escanee el código con la cámara del celular",
        "2  Complete sus datos (también la patente si viene en vehículo)",
        "3  Muestre al guardia la pantalla «Ingreso registrado»",
    ]
    c.setFillColor(OSCURO)
    c.setFont(FUENTE_B, 14)
    for p in pasos:
        c.drawString(M + 8 * mm, y - 5 * mm, p)
        y -= 8 * mm
    y -= 2 * mm

    # Aviso de vacío sanitario (rojo)
    ancho_caja = W - 2 * M
    lineas = texto_ajustado(c, aviso, FUENTE, 12, ancho_caja - 12 * mm)
    alto_caja = (len(lineas) * 5.2 + 15) * mm
    c.setFillColor(ROJO)
    c.roundRect(M, y - alto_caja, ancho_caja, alto_caja, 4 * mm, stroke=0, fill=1)
    c.setFillColor(white)
    yy = y - 7 * mm
    c.setFont(FUENTE, 12)
    for ln in lineas:
        c.drawString(M + 6 * mm, yy, ln)
        yy -= 5.2 * mm
    c.setFont(FUENTE_B, 13.5)
    c.drawString(M + 6 * mm, yy - 1.5 * mm, "NO INGRESE sin autorización del Responsable de Bioseguridad.")
    y -= alto_caja + 6 * mm

    # Pie
    c.setFillColor(GRIS)
    c.setFont(FUENTE, 10)
    c.drawCentredString(W / 2, y - 2 * mm, "Sin internet o sin celular: pida al guardia el registro en papel (BIO-R-11).")
    c.setFont("Courier", 9)
    c.drawCentredString(W / 2, y - 7 * mm, url)


def comprobar_lectura(pdf_path, url_esperada):
    """Rasteriza el PDF y lee el QR con OpenCV. Devuelve True/False, o None si no hay herramientas."""
    try:
        import cv2  # noqa
    except ImportError:
        return None
    if not shutil.which("pdftoppm"):
        return None
    import cv2
    with tempfile.TemporaryDirectory() as tmp:
        base = os.path.join(tmp, "p")
        # 72-100 dpi ≈ foto de celular de lejos o poco nítida; 200-300 dpi ≈ lectura normal.
        # Se usan dos detectores de OpenCV: basta con que uno lea (como un celular, que reintenta).
        detectores = [cv2.QRCodeDetector()]
        if hasattr(cv2, "QRCodeDetectorAruco"):
            detectores.append(cv2.QRCodeDetectorAruco())
        resultados = []
        for dpi in (72, 100, 150, 200, 300):
            subprocess.run(["pdftoppm", "-r", str(dpi), "-png", "-singlefile", pdf_path, base], check=True)
            im = cv2.imread(base + ".png")
            resultados.append(any(d.detectAndDecode(im)[0] == url_esperada for d in detectores))
        return all(resultados)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--logo", default=os.path.join(REPO, "assets", "logo-las-rastras.png"))
    ap.add_argument("--salida", default=AQUI)
    ap.add_argument("--logo-en-qr", action="store_true",
                    help="poner también el logo al centro del QR (solo logos cuadrados)")
    args = ap.parse_args()

    logo = args.logo if args.logo and os.path.exists(args.logo) else None
    print("Logo:", logo or "(no encontrado: se usa el nombre en texto)")
    os.makedirs(args.salida, exist_ok=True)

    todos = canvas.Canvas(os.path.join(args.salida, "carteles-las-rastras.pdf"), pagesize=A4)
    todos.setTitle("Carteles QR · Registro de visitas · Agrícola Las Rastras")
    ok_total = True
    for s in SECTORES:
        ruta = os.path.join(args.salida, f"cartel-{s[0]}.pdf")
        c = canvas.Canvas(ruta, pagesize=A4)
        c.setTitle(f"Cartel QR · Sector {s[1]} · {EMPRESA}")
        dibujar_cartel(c, s, logo, args.logo_en_qr)
        c.showPage()
        c.save()
        dibujar_cartel(todos, s, logo, args.logo_en_qr)
        todos.showPage()
        lee = comprobar_lectura(ruta, URL_BASE + "?s=" + s[0])
        estado = {True: "QR se lee OK", False: "QR NO SE LEE", None: "(sin comprobar)"}[lee]
        ok_total = ok_total and lee is not False
        print(f"  {ruta}  ·  {estado}")
    todos.save()
    print("  " + os.path.join(args.salida, "carteles-las-rastras.pdf"))
    sys.exit(0 if ok_total else 1)


if __name__ == "__main__":
    main()
