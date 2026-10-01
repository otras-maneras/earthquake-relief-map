// ============================================================================
// Ejemplo de Webhook para Chatbot de WhatsApp usando Kapso y la API de AcopioVE
// ============================================================================
//
// Este script es un manejador de ejemplo en Node.js (JavaScript) que procesa
// los mensajes entrantes reenviados por Kapso y responde consultando la API
// pública de AcopioVE.
//
// Patrón de diseño:
//   Mensaje del usuario (WhatsApp) ──> Kapso ──> Tu Webhook (NodeJS)
//                                                  │
//   Respuesta por WhatsApp (Kapso) <── Envía <── Consulta API AcopioVE
//

const KAPSO_API_KEY = process.env.KAPSO_API_KEY || "TU_KAPSO_API_KEY";
const KAPSO_WABA_ID = process.env.KAPSO_WABA_ID || "TU_KAPSO_WABA_ID";

/**
 * Manejador del webhook de entrada (POST).
 * Adaptado para frameworks modernos como Next.js Route Handlers, Express, etc.
 */
export async function POST(req) {
  try {
    const msg = await req.json().catch(() => null);
    if (!msg) {
      return new Response('Body inválido', { status: 400 });
    }

    // Estructura básica de un mensaje entrante en Kapso
    const from = msg.from; // Número de teléfono del usuario remitente
    const texto = (msg.text || '').toLowerCase().trim();
    const location = msg.location; // Si el usuario envió una ubicación geográfica

    let respuestaText = "";

    // 1. Caso: El usuario comparte su ubicación (coordenadas GPS)
    if (location) {
      const { lat, lng } = location;
      console.log(`[Chatbot] Recibida ubicación de ${from}: Lat ${lat}, Lng ${lng}`);

      // Consultamos los 3 refugios más cercanos en un radio de 15km a través del directorio unificado
      const url = `http://localhost:4100/v1/puntos?tipo=refugio&near=${lat},${lng}&radius=15&limit=3`;
      const res = await fetch(url).then(r => r.json());
      
      const puntos = res.data || [];
      if (puntos.length > 0) {
        respuestaText = "*Refugios más cercanos encontrados:*\n\n" + 
          puntos.map((p, idx) => {
            const desc = p.descripcion ? `\n   _Necesidades: ${p.descripcion}_` : "";
            return `${idx + 1}. *${p.nombre}* (${p.ciudad || 'Sin ciudad'})${desc}`;
          }).join('\n\n') + 
          "\n\nPara más información visita: https://acopiove.org";
      } else {
        respuestaText = "No encontré refugios activos en un radio de 15 km de tu ubicación actual. Por favor, verifica el mapa en vivo en: https://acopiove.org";
      }

    // 2. Caso: El usuario solicita teléfonos de emergencia
    } else if (texto.includes('telefono') || texto.includes('emergencia') || texto === 'ayuda') {
      console.log(`[Chatbot] Consulta de teléfonos de emergencia de ${from}`);

      // Consultamos los teléfonos de emergencia unificados
      const url = "http://localhost:4100/v1/puntos?tipo=telefono&limit=5";
      const res = await fetch(url).then(r => r.json());
      
      const telefonos = res.data || [];
      if (telefonos.length > 0) {
        respuestaText = "*Líneas de Emergencia y Primera Respuesta:*\n\n" + 
          telefonos.map(p => `• *${p.nombre}*: ${p.telefono}`).join('\n') + 
          "\n\nGuarda estos números en tu agenda para emergencias.";
      } else {
        respuestaText = "No se pudieron recuperar los teléfonos de emergencia en este momento.";
      }

    // 3. Caso: Búsqueda PII-segura de personas (Reunificación)
    } else if (texto.startsWith('buscar ')) {
      const nombre = texto.replace('buscar ', '').trim();
      console.log(`[Chatbot] Búsqueda de persona: "${nombre}" por ${from}`);

      if (nombre.length < 2) {
        respuestaText = "Escribe al menos 2 caracteres después de 'buscar' (Ejemplo: _buscar Maria_)";
      } else {
        // Consultamos el endpoint PII-seguro de personas
        const url = `http://localhost:4100/v1/personas?q=${encodeURIComponent(nombre)}`;
        const res = await fetch(url).then(r => r.json());
        
        const personas = res.data || [];
        if (personas.length > 0) {
          respuestaText = `*Resultados de búsqueda para: "${nombre}"*\n\n` + 
            personas.map(p => {
              const lugar = p.ubicacion_general ? ` en ${p.ubicacion_general}` : "";
              const cedula = p.cedula ? ` (C.I. ${p.cedula})` : "";
              return `• *${p.nombre}*${cedula} — Estado: *${p.estado.toUpperCase()}*${lugar}\n   _Fuente: ${p.fuente}_`;
            }).join('\n\n');
        } else {
          respuestaText = `No encontré ningún registro para: "${nombre}".\n\n_Nota: Los datos agregados provienen de SOS Venezuela, Localizados y Venezuela Ayuda._`;
        }
      }

    // 4. Caso por defecto: Menú de bienvenida e instrucciones
    } else {
      respuestaText = "*Hola, soy el asistente de emergencia AcopioVE.*\n\n" +
        "Te puedo ayudar a encontrar apoyo rápido en las zonas afectadas por el terremoto.\n\n" +
        "¿Qué deseas hacer?\n" +
        "1. *Encontrar refugios:* Comparte tu ubicación GPS actual desde WhatsApp.\n" +
        "2. *Teléfonos de emergencia:* Escribe la palabra *telefonos*.\n" +
        "3. *Buscar un familiar:* Escribe *buscar* seguido del nombre (Ejemplo: _buscar Maria Gonzalez_).\n\n" +
        "_" + res.meta.attribution + "_";
    }

    // 5. Responder al usuario enviando un mensaje de texto a través de la API de Kapso
    // Nota: Como respondemos dentro de la ventana de interacción de 24 horas del usuario,
    // podemos enviar texto libre sin necesidad de plantillas pre-aprobadas de Meta.
    await sendKapsoTextMessage(from, respuestaText);

    return new Response('ok', { status: 200 });

  } catch (error) {
    console.error('[Chatbot Error]', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * Helper para enviar un mensaje de texto de WhatsApp utilizando la API de Kapso.
 */
async function sendKapsoTextMessage(to, textBody) {
  const url = `https://api.kapso.ai/meta/whatsapp/v24.0/${KAPSO_WABA_ID}/messages`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': KAPSO_API_KEY // Encabezado de autenticación de Kapso
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: "text",
      text: {
        preview_url: false,
        body: textBody
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error al enviar mensaje por Kapso (status ${response.status}): ${errText}`);
  }
  
  return response.json();
}
