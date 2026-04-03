/**
 * =============================================================================
 * LEAD GENERATION ENGINE — Backend en Google Apps Script
 * Archivo: Code.gs
 *
 * MENTOR NOTE: Google Apps Script (GAS) usa el motor V8 de JavaScript.
 * El archivo .gs es simplemente JS ejecutado en los servidores de Google.
 * No necesitas instalar nada — todo vive en script.google.com
 *
 * CÓMO PUBLICAR ESTE SCRIPT:
 * 1. Ve a script.google.com → Nuevo proyecto
 * 2. Pega este código (reemplaza el código vacío)
 * 3. Cambia SHEET_ID por el ID de tu Google Sheet (está en la URL)
 * 4. Clic en "Implementar" → "Nueva implementación"
 * 5. Tipo: Aplicación web
 * 6. Ejecutar como: YO (tu cuenta de Google)
 * 7. Quién tiene acceso: CUALQUIER PERSONA (incluso anónimos)
 * 8. Clic en "Implementar" → Copia la URL → Pégala en tu HTML
 * =============================================================================
 */


// =============================================================================
// CONFIGURACIÓN — Edita esto con tus datos reales
// =============================================================================

/**
 * El ID de tu Google Sheet.
 * Está en la URL de tu hoja: docs.google.com/spreadsheets/d/[ESTE_ID]/edit
 *
 * MENTOR NOTE: Podríamos usar SpreadsheetApp.openById() o .getActiveSpreadsheet().
 * Usamos openById() porque es más robusto — funciona siempre,
 * incluso si el script no está vinculado a esa hoja específica.
 */
const SHEET_ID = '11ojKq8jxhb5CMdaJsIanO-LKW872o-CuoKQUEO5jirdo95gmNf9W0YR5';

/**
 * El nombre de la hoja (pestaña) donde guardarás los leads.
 * Si tu hoja se llama "Hoja 1", cámbialo. Recomendamos "Leads".
 */
const SHEET_NAME = 'Leads';


// =============================================================================
// FUNCIÓN PRINCIPAL — doPost(e)
//
// MENTOR NOTE: En Google Apps Script, doPost(e) es una función RESERVADA
// (como main() en C o __init__ en Python). GAS la llama automáticamente
// cuando alguien hace una petición HTTP POST a tu URL publicada.
//
// El parámetro 'e' es el objeto Event que contiene toda la información
// de la petición: headers, body, parámetros, etc.
// =============================================================================
function doPost(e) {

  // -------------------------------------------------------------------------
  // PASO 1: Parsear el JSON recibido
  //
  // MENTOR NOTE: El body llega como STRING en e.postData.contents.
  // JSON.parse() lo convierte de string a objeto JavaScript.
  // Ej: '{"nombre":"Ana"}' → { nombre: "Ana" }
  //
  // Envolvemos TODO en try/catch porque si el JSON está malformado,
  // JSON.parse() lanza una excepción y el script moriría sin responder.
  // Un backend profesional NUNCA debe crashear silenciosamente.
  // -------------------------------------------------------------------------
  try {

    // Verificar que llegaron datos
    if (!e || !e.postData || !e.postData.contents) {
      return buildResponse(400, 'Error: No se recibieron datos en el cuerpo de la petición.');
    }

    // Parsear el JSON del body
    const datos = JSON.parse(e.postData.contents);

    // -------------------------------------------------------------------------
    // PASO 2: Validación básica en el servidor
    //
    // MENTOR NOTE: NUNCA confíes solo en la validación del frontend.
    // Un usuario técnico puede saltarla enviando una petición directa
    // con curl o Postman. El backend debe validar por su cuenta.
    // Este principio se llama "Defense in Depth" (defensa en profundidad).
    // -------------------------------------------------------------------------
    if (!datos.nombre || !datos.telefono) {
      return buildResponse(400, 'Error: Faltan campos requeridos (nombre, telefono).');
    }

    // -------------------------------------------------------------------------
    // PASO 3: Abrir el Google Sheet y la hoja correcta
    // -------------------------------------------------------------------------
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const hoja = spreadsheet.getSheetByName(SHEET_NAME);

    // Si la hoja no existe, lanzar error descriptivo
    if (!hoja) {
      return buildResponse(500, `Error: No se encontró la hoja "${SHEET_NAME}". Verifica el nombre en tu Spreadsheet.`);
    }

    // -------------------------------------------------------------------------
    // PASO 4: Crear encabezados si la hoja está vacía
    //
    // MENTOR NOTE: getLastRow() regresa el número de la última fila con datos.
    // Si es 0, la hoja está vacía y necesitamos crear los encabezados.
    // Esto hace que el script sea "autosuficiente" — no tienes que preparar
    // manualmente la hoja cada vez.
    // -------------------------------------------------------------------------
    if (hoja.getLastRow() === 0) {
      const encabezados = [
        'Timestamp',
        'Nombre',
        'Teléfono',
        'Monto Solicitado (MXN)',
        'Plazo (meses)',
        'Pago Quincenal Estimado (MXN)',
        'Fuente'
      ];
      hoja.appendRow(encabezados);

      // Formatear encabezados: negrita y fondo verde
      const rangoEncabezado = hoja.getRange(1, 1, 1, encabezados.length);
      rangoEncabezado.setFontWeight('bold');
      rangoEncabezado.setBackground('#00845A');
      rangoEncabezado.setFontColor('#FFFFFF');
    }

    // -------------------------------------------------------------------------
    // PASO 5: Insertar la nueva fila con los datos del lead
    //
    // MENTOR NOTE: appendRow() siempre inserta en la PRIMERA fila vacía
    // después del último dato. Es más seguro que calcular getLastRow() + 1
    // manualmente, especialmente si múltiples peticiones llegan simultáneamente.
    //
    // El orden del array debe coincidir exactamente con el orden
    // de los encabezados que definimos arriba.
    //
    // Utilities.formatDate() formatea la fecha en zona horaria de México.
    // -------------------------------------------------------------------------
    const timestamp = Utilities.formatDate(
      new Date(),
      'America/Mexico_City',      // Zona horaria de Tlaxcala
      'yyyy-MM-dd HH:mm:ss'       // Formato ISO legible
    );

    const nuevaFila = [
      timestamp,
      sanitizar(datos.nombre),          // Nombre del prospecto
      sanitizar(datos.telefono),         // Teléfono / WhatsApp
      datos.monto             || 0,      // Monto solicitado
      datos.plazo_meses       || 0,      // Plazo en meses
      datos.pago_estimado_quincenal || 0,// Pago quincenal calculado
      'Landing Page'                     // Fuente del lead (útil si tienes varios canales)
    ];

    hoja.appendRow(nuevaFila);

    // -------------------------------------------------------------------------
    // PASO 6 (opcional pero recomendado): Auto-ajustar el ancho de columnas
    // -------------------------------------------------------------------------
    hoja.autoResizeColumns(1, 7);

    // -------------------------------------------------------------------------
    // PASO 7: Log para debugging
    //
    // MENTOR NOTE: Logger.log() escribe en el log de GAS.
    // Para verlo: Menú "Ejecutar" → "Registros de ejecución"
    // Útil cuando algo falla y necesitas rastrear qué recibiste.
    // -------------------------------------------------------------------------
    Logger.log('✅ Lead guardado exitosamente: ' + datos.nombre + ' - ' + datos.telefono);

    // Retornar éxito
    return buildResponse(200, 'Lead guardado exitosamente.');

  } catch (error) {
    // -------------------------------------------------------------------------
    // MANEJO DE ERRORES GLOBALES
    //
    // MENTOR NOTE: Si JSON.parse falla u ocurre cualquier error inesperado,
    // lo capturamos aquí. error.toString() convierte el objeto Error a un
    // string legible para debugging. NUNCA expongas el stack trace completo
    // en producción — pero en un proyecto de aprendizaje está bien.
    // -------------------------------------------------------------------------
    Logger.log('❌ Error en doPost: ' + error.toString());
    return buildResponse(500, 'Error interno del servidor: ' + error.toString());
  }
}


