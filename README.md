# 🐓 Registro de Visitas Avícola

Sistema digital de registro de visitas para granjas avícolas, desarrollado para cumplir los requisitos de bioseguridad exigidos por el **SAG (Chile)**.

Permite generar un **código QR único por granja** que los visitantes escanean con su celular para completar el registro directamente desde el navegador, sin instalar ninguna app.

Los datos se guardan automáticamente en **Google Sheets**, con una pestaña por granja y alertas por email cuando el visitante declara contacto con aves domésticas.

---

## 📁 Estructura del repositorio

```
registro-visitas-avicola/
│
├── index.html                  ← Formulario de registro (la página del QR)
├── admin.html                  ← Generador de códigos QR por granja
└── README.md
```

> El código del backend (`Codigo-GAS-Backend.js`) **no se sube a GitHub**. Se pega directamente en Google Apps Script.

---

## 🌐 URLs en producción

| Archivo | URL pública |
|---|---|
| Formulario | `https://alazoe.github.io/registro-visitas-avicola/` |
| Generador QR | `https://alazoe.github.io/registro-visitas-avicola/admin.html` |

---

## ⚙️ Configuración inicial (una sola vez)

### 1. Crear el Google Sheet

- Ve a [sheets.google.com](https://sheets.google.com) y crea un nuevo Sheet vacío
- Nómbralo: `Registro Visitas Avícola`
- El sistema creará automáticamente una pestaña por cada granja registrada

### 2. Configurar el Google Apps Script (backend)

1. Dentro del Sheet: **Extensiones → Apps Script**
2. Borra el contenido del editor y pega el contenido de `Codigo-GAS-Backend.js`
3. Edita las dos líneas de configuración al inicio:

```js
EMAIL_ALERTA: "tucorreo@tudominio.com",   // ← tu correo real
NOMBRE_EMPRESA: "Huevos La Campestre",     // ← tu empresa
```

4. Guarda con `Ctrl+S`

### 3. Publicar el script como Web App

1. Clic en **"Implementar"** → **"Nueva implementación"**
2. Tipo: `Aplicación web`
3. Ejecutar como: `Yo (tu cuenta Google)`
4. Quién puede acceder: `Cualquier usuario`
5. Clic en **"Implementar"**
6. **Copia la URL** que aparece (la necesitas en el paso siguiente)

La URL tiene este formato:
```
https://script.google.com/macros/s/AKfycby.../exec
```

### 4. Conectar el formulario con el backend

En `index.html`, busca esta línea cerca del inicio del `<script>`:

```js
const SCRIPT_URL = "";
```

Pega tu URL entre las comillas:

```js
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby.../exec";
```

### 5. Subir a GitHub Pages

```bash
git add .
git commit -m "Setup inicial registro de visitas"
git push origin main
```

Activa GitHub Pages en **Settings → Pages → Branch: main → / (root)**.

---

## 📱 Uso diario

### Crear QR para una granja nueva

1. Ve a `https://alazoe.github.io/registro-visitas-avicola/admin.html`
2. Ingresa el nombre de la granja, empresa e ID
3. Haz clic en **"Generar código QR"**
4. Descarga la imagen PNG e imprímela
5. Ubica el cartel en la entrada de la granja

### Registro de visitas

El visitante:
1. Escanea el QR con la cámara del celular
2. Completa nombre, RUT, empresa y motivo
3. Declara si tiene aves domésticas
4. Presiona **"Registrar ingreso"**

El sistema:
- Guarda el registro en la pestaña correspondiente en Google Sheets
- Si declaró aves → fila en rojo + email de alerta al encargado

---

## 📊 Estructura del Google Sheet

Cada granja tiene su propia pestaña con las siguientes columnas:

| Folio | Fecha | Hora | Nombre | RUT | Empresa | Motivo | Aves | Observaciones | ⚠ Alerta | Timestamp |
|---|---|---|---|---|---|---|---|---|---|---|

- Las filas de **alerta por aves** aparecen en rojo
- El **folio** se genera automáticamente (ej: `REG-M5K2J-A3F`)

---

## 🔒 Seguridad y privacidad

- Los datos se almacenan en tu propia cuenta de Google Drive
- El script corre bajo tus credenciales de Google
- No se comparte información con terceros
- `admin.html` está protegido con un PIN de 6 dígitos (pantalla de bloqueo con teclado numérico), con bloqueo temporal tras 5 intentos fallidos.
  **Importante:** esto es una traba de acceso básica, no una autenticación real. Cualquier página estática (GitHub Pages) expone su HTML/JS completo a quien la visite, así que un secreto embebido ahí — sea texto plano o hash — puede ser reproducido por alguien dispuesto a inspeccionar el código fuente. Sirve para evitar que alguien casual genere QR falsos, no para proteger datos sensibles (los registros de visitas nunca pasan por `admin.html`, viven solo en tu Google Sheet).
  Si en algún momento necesitas control de acceso real, la validación debe moverse a un backend que tú controles (por ejemplo, una acción de verificación agregada a `Codigo-GAS-Backend.js`, o restringir `admin.html` detrás de un login).
- La URL del backend (Apps Script `/exec`) queda escrita en el HTML público de `index.html` porque un sitio estático no tiene forma de ocultarla del navegador. Esto significa que, en teoría, cualquiera que la copie desde el código fuente podría hacer POST directo a tu planilla sin pasar por el formulario o el QR. Mitigación recomendada (se hace en `Codigo-GAS-Backend.js`, no en este repo):
  - Validar en el backend que vengan todos los campos obligatorios antes de escribir en la hoja.
  - Agregar un límite de tasa simple (por IP o por minuto) para evitar spam masivo.
  - Opcional: exigir un token fijo en el payload (no es un secreto real tampoco, pero filtra bots genéricos).

---

## 🛠 Stack técnico

| Componente | Tecnología |
|---|---|
| Frontend | HTML + CSS + JS vanilla |
| Hosting | GitHub Pages |
| Backend | Google Apps Script |
| Base de datos | Google Sheets |
| QR Generation | qrcodejs (CDN) |
| Costo | $0 |

---

## 📋 Campos del formulario

| Campo | Obligatorio | Notas |
|---|---|---|
| Nombre completo | ✅ | Máx. 80 caracteres |
| RUT | ✅ | Formato auto: `12.345.678-9` + validación del dígito verificador |
| Empresa / Institución | — | Opcional, máx. 80 caracteres |
| Motivo de visita | ✅ | Listado predefinido + campo libre |
| Aves domésticas | ✅ | Activa alerta si responde "Sí" |
| Observaciones | — | Texto libre, máx. 400 caracteres |

---

## 🛠 Panel admin (`admin.html`)

- Protegido con PIN de 6 dígitos (ver [Seguridad y privacidad](#-seguridad-y-privacidad) para las limitaciones reales de esto).
- Las granjas creadas se guardan en `localStorage` del navegador — son locales a ese dispositivo/navegador, no se sincronizan entre equipos. Cada granja se puede:
  - **Cargar** (clic en el nombre) para volver a ver su QR.
  - **Eliminar** del panel (ícono 🗑) — esto solo la quita de la lista local; el QR ya impreso sigue funcionando porque apunta directo a `index.html` con sus parámetros, no depende del panel admin.

---

## 📝 Registro de cambios

**Julio 2026**
- Corregida una vulnerabilidad de XSS: los datos ingresados por visitantes/admin ya no se insertan en el DOM sin escapar.
- Agregada validación del dígito verificador del RUT chileno (antes solo se formateaba).
- Labels del formulario enlazados correctamente a sus campos (`for`/`id`) para accesibilidad con lectores de pantalla.
- El PIN de `admin.html` ya no está en texto plano en el código fuente (se compara por hash) y se bloquea temporalmente tras 5 intentos fallidos. Ver la nota de seguridad más arriba: sigue sin ser autenticación real, solo una traba más difícil de leer a simple vista.
- Agregada opción de eliminar granjas guardadas en el panel admin.

---

Desarrollado para **avivet.cl** · Medicina Veterinaria Avícola · Chile
