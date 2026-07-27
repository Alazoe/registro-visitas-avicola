// ============================================================
//  REGISTRO DE VISITAS AVÍCOLA — Google Apps Script Backend
//  Versión: 1.1
//  Instrucciones de configuración al final del archivo
// ============================================================

// ── CONFIGURACIÓN ────────────────────────────────────────────
const CONFIG = {
  // Email del encargado que recibirá alertas de riesgo sanitario
  EMAIL_ALERTA: "andreslazomv@outlook.com",

  // Nombre que aparece en el asunto del email de alerta
  NOMBRE_EMPRESA: "Avivet",

  // Columnas de la hoja (NO modificar el orden)
  COLUMNAS: [
    "Folio",
    "Fecha",
    "Hora ingreso",
    "Nombre",
    "RUT",
    "Empresa / Institución",
    "Motivo de visita",
    "Patente",
    "Aves domésticas",
    "Observaciones",
    "⚠ ALERTA",        // "ALERTA" si tiene aves, vacío si no
    "Timestamp ISO",   // Para auditoría técnica
  ],
};

// ── COLORES ──────────────────────────────────────────────────
const COLOR = {
  HEADER_BG:   "#1A1A18",
  HEADER_TEXT: "#C8A84B",
  ALERTA_BG:   "#F4CCCC",
  ALERTA_TEXT: "#990000",
  NORMAL_ODD:  "#FFFFFF",
  NORMAL_EVEN: "#F5F0E8",
  BORDE:       "#D0C9B8",
};

// ============================================================
//  ENDPOINT PRINCIPAL — recibe el POST del formulario
// ============================================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const resultado = registrarVisita(data);

    return ContentService
      .createTextOutput(JSON.stringify(resultado))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// También acepta GET para pruebas desde el navegador
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, msg: "Backend activo ✓" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  LÓGICA PRINCIPAL
// ============================================================
function registrarVisita(data) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const hoja  = obtenerOCrearHoja(ss, data.granjaNombre || data.granja || "Sin nombre");

  const esAlerta = data.aves === "Sí";

  // Construir fila
  const ahora = new Date();
  const fila = [
    data.folio        || generarFolio(),
    data.fecha        || formatFecha(ahora),
    data.hora         || formatHora(ahora),
    data.nombre       || "",
    data.rut          || "",
    data.empresa      || "",
    data.motivo       || "",
    data.patente      || "",
    data.aves         || "",
    data.obs          || "",
    esAlerta ? "⚠ ALERTA AVES" : "",
    data.timestamp    || ahora.toISOString(),
  ];

  // Insertar fila
  const ultimaFila = hoja.getLastRow() + 1;
  hoja.getRange(ultimaFila, 1, 1, fila.length).setValues([fila]);

  // Aplicar formato a la fila
  darFormatoFila(hoja, ultimaFila, esAlerta);

  // Email de alerta si corresponde
  if (esAlerta) {
    enviarEmailAlerta(data, hoja.getName());
  }

  return {
    ok:     true,
    folio:  fila[0],
    hoja:   hoja.getName(),
    fila:   ultimaFila,
    alerta: esAlerta,
  };
}

// ============================================================
//  GESTIÓN DE HOJAS
// ============================================================
function obtenerOCrearHoja(ss, granjaNombre) {
  // Normalizar nombre (máx 31 chars, sin caracteres ilegales para Sheets)
  const nombreHoja = normalizarNombreHoja(granjaNombre);

  let hoja = ss.getSheetByName(nombreHoja);

  if (!hoja) {
    hoja = ss.insertSheet(nombreHoja);
    inicializarHoja(hoja);
  }

  return hoja;
}

function normalizarNombreHoja(nombre) {
  return nombre
    .replace(/[\/\\\?\*\[\]:]/g, "")   // chars ilegales en Sheets
    .substring(0, 31)
    .trim() || "Granja";
}

