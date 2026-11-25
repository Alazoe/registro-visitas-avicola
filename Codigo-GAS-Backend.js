// ============================================================
//  REGISTRO DE VISITAS AVÍCOLA — Google Apps Script Backend
//  Versión: 2.0 (noviembre 2026)
//  Instrucciones de configuración al final del archivo
// ============================================================

// ── CONFIGURACIÓN ────────────────────────────────────────────
const CONFIG = {
  // Email que recibe las alertas de riesgo sanitario (todas las granjas).
  // Cada sector del catálogo puede sumar su propio correo en `emailAlerta`.
  EMAIL_ALERTA: "andreslazomv@outlook.com",

  // Nombre que aparece en el pie del email de alerta
  NOMBRE_EMPRESA: "Avivet",

  // Noches de vacío por defecto tras contacto con otras aves (granjas que
  // no están en el catálogo de SECTORES)
  NOCHES_VACIO_DEFECTO: 3,

  // Columnas de la hoja. El script escribe por NOMBRE de columna: si una
  // pestaña antigua no tiene alguna, la agrega al final sin mover lo que ya
  // existe. No renombres encabezados en la hoja.
  COLUMNAS: [
    "Folio",
    "Fecha",
    "Hora ingreso",
    "Nombre",
    "RUT",
    "Empresa / Institución",
    "Motivo de visita",
    "Patente",
    "Aves domésticas",          // "Sí" / "No": contacto con aves en el plazo de vacío
    "Observaciones",
    "⚠ ALERTA",
    "Timestamp ISO",
    "Sector",
    "RUP",
    "Teléfono",
    "Lugar contacto aves",
    "Tipo contacto aves",
    "Fecha último contacto aves",
    "Noches desde contacto",
    "Estado ingreso",           // "AUTORIZADO" o "REQUIERE AUTORIZACIÓN RB"
  ],
};

// ── CATÁLOGO DE SECTORES ─────────────────────────────────────
// El QR de cada sector abre index.html?s=<id>. El backend confía en ESTE
// catálogo (no en lo que mande el navegador) para el nombre de la pestaña,
// el RUP, el prefijo del folio y las noches de vacío.
// Si cambias algo aquí, cambia también SECTORES en index.html.
//
// noches: noches de vacío exigidas según dónde estuvo la persona.
//   otra_avicola   → otro plantel avícola, planta de faena o matadero, feria de aves
//   traspatio      → aves de casa / traspatio / aves de pelea / mascotas aves
//   sector_empresa → otro sector de la misma empresa (Las Rastras)
const SECTORES = {
  "lr-junquillar": {
    nombre: "Junquillar", empresa: "Agrícola Las Rastras", rup: "07.1.01.0171",
    etapa: "Recría", hoja: "Las Rastras - Junquillar", prefijo: "JQ",
    // Recría = nivel más protegido: desde postura hay que cumplir 2 noches
    noches: { otra_avicola: 3, traspatio: 3, sector_empresa: 2 },
    emailAlerta: "",
  },
  "lr-san-francisco": {
    nombre: "San Francisco", empresa: "Agrícola Las Rastras", rup: "07.1.09.0505",
    etapa: "Postura", hoja: "Las Rastras - San Francisco", prefijo: "SF",
    noches: { otra_avicola: 3, traspatio: 3, sector_empresa: 0 },
    emailAlerta: "",
  },
  "lr-mariposa": {
    nombre: "Mariposa", empresa: "Agrícola Las Rastras", rup: "07.1.09.1386",
    etapa: "Postura", hoja: "Las Rastras - Mariposa", prefijo: "MP",
    noches: { otra_avicola: 3, traspatio: 3, sector_empresa: 0 },
    emailAlerta: "",
  },
  "lr-ranquimili": {
    nombre: "Ranquimili", empresa: "Agrícola Las Rastras", rup: "07.1.01.0170",
    etapa: "Postura", hoja: "Las Rastras - Ranquimili", prefijo: "RQ",
    noches: { otra_avicola: 3, traspatio: 3, sector_empresa: 0 },
    emailAlerta: "",
  },
  // Sector de PRUEBA: escribe en su propia pestaña y no manda correos.
  // Úsalo con index.html?s=lr-prueba para probar sin tocar datos reales.
  "lr-prueba": {
    nombre: "PRUEBA", empresa: "Agrícola Las Rastras", rup: "00.0.00.0000",
    etapa: "Prueba", hoja: "PRUEBA Las Rastras", prefijo: "PR",
    noches: { otra_avicola: 3, traspatio: 3, sector_empresa: 2 },
    emailAlerta: "", sinCorreo: true,
  },
};

