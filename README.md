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
├── Codigo-GAS-Backend.js       ← Backend (Google Apps Script)
├── carteles/
│   ├── generar_carteles.py     ← Genera los carteles QR en PDF (A4)
│   ├── cartel-lr-<sector>.pdf  ← Un cartel por sector de Las Rastras
│   └── carteles-las-rastras.pdf← Los 4 juntos, para imprimir
├── assets/                     ← (opcional) logo-las-rastras.png para los carteles
└── README.md
```

> `Codigo-GAS-Backend.js` está versionado aquí como referencia, pero Google Apps Script no se sincroniza con git: cada cambio hay que copiarlo y pegarlo manualmente en el editor de Apps Script (ver sección siguiente) y volver a implementar una nueva versión.

---

## 🌐 URLs en producción

| Archivo | URL pública |
|---|---|
| Formulario | `https://avivet.cl/registro-visitas-avicola/` |
| Generador QR | `https://avivet.cl/registro-visitas-avicola/admin.html` |

---

## 🏭 Sectores con catálogo: Agrícola Las Rastras

Cada sector tiene su propio QR (URL corta `?s=<id>`), su pestaña en la hoja, su RUP y un folio correlativo propio.

| Sector | RUP | Etapa | URL del QR | Pestaña | Folio |
|---|---|---|---|---|---|
| Junquillar | 07.1.01.0171 | Recría | `…/?s=lr-junquillar` | `Las Rastras - Junquillar` | `JQ-000001` |
| San Francisco | 07.1.09.0505 | Postura | `…/?s=lr-san-francisco` | `Las Rastras - San Francisco` | `SF-000001` |
| Mariposa | 07.1.09.1386 | Postura | `…/?s=lr-mariposa` | `Las Rastras - Mariposa` | `MP-000001` |
| Ranquimili | 07.1.01.0170 | Postura | `…/?s=lr-ranquimili` | `Las Rastras - Ranquimili` | `RQ-000001` |
| PRUEBA | — | — | `…/?s=lr-prueba` | `PRUEBA Las Rastras` | `PR-000001` |

- El sector **PRUEBA** sirve para probar sin tocar datos reales: escribe en su propia pestaña y no manda correos.
- El catálogo está en dos lugares que deben coincidir: `SECTORES` en `index.html` (lo que ve el visitante) y `SECTORES` en `Codigo-GAS-Backend.js` (lo que manda: nombre de pestaña, RUP, folio y noches de vacío). Para agregar un sector o cambiar un plazo, edita ambos.
- **Noches de vacío** (de la ficha del plan de bioseguridad): 3 noches tras otro plantel avícola, planta, matadero o aves de traspatio; 2 noches para entrar a Junquillar (recría) desde un sector de postura de Las Rastras. Si el visitante declara un contacto dentro de ese plazo, el registro se guarda igual, pero la pantalla sale en **rojo**: «NO PUEDE INGRESAR sin autorización del Responsable de Bioseguridad», la fila queda en rojo con estado `REQUIERE AUTORIZACIÓN RB` y llega un correo de alerta.
- Los QR antiguos de otros clientes (`?granja=…&nombre=…&empresa=…`) siguen funcionando igual que antes.

### Carteles QR para imprimir

Los PDF están en [`carteles/`](./carteles/): uno por sector y `carteles-las-rastras.pdf` con los cuatro. Tamaño A4, QR de 12 cm con corrección de errores alta (H). Para regenerarlos (por ejemplo, al tener el logo):

```bash
pip3 install qrcode reportlab pillow opencv-python
python3 carteles/generar_carteles.py
```

El logo es `assets/logo-las-rastras.png` (marca **Huevos de Talca** de Agrícola Las Rastras). Como es apaisado, va arriba del QR y no encima. Para un logo cuadrado se puede agregar `--logo-en-qr`, que lo pone también al centro del QR (ocupa ≤22 % del ancho; la corrección H aguanta ~30 %). El QR y el pie del cartel usan el dominio `avivet.cl/registro-visitas-avicola/` (GitHub Pages con dominio propio). Al terminar, el script rasteriza cada PDF y comprueba con OpenCV que el QR se lee y apunta a la URL correcta; si alguno no se lee, lo avisa y termina con error.

