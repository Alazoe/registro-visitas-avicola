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
- El acceso al generador de QR (`admin.html`) es público por URL — se recomienda mantener la URL discreta o agregar autenticación si se requiere mayor control

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
| Nombre completo | ✅ | |
| RUT | ✅ | Formato auto: `12.345.678-9` |
| Empresa / Institución | — | Opcional |
| Motivo de visita | ✅ | Listado predefinido + campo libre |
| Aves domésticas | ✅ | Activa alerta si responde "Sí" |
| Observaciones | — | Texto libre |

---

Desarrollado para **avivet.cl** · Medicina Veterinaria Avícola · Chile