const TIPOS_CONTACTO = {
  otra_avicola:   "Otro plantel avícola, planta o matadero",
  traspatio:      "Aves de casa o traspatio",
  sector_empresa: "Otro sector de la empresa",
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
//  ENDPOINTS
// ============================================================
// El formulario envía POST con Content-Type text/plain (sin preflight CORS)
// y LEE esta respuesta JSON: solo muestra «Ingreso registrado» si ok === true.
function doPost(e) {
  let resultado;
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    resultado = registrarVisita(data);
  } catch (err) {
    resultado = { ok: false, error: "Error del servidor: " + err.message };
  }
  return ContentService
    .createTextOutput(JSON.stringify(resultado))
    .setMimeType(ContentService.MimeType.JSON);
}

// GET para comprobar desde el navegador que el backend está activo
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, msg: "Backend activo ✓", version: "2.0" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  LÓGICA PRINCIPAL
// ============================================================
function registrarVisita(data) {
  // 1) Validar en el servidor (no confiar solo en el formulario)
  const v = validarDatos(data);
  if (!v.ok) return v;
  const d = v.datos;

  // 2) Escribir con bloqueo para que dos ingresos simultáneos no choquen
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return { ok: false, error: "El servidor está ocupado. Intente de nuevo en unos segundos." };
  }
  try {
    // 3) Evitar doble envío (doble toque o reintento): mismo RUT en el mismo
    //    sector dentro de 3 minutos devuelve el folio ya guardado.
    const cache = CacheService.getScriptCache();
    const claveDup = "dup_" + d.granjaId + "_" + d.rutLimpio;
    const previo = cache.get(claveDup);
    if (previo) {
      const r = JSON.parse(previo);
      r.duplicado = true;
      return r;
    }

    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const hoja  = obtenerOCrearHoja(ss, d.nombreHoja);
    const enc   = asegurarEncabezados(hoja);

    const ahora = new Date();
    const folio = d.sector ? siguienteFolio(d.granjaId, d.sector.prefijo) : generarFolio();
    const fecha = formatFecha(ahora);
    const hora  = formatHora(ahora);

    const valores = {
      "Folio":                     folio,
      "Fecha":                     fecha,
      "Hora ingreso":              hora,
      "Nombre":                    d.nombre,
      "RUT":                       d.rut,
      "Empresa / Institución":     d.empresa,
      "Motivo de visita":          d.motivo,
      "Patente":                   d.patente,
      "Aves domésticas":           d.aves,
      "Observaciones":             d.obs,
      "⚠ ALERTA":                  d.bloqueado ? "⚠ CONTACTO CON AVES" : "",
      "Timestamp ISO":             ahora.toISOString(),
      "Sector":                    d.sectorNombre,
      "RUP":                       d.rup,
      "Teléfono":                  d.telefono,
      "Lugar contacto aves":       d.lugarContacto,
      "Tipo contacto aves":        d.tipoContactoTexto,
      "Fecha último contacto aves": d.fechaContacto,
      "Noches desde contacto":     d.noches === null ? "" : d.noches,
      "Estado ingreso":            d.bloqueado ? "REQUIERE AUTORIZACIÓN RB" : "AUTORIZADO",
    };

    const fila = enc.map(h => (h in valores ? valores[h] : ""));
    const numFila = hoja.getLastRow() + 1;
    hoja.getRange(numFila, 1, 1, fila.length).setValues([fila]);
    darFormatoFila(hoja, numFila, enc, d.bloqueado);
    SpreadsheetApp.flush();

    const resultado = {
      ok:            true,
      folio:         folio,
      fecha:         fecha,
      hora:          hora,
      timestamp:     ahora.toISOString(),
      sector:        d.sectorNombre,
      rup:           d.rup,
      nombre:        d.nombre,
      bloqueado:     d.bloqueado,
      nochesExigidas: d.nochesExigidas,
      noches:        d.noches,
      hoja:          hoja.getName(),
    };
    cache.put(claveDup, JSON.stringify(resultado), 180);

    // 4) Correo de alerta (no debe impedir que el registro quede guardado)
    if (d.aves === "Sí" && !(d.sector && d.sector.sinCorreo)) {
      try { enviarEmailAlerta(d, resultado); } catch (err) { console.error("Correo no enviado: " + err.message); }
    }
    return resultado;
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
//  VALIDACIÓN EN EL SERVIDOR
// ============================================================
function texto(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001F]/g, " ").trim().substring(0, max);
}