### Pantalla «Ingreso registrado» y cómo el guardia la valida

- Solo aparece si el backend **confirmó** que guardó la fila (el formulario lee la respuesta JSON del Apps Script). Si no hay señal o el servidor falla, el visitante ve «No se guardó el registro» y puede reintentar.
- Muestra sector, RUP, nombre, folio, fecha y hora del registro, y el resto de los datos.
- **Anti-captura de pantalla:** tiene un reloj grande con segundos que avanzan y un contador «Registrado hace X min». El guardia solo tiene que comparar la hora con su reloj y ver que los segundos se mueven: una captura vieja no avanza. Después de 15 minutos el pase se pone gris («PASE VENCIDO») y la persona debe registrarse de nuevo.
- Si el guardia tiene dudas, busca el folio en la pestaña del sector.

---

## ⚙️ Configuración inicial (una sola vez)

### 1. Crear el Google Sheet

- Ve a [sheets.google.com](https://sheets.google.com) y crea un nuevo Sheet vacío
- Nómbralo: `Registro Visitas Avícola`
- El sistema creará automáticamente una pestaña por cada granja registrada

### 2. Configurar el Google Apps Script (backend)

1. Dentro del Sheet: **Extensiones → Apps Script**
2. Borra el contenido del editor y pega el contenido de [`Codigo-GAS-Backend.js`](./Codigo-GAS-Backend.js)
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

1. Ve a `https://avivet.cl/registro-visitas-avicola/admin.html`
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

| Folio | Fecha | Hora | Nombre | RUT | Empresa | Motivo | Patente | Aves | Observaciones | ⚠ Alerta | Timestamp |
|---|---|---|---|---|---|---|---|---|---|---|---|

- Las filas de **alerta por aves** aparecen en rojo
- El **folio** se genera automáticamente (ej: `REG-M5K2J-A3F`)
- El campo **Patente** es opcional (no todos los visitantes llegan en vehículo) pero se valida su formato si se completa

Desde la versión 2.0 se agregan al final: `Sector`, `RUP`, `Teléfono`, `Lugar contacto aves`, `Tipo contacto aves`, `Fecha último contacto aves`, `Noches desde contacto` y `Estado ingreso` (`AUTORIZADO` / `REQUIERE AUTORIZACIÓN RB`).

> El backend escribe **por nombre de columna**: en pestañas creadas con versiones anteriores agrega las columnas que falten al final y no mueve ni borra nada de lo que ya existe. Ya no hace falta correr `migrarColumnaPatente()`.

---

## 🔁 Actualizar el backend en Apps Script (paso a paso)

Google Apps Script no se sincroniza con git: cada cambio de `Codigo-GAS-Backend.js` hay que pegarlo a mano.

1. Abre la hoja de Google de registros → menú **Extensiones → Apps Script**.
2. En el editor, abre `Código.gs` (o el archivo que tenga el código), selecciona todo (`Cmd+A`) y bórralo.
3. Abre [`Codigo-GAS-Backend.js`](./Codigo-GAS-Backend.js) en GitHub → botón **Raw** → copia todo y pégalo en el editor.
4. Revisa arriba `CONFIG.EMAIL_ALERTA` y, si quieres que el Responsable de Bioseguridad reciba las alertas, escribe su correo en `emailAlerta` de cada sector de Las Rastras.
5. Guarda (`Cmd+S`).
6. Prueba sin publicar: arriba elige la función **`probarRegistro`** → **Ejecutar**. La primera vez pide permisos (hoja, correo, propiedades): acéptalos. Debe aparecer la pestaña **`PRUEBA Las Rastras`** con una fila `PR-000001`.
7. Publica la nueva versión **sin cambiar la URL**: **Implementar → Administrar implementaciones** → lápiz ✏️ de la implementación activa → en *Versión* elige **Nueva versión** → **Implementar**.
   - No uses «Nueva implementación»: eso crea otra URL y habría que cambiar `SCRIPT_URL` en `index.html`.
8. Prueba como visitante: abre `https://avivet.cl/registro-visitas-avicola/?s=lr-prueba` en el celular, registra una visita y comprueba que aparece la pantalla verde con folio `PR-…` y la fila en la pestaña de prueba. Repite declarando contacto con aves ayer: la pantalla debe salir en rojo.
9. Cuando todo esté bien, puedes ocultar o borrar la pestaña `PRUEBA Las Rastras`.

> Orden recomendado: primero pega y publica el backend 2.0, después sube `index.html` a GitHub Pages. El formulario nuevo también funciona con el backend anterior (lee su respuesta y calcula el bloqueo en el navegador), pero sin folio correlativo, sin pestaña por sector del catálogo y sin validación en el servidor.

---

## 🔒 Seguridad y privacidad

- Los datos se almacenan en tu propia cuenta de Google Drive
- El script corre bajo tus credenciales de Google
- No se comparte información con terceros
- `admin.html` está protegido con un PIN de 6 dígitos (pantalla de bloqueo con teclado numérico), con bloqueo temporal tras 5 intentos fallidos.
  **Importante:** esto es una traba de acceso básica, no una autenticación real. Cualquier página estática (GitHub Pages) expone su HTML/JS completo a quien la visite, así que un secreto embebido ahí — sea texto plano o hash — puede ser reproducido por alguien dispuesto a inspeccionar el código fuente. Sirve para evitar que alguien casual genere QR falsos, no para proteger datos sensibles (los registros de visitas nunca pasan por `admin.html`, viven solo en tu Google Sheet).
  Si en algún momento necesitas control de acceso real, la validación debe moverse a un backend que tú controles (por ejemplo, una acción de verificación agregada a `Codigo-GAS-Backend.js`, o restringir `admin.html` detrás de un login).
- La URL del backend (Apps Script `/exec`) queda escrita en el HTML público de `index.html` porque un sitio estático no tiene forma de ocultarla del navegador. Esto significa que, en teoría, cualquiera que la copie desde el código fuente podría hacer POST directo a tu planilla sin pasar por el formulario o el QR. Mitigación recomendada (se implementa en `Codigo-GAS-Backend.js` y luego se pega en Apps Script, no toma efecto solo por estar en este repo):
  - ✅ (v2.0) El backend valida los campos obligatorios, el dígito verificador del RUT, la patente y la fecha de contacto antes de escribir.
  - ✅ (v2.0) Los textos que empiezan con `=`, `+`, `-` o `@` se guardan como texto, para que no se ejecuten como fórmulas en Sheets.
  - ✅ (v2.0) El mismo RUT en el mismo sector dentro de 3 minutos no crea otra fila (evita doble toque o reintentos): devuelve el mismo folio.
  - Pendiente: límite de tasa general contra envíos masivos.
- El parámetro `?api=` (apuntar el formulario a otro backend) solo funciona en `localhost`, para pruebas; en GitHub Pages se ignora.

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
| Fecha y hora | ✅ | Las pone el servidor al guardar (hora de Chile) |
| Nombre completo | ✅ | Máx. 80 caracteres |
| RUT | ✅ | Formato auto: `12.345.678-9` + dígito verificador (en el navegador y en el servidor) |
| Empresa / Institución | ✅ | «Particular» si no viene de una empresa |
| Teléfono | — | Para trazabilidad si hay que ubicar a la persona |
| Motivo de visita | ✅ | Listado predefinido + «Otro» con descripción obligatoria |
| Patente del vehículo | — | Obligatoria si entra en vehículo; valida formato chileno (`AB1234` o `BBBB12`) |
| Contacto con aves en los últimos N días | ✅ | Sí / No (N según el sector) |
| ↳ Dónde fue el contacto | ✅ si «Sí» | Otro plantel/planta/matadero · aves de casa · otro sector de la empresa (solo Junquillar) |
| ↳ Último plantel o lugar | ✅ si «Sí» | Texto |
| ↳ Fecha del último contacto | ✅ si «Sí» | Calcula las noches de vacío cumplidas |
| Observaciones | — | Texto libre, máx. 400 caracteres |

Cubre lo que pide la pauta SAG para el registro de visitas y vehículos (fecha, nombre, RUT, empresa, motivo, patente y contacto previo con aves / último plantel visitado). El visitante puede marcar «Recordar mis datos en este celular» para no reescribir nombre, RUT, empresa, teléfono y patente la próxima vez (se guardan solo en su teléfono).

---

## 🛠 Panel admin (`admin.html`)

- Protegido con PIN de 6 dígitos (ver [Seguridad y privacidad](#-seguridad-y-privacidad) para las limitaciones reales de esto).
- Las granjas creadas se guardan en `localStorage` del navegador — son locales a ese dispositivo/navegador, no se sincronizan entre equipos. Cada granja se puede:
  - **Cargar** (clic en el nombre) para volver a ver su QR.
  - **Eliminar** del panel (ícono 🗑) — esto solo la quita de la lista local; el QR ya impreso sigue funcionando porque apunta directo a `index.html` con sus parámetros, no depende del panel admin.

---

## 📝 Registro de cambios

**Noviembre 2026 — versión 2.0 (Agrícola Las Rastras)**
- Un QR por sector (Junquillar, San Francisco, Mariposa, Ranquimili) con URL corta `?s=<id>`; cada sector guarda en su pestaña con RUP y folio correlativo (`JQ-000001`…). Sector `lr-prueba` para probar.
- Carteles A4 en PDF por sector (`carteles/`), con el logo Huevos de Talca, QR de corrección H con URL de avivet.cl y comprobación automática de lectura (72–300 dpi).
- Formulario completado según la pauta SAG: empresa obligatoria, teléfono, motivos más detallados, y contacto con aves con lugar, tipo y fecha del último contacto.
- Se elimina el falso éxito: el `fetch` ya no usa `no-cors`; lee la respuesta JSON del Apps Script y solo muestra «Ingreso registrado» si se guardó.
- Pantalla grande para el guardia: verde si está autorizado, roja si no cumple las noches de vacío («NO PUEDE INGRESAR sin autorización del Responsable de Bioseguridad»), con reloj en vivo y vencimiento a los 15 minutos contra capturas de pantalla.
- Backend: validación en el servidor, escritura por nombre de columna (compatible con pestañas antiguas), anti doble envío, protección contra fórmulas, correo de alerta con el estado del ingreso, función `probarRegistro()`.
- Panel admin: lista de sectores del catálogo y QR con corrección H.

**Julio 2026 (2)**
- Agregado campo opcional **Patente del vehículo** en el formulario, con auto-mayúsculas y validación de formato chileno (2 letras + 4 dígitos, o 4 letras + 2 dígitos).
- `Codigo-GAS-Backend.js` se agrega al repositorio (antes vivía solo pegado en Apps Script) y se actualiza para guardar la columna Patente, incluyendo una función `migrarColumnaPatente()` para agregar la columna a hojas de granjas creadas antes de este cambio.

**Julio 2026**
- Corregida una vulnerabilidad de XSS: los datos ingresados por visitantes/admin ya no se insertan en el DOM sin escapar.
- Agregada validación del dígito verificador del RUT chileno (antes solo se formateaba).
- Labels del formulario enlazados correctamente a sus campos (`for`/`id`) para accesibilidad con lectores de pantalla.
- El PIN de `admin.html` ya no está en texto plano en el código fuente (se compara por hash) y se bloquea temporalmente tras 5 intentos fallidos. Ver la nota de seguridad más arriba: sigue sin ser autenticación real, solo una traba más difícil de leer a simple vista.
- Agregada opción de eliminar granjas guardadas en el panel admin.

---

Desarrollado para **avivet.cl** · Medicina Veterinaria Avícola · Chile