function inicializarHoja(hoja) {
  // Escribir encabezados
  const rango = hoja.getRange(1, 1, 1, CONFIG.COLUMNAS.length);
  rango.setValues([CONFIG.COLUMNAS]);

  // Formato encabezado
  rango.setBackground(COLOR.HEADER_BG)
       .setFontColor(COLOR.HEADER_TEXT)
       .setFontWeight("bold")
       .setFontSize(11)
       .setHorizontalAlignment("center");

  // Anchos de columna
  const anchos = [130, 100, 90, 200, 120, 180, 200, 100, 120, 220, 130, 180];
  anchos.forEach((w, i) => hoja.setColumnWidth(i + 1, w));

  // Fijar fila de encabezado
  hoja.setFrozenRows(1);

  // Borde inferior del encabezado
  rango.setBorder(null, null, true, null, null, null, COLOR.HEADER_TEXT, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

// ============================================================
//  FORMATO DE FILAS
// ============================================================
function darFormatoFila(hoja, numFila, esAlerta) {
  const rango = hoja.getRange(numFila, 1, 1, CONFIG.COLUMNAS.length);

  if (esAlerta) {
    rango.setBackground(COLOR.ALERTA_BG);
    // Columna de alerta (col 11) en rojo negrita
    hoja.getRange(numFila, 11)
        .setFontColor(COLOR.ALERTA_TEXT)
        .setFontWeight("bold");
  } else {
    // Alternar colores zebra
    const bg = (numFila % 2 === 0) ? COLOR.NORMAL_EVEN : COLOR.NORMAL_ODD;
    rango.setBackground(bg);
  }

  rango.setVerticalAlignment("middle")
       .setBorder(null, null, true, null, null, null, COLOR.BORDE, SpreadsheetApp.BorderStyle.SOLID);
}

// ============================================================
//  MIGRACIÓN — agrega la columna "Patente" a hojas ya existentes
//  Ejecutar UNA sola vez manualmente desde el editor (menú Ejecutar
//  → seleccionar "migrarColumnaPatente" → Ejecutar). Es idempotente:
//  si se corre de nuevo, las hojas ya migradas se saltan solas.
// ============================================================
function migrarColumnaPatente() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let migradas = 0;

  ss.getSheets().forEach(hoja => {
    const ultimaCol = hoja.getLastColumn();
    if (ultimaCol === 0) return; // hoja vacía

    const encabezados = hoja.getRange(1, 1, 1, ultimaCol).getValues()[0];
    if (encabezados.indexOf("Patente") !== -1) return; // ya migrada

    const idxAves = encabezados.indexOf("Aves domésticas");
    if (idxAves === -1) return; // no parece una hoja de registros de visitas

    const colPatente = idxAves + 1; // 1-indexado, se inserta ANTES de Aves
    hoja.insertColumnBefore(colPatente);

    const celda = hoja.getRange(1, colPatente);
    celda.setValue("Patente")
         .setBackground(COLOR.HEADER_BG)
         .setFontColor(COLOR.HEADER_TEXT)
         .setFontWeight("bold")
         .setFontSize(11)
         .setHorizontalAlignment("center");

    hoja.setColumnWidth(colPatente, 100);
    migradas++;
  });

  Logger.log(`Migración completa: ${migradas} hoja(s) actualizada(s).`);
}

// ============================================================
//  EMAIL DE ALERTA
// ============================================================
function enviarEmailAlerta(data, nombreHoja) {
  const asunto = `⚠ ALERTA SANITARIA — Visita con aves domésticas | ${data.granjaNombre || data.granja}`;

  const cuerpo = `
Se ha registrado el ingreso de un visitante con contacto reciente con aves domésticas.

━━━━━━━━━━━━━━━━━━━━━━━━━━
  DATOS DE LA VISITA
━━━━━━━━━━━━━━━━━━━━━━━━━━
  Granja:         ${data.granjaNombre || data.granja}
  Folio:          ${data.folio}
  Fecha / Hora:   ${data.fecha} — ${data.hora}

  Visitante:      ${data.nombre}
  RUT:            ${data.rut}
  Empresa:        ${data.empresa || "—"}
  Motivo:         ${data.motivo}
  Patente:        ${data.patente || "—"}

  ⚠ CONTACTO AVES: ${data.aves}
  Observaciones:  ${data.obs || "Sin observaciones"}

━━━━━━━━━━━━━━━━━━━━━━━━━━

Acción recomendada:
  → Verificar cumplimiento de protocolo de desinfección
  → Cambio de ropa y calzado antes de ingresar a las naves
  → Registrar autorización de ingreso por el encargado

Este mensaje fue generado automáticamente por el sistema de
registro de visitas de ${CONFIG.NOMBRE_EMPRESA}.
  `.trim();

  MailApp.sendEmail({
    to:      CONFIG.EMAIL_ALERTA,
    subject: asunto,
    body:    cuerpo,
  });
}

// ============================================================
//  UTILIDADES
// ============================================================
function generarFolio() {
  const ts   = new Date().getTime().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `REG-${ts}-${rand}`;
}

function formatFecha(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy");
}

function formatHora(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "HH:mm");
}


// ============================================================
//
//  ██████╗  ██████╗ ███╗   ███╗ ██████╗
//  ██╔════╝ ██╔═══██╗████╗ ████║██╔═══██╗
//  ██║      ██║   ██║██╔████╔██║██║   ██║
//  ██║      ██║   ██║██║╚██╔╝██║██║   ██║
//  ╚██████╗ ╚██████╔╝██║ ╚═╝ ██║╚██████╔╝
//   ╚═════╝  ╚═════╝ ╚═╝     ╚═╝ ╚═════╝
//
//  INSTRUCCIONES DE CONFIGURACIÓN
// ============================================================
//
//  1. CREAR EL GOOGLE SHEET
//     ─────────────────────
//     • Ve a sheets.google.com y crea un nuevo Sheet vacío
//     • Nómbralo: "Registro Visitas Avícola"
//     • Copia la URL del Sheet (la necesitas en el paso 3)
//
//  2. ABRIR APPS SCRIPT
//     ─────────────────
//     • En el Sheet: menú Extensiones → Apps Script
//     • Borra el contenido del editor
//     • Pega TODO este archivo
//     • Ajusta CONFIG.EMAIL_ALERTA con tu correo real
//     • Ajusta CONFIG.NOMBRE_EMPRESA con tu empresa
//     • Guarda (Ctrl+S)
//
//  3. PUBLICAR COMO WEB APP
//     ──────────────────────
//     • Clic en "Implementar" → "Nueva implementación"
//     • Tipo: "Aplicación web"
//     • Ejecutar como: "Yo (tu cuenta Google)"
//     • Quién puede acceder: "Cualquier usuario"
//     • Clic en "Implementar"
//     • COPIA la URL que aparece → es tu SCRIPT_URL
//       Ejemplo: https://script.google.com/macros/s/AKfy.../exec
//
//  4. PEGAR LA SCRIPT_URL EN EL FORMULARIO
//     ──────────────────────────────────────
//     • Abre registro-visitas.html
//     • Busca la línea: const SCRIPT_URL = ""
//     • Pega tu URL entre las comillas
//     • Guarda y sube a GitHub Pages
//
//  5. PROBAR
//     ───────
//     • Escanea un QR de prueba con tu celular
//     • Llena el formulario y envía
//     • Revisa el Google Sheet → debe aparecer la pestaña
//       con el nombre de la granja y el registro
//
//  ¡Listo! Cada granja nueva crea su pestaña automáticamente.
//
// ============================================================