// Evita que un texto que empiece con = + - @ se interprete como fórmula en Sheets
function seguroSheets(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function validarDatos(data) {
  if (!data || typeof data !== "object") return { ok: false, error: "Datos vacíos." };

  const granjaId = texto(data.sectorId || data.granja, 40).toLowerCase();
  const sector   = SECTORES[granjaId] || null;

  const nombre   = seguroSheets(texto(data.nombre, 80));
  const rut      = texto(data.rut, 12);
  const empresa  = seguroSheets(texto(data.empresa, 80));
  const motivo   = seguroSheets(texto(data.motivo, 120));
  const patente  = texto(data.patente, 8).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const telefono = texto(data.telefono, 20).replace(/[^0-9+ ]/g, "");
  const obs      = seguroSheets(texto(data.obs, 400));
  const aves     = data.aves === "Sí" ? "Sí" : (data.aves === "No" ? "No" : "");

  const faltan = [];
  if (!nombre) faltan.push("nombre");
  if (!rut)    faltan.push("RUT");
  if (!motivo) faltan.push("motivo");
  if (!aves)   faltan.push("contacto con aves");
  if (faltan.length) return { ok: false, error: "Faltan datos: " + faltan.join(", ") + "." };

  if (!validarRut(rut)) return { ok: false, error: "RUT inválido." };
  if (patente && !/^[A-Z]{2}\d{4}$/.test(patente) && !/^[A-Z]{4}\d{2}$/.test(patente)) {
    return { ok: false, error: "Patente inválida." };
  }

  // Contacto con aves
  let tipoContacto = "", lugarContacto = "", fechaContacto = "", noches = null;
  if (aves === "Sí") {
    tipoContacto  = TIPOS_CONTACTO[data.tipoContacto] ? data.tipoContacto : "otra_avicola";
    lugarContacto = seguroSheets(texto(data.lugarContacto, 120));
    fechaContacto = texto(data.fechaContacto, 10);
    if (!lugarContacto) return { ok: false, error: "Indique dónde tuvo contacto con aves." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaContacto)) return { ok: false, error: "Indique la fecha del último contacto con aves." };
    noches = nochesDesde(fechaContacto);
    if (noches < 0) return { ok: false, error: "La fecha del último contacto no puede ser futura." };
  }
  const nochesExigidas = aves === "Sí"
    ? (sector ? sector.noches[tipoContacto] : CONFIG.NOCHES_VACIO_DEFECTO)
    : 0;
  const bloqueado = aves === "Sí" && noches < nochesExigidas;

  const sectorNombre = sector ? sector.nombre : texto(data.granjaNombre, 60);
  return {
    ok: true,
    datos: {
      granjaId: granjaId || "sin-id",
      sector,
      sectorNombre,
      empresaGranja: sector ? sector.empresa : texto(data.empresaGranja, 60),
      rup:          sector ? sector.rup : "",
      nombreHoja:   sector ? sector.hoja : (texto(data.granjaNombre, 60) || "Sin nombre"),
      nombre, rut, rutLimpio: rut.replace(/[^0-9kK]/g, "").toUpperCase(),
      empresa, motivo, patente, telefono, obs, aves,
      tipoContacto, tipoContactoTexto: tipoContacto ? TIPOS_CONTACTO[tipoContacto] : "",
      lugarContacto, fechaContacto: fechaContacto ? fechaISOaCL(fechaContacto) : "",
      noches, nochesExigidas, bloqueado,
    },
  };
}

function validarRut(rutStr) {
  const limpio = String(rutStr || "").replace(/[.\s-]/g, "");
  if (limpio.length < 2) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1).toUpperCase();
  if (!/^\d+$/.test(cuerpo)) return false;
  let suma = 0, m = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * m;
    m = m === 7 ? 2 : m + 1;
  }
  const r = 11 - (suma % 11);
  return dv === (r === 11 ? "0" : r === 10 ? "K" : String(r));
}