// =============================================================================
// FUNCIÓN AUXILIAR: buildResponse
//
// MENTOR NOTE: Esta función construye la respuesta HTTP de forma consistente.
// ContentService es la API de GAS para crear respuestas.
// setMimeType(JSON) agrega el header Content-Type: application/json.
//
// ¿Por qué una función separada? Principio DRY (Don't Repeat Yourself).
// Sin esto, tendríamos el mismo bloque de ContentService en cada return.
// =============================================================================
function buildResponse(statusCode, message) {
  const responseBody = JSON.stringify({
    status:  statusCode,
    message: message,
    ok:      statusCode === 200
  });

  /**
   * MENTOR NOTE — El truco del CORS en Google Apps Script:
   *
   * GAS con mode: 'no-cors' desde el frontend significa que el
   * navegador hace la petición pero NO lee la respuesta (queda "opaque").
   * Por eso el status code que ponemos aquí no llega al frontend.
   *
   * Sin embargo, esta función es útil para:
   * 1. Testing directo en el navegador o Postman (sí leen la respuesta)
   * 2. Debugging en los logs de GAS
   * 3. Si en el futuro migras a un backend que sí maneje CORS correctamente
   */
  return ContentService
    .createTextOutput(responseBody)
    .setMimeType(ContentService.MimeType.JSON);
}


// =============================================================================
// FUNCIÓN AUXILIAR: sanitizar
//
// MENTOR NOTE: Sanitización básica para prevenir que datos maliciosos
// o con caracteres extraños rompan el Sheet o sean usados en ataques.
// En un backend de producción esto sería más robusto, pero para
// un proyecto universitario este nivel es correcto y profesional.
// String() convierte cualquier tipo a string, trim() quita espacios
// al inicio/fin, substring(0, 100) limita la longitud máxima.
// =============================================================================
function sanitizar(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim().substring(0, 100);
}


// =============================================================================
// FUNCIÓN DE PRUEBA LOCAL — Para testear sin el frontend
//
// MENTOR NOTE: Esta función simula una petición doPost() desde
// el editor de GAS. Selecciónala en el dropdown de funciones y
// dale clic a "Ejecutar" para probar sin abrir el navegador.
// Revisa los logs con Ctrl+Enter o "Registros de ejecución".
// ¡Úsala para validar que tu Sheet ID y nombre de hoja son correctos!
// =============================================================================
function testDoPost() {
  const eventoSimulado = {
    postData: {
      contents: JSON.stringify({
        nombre:                    'Maestra García (TEST)',
        telefono:                  '2461234567',
        monto:                     75000,
        plazo_meses:               24,
        pago_estimado_quincenal:   1875,
        timestamp:                 new Date().toISOString()
      }),
      type: 'application/json'
    }
  };

  const resultado = doPost(eventoSimulado);
  Logger.log('Resultado del test: ' + resultado.getContent());
}