// Noches entre la fecha del último contacto (yyyy-mm-dd) y hoy, en hora de Chile.
// Contacto ayer = 1 noche; contacto hoy = 0 noches.
function nochesDesde(fechaISO) {
  const hoyStr = Utilities.formatDate(new Date(), zona(), "yyyy-MM-dd");
  const a = Date.UTC(+fechaISO.slice(0, 4), +fechaISO.slice(5, 7) - 1, +fechaISO.slice(8, 10));
  const b = Date.UTC(+hoyStr.slice(0, 4), +hoyStr.slice(5, 7) - 1, +hoyStr.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

function fechaISOaCL(f) {
  return f.slice(8, 10) + "/" + f.slice(5, 7) + "/" + f.slice(0, 4);
}

// ============================================================
//  GESTIÓN DE HOJAS
// ============================================================
function obtenerOCrearHoja(ss, nombre) {
  const nombreHoja = normalizarNombreHoja(nombre);
  let hoja = ss.getSheetByName(nombreHoja);
  if (!hoja) {
    hoja = ss.insertSheet(nombreHoja);
    inicializarHoja(hoja);
  }
  return hoja;
}

function normalizarNombreHoja(nombre) {
  return String(nombre)
    .replace(/[\/\\\?\*\[\]:]/g, "")
    .substring(0, 31)
    .trim() || "Granja";
}

function formatoEncabezado(rango) {
  rango.setBackground(COLOR.HEADER_BG)
       .setFontColor(COLOR.HEADER_TEXT)
       .setFontWeight("bold")
       .setFontSize(11)
       .setHorizontalAlignment("center");
}

function inicializarHoja(hoja) {
  const rango = hoja.getRange(1, 1, 1, CONFIG.COLUMNAS.length);
  rango.setValues([CONFIG.COLUMNAS]);
  formatoEncabezado(rango);
  const anchos = [110, 95, 90, 200, 115, 180, 200, 90, 110, 220, 160, 180,
                  120, 110, 110, 200, 200, 120, 100, 200];
  anchos.forEach((w, i) => hoja.setColumnWidth(i + 1, w));
  hoja.setFrozenRows(1);
  rango.setBorder(null, null, true, null, null, null, COLOR.HEADER_TEXT, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

// Devuelve los encabezados de la hoja; agrega al final los que falten
// (pestañas creadas con versiones anteriores). Nunca mueve ni borra columnas.
function asegurarEncabezados(hoja) {
  const ultimaCol = Math.max(hoja.getLastColumn(), 1);
  let enc = hoja.getRange(1, 1, 1, ultimaCol).getValues()[0].map(String);
  while (enc.length && enc[enc.length - 1] === "") enc.pop();
  const faltan = CONFIG.COLUMNAS.filter(c => enc.indexOf(c) === -1);
  if (faltan.length) {
    const desde = enc.length + 1;
    const rango = hoja.getRange(1, desde, 1, faltan.length);
    rango.setValues([faltan]);
    formatoEncabezado(rango);
    enc = enc.concat(faltan);
  }
  return enc;
}

// ============================================================
//  FOLIO CORRELATIVO POR SECTOR (JQ-000001, SF-000001, …)
// ============================================================
function siguienteFolio(granjaId, prefijo) {
  const props = PropertiesService.getScriptProperties();
  const clave = "folio_" + granjaId;
  const n = (parseInt(props.getProperty(clave) || "0", 10) || 0) + 1;
  props.setProperty(clave, String(n));
  return prefijo + "-" + ("000000" + n).slice(-6);
}

// Folio para granjas que no están en el catálogo (comportamiento anterior)
function generarFolio() {
  const ts   = new Date().getTime().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return "REG-" + ts + "-" + rand;
}

// ============================================================
//  FORMATO DE FILAS
// ============================================================
function darFormatoFila(hoja, numFila, enc, esAlerta) {
  const rango = hoja.getRange(numFila, 1, 1, enc.length);
  if (esAlerta) {
    rango.setBackground(COLOR.ALERTA_BG);
    ["⚠ ALERTA", "Estado ingreso"].forEach(h => {
      const c = enc.indexOf(h);
      if (c >= 0) hoja.getRange(numFila, c + 1).setFontColor(COLOR.ALERTA_TEXT).setFontWeight("bold");
    });
  } else {
    rango.setBackground(numFila % 2 === 0 ? COLOR.NORMAL_EVEN : COLOR.NORMAL_ODD);
  }
  rango.setVerticalAlignment("middle")
       .setBorder(null, null, true, null, null, null, COLOR.BORDE, SpreadsheetApp.BorderStyle.SOLID);
}

// ============================================================
//  MIGRACIÓN (opcional, versión 1.1) — ya no es necesaria: asegurarEncabezados()
//  agrega solo las columnas que falten. Se deja por compatibilidad.
// ============================================================
function migrarColumnaPatente() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let migradas = 0;
  ss.getSheets().forEach(hoja => {
    const ultimaCol = hoja.getLastColumn();
    if (ultimaCol === 0) return;
    const encabezados = hoja.getRange(1, 1, 1, ultimaCol).getValues()[0];
    if (encabezados.indexOf("Patente") !== -1) return;
    const idxAves = encabezados.indexOf("Aves domésticas");
    if (idxAves === -1) return;
    const colPatente = idxAves + 1;
    hoja.insertColumnBefore(colPatente);
    const celda = hoja.getRange(1, colPatente);
    celda.setValue("Patente");
    formatoEncabezado(celda);
    hoja.setColumnWidth(colPatente, 100);
    migradas++;
  });
  Logger.log("Migración completa: " + migradas + " hoja(s) actualizada(s).");
}

// ============================================================
//  EMAIL DE ALERTA
// ============================================================
function enviarEmailAlerta(d, r) {
  const destinatarios = [CONFIG.EMAIL_ALERTA];
  if (d.sector && d.sector.emailAlerta) destinatarios.push(d.sector.emailAlerta);

  const lugar = d.sector ? (d.empresaGranja + " · " + d.sectorNombre) : d.sectorNombre;
  const estado = d.bloqueado
    ? "NO PUEDE INGRESAR sin autorización del Responsable de Bioseguridad"
    : "Cumple las noches de vacío exigidas (" + d.nochesExigidas + ")";
  const asunto = (d.bloqueado ? "⚠ INGRESO BLOQUEADO" : "Aviso") +
    " — visita con contacto con aves | " + lugar;

  const cuerpo = [
    "Se registró un visitante que declaró contacto reciente con aves.",
    "",
    "Sector:          " + lugar + (d.rup ? " (RUP " + d.rup + ")" : ""),
    "Folio:           " + r.folio,
    "Fecha / hora:    " + r.fecha + " " + r.hora,
    "",
    "Visitante:       " + d.nombre,
    "RUT:             " + d.rut,
    "Empresa:         " + (d.empresa || "—"),
    "Teléfono:        " + (d.telefono || "—"),
    "Motivo:          " + d.motivo,
    "Patente:         " + (d.patente || "—"),
    "",
    "Contacto con aves: " + d.tipoContactoTexto,
    "Lugar:             " + d.lugarContacto,
    "Último contacto:   " + d.fechaContacto + " (" + d.noches + " noche(s); se exigen " + d.nochesExigidas + ")",
    "Observaciones:     " + (d.obs || "—"),
    "",
    "ESTADO: " + estado,
    "",
    "Este mensaje fue generado automáticamente por el registro de visitas de " + CONFIG.NOMBRE_EMPRESA + ".",
  ].join("\n");

  MailApp.sendEmail({ to: destinatarios.join(","), subject: asunto, body: cuerpo });
}

// ============================================================
//  UTILIDADES
// ============================================================
function zona() {
  return Session.getScriptTimeZone() || "America/Santiago";
}
function formatFecha(d) {
  return Utilities.formatDate(d, zona(), "dd/MM/yyyy");
}
function formatHora(d) {
  return Utilities.formatDate(d, zona(), "HH:mm");
}

// Prueba manual desde el editor: menú Ejecutar → probarRegistro.
// Escribe SOLO en la pestaña «PRUEBA Las Rastras».
function probarRegistro() {
  const r = registrarVisita({
    sectorId: "lr-prueba", nombre: "Prueba Editor", rut: "11.111.111-1",
    empresa: "AviVet", motivo: "Prueba del sistema", aves: "No",
  });
  Logger.log(JSON.stringify(r));
}


// ============================================================
//  INSTRUCCIONES (resumen; el detalle paso a paso está en README.md)
// ============================================================
//
//  1. En la hoja de Google: Extensiones → Apps Script.
//  2. Selecciona todo el código del editor y reemplázalo por este archivo.
//  3. Revisa CONFIG.EMAIL_ALERTA y, si quieres, `emailAlerta` de cada sector.
//  4. Guarda (Ctrl+S / Cmd+S).
//  5. Implementar → Administrar implementaciones → lápiz (editar) →
//     Versión: «Nueva versión» → Implementar. Así la URL /exec NO cambia.
//     (Si creas una «Nueva implementación», la URL cambia y hay que
//     actualizar SCRIPT_URL en index.html.)
//  6. Prueba: abre index.html?s=lr-prueba, registra una visita y revisa la
//     pestaña «PRUEBA Las Rastras».
//
// ============================================================
