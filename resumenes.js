// Se importa el cliente de Supabase.
import { supabase } from './supabaseClient.js';
// ✨ CORRECCIÓN: Se importa la clave de API desde tu archivo de configuración.
import { OPENAI_API_KEY } from './config.js';


// --- SELECTORES Y CONSTANTES GLOBALES ---
const resumenesList = document.getElementById('resumenes-list');
const modalContainer = document.getElementById('modal-container');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalCloseBtn = document.getElementById('modal-close');
const panelTitle = document.getElementById('panel-title');
const processingStatus = document.getElementById('processing-status');
const filtroContainer = document.getElementById('filtro-container');
const filtroNombre = document.getElementById('filtro-nombre');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
let archivosCache = [];
let avisoActivo = null;

// --- LÓGICA PRINCIPAL ---
window.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const avisoId = parseInt(urlParams.get('avisoId'), 10);

    if (!avisoId) {
        panelTitle.textContent = 'Error';
        resumenesList.innerHTML = '<tr><td colspan="5">No se ha especificado una búsqueda. Selecciona una desde la <a href="lista-avisos.html">lista de búsquedas</a>.</td></tr>';
        return;
    }

    try {
        avisoActivo = await getAvisoById(avisoId);
        panelTitle.textContent = `Candidatos para: ${avisoActivo.titulo}`;
        await cargarYProcesarCandidatos(avisoId);
    } catch (error) {
        console.error("Error al cargar datos iniciales:", error);
        panelTitle.textContent = 'Error';
        resumenesList.innerHTML = `<tr><td colspan="5">La búsqueda laboral no fue encontrada o hubo un error al cargarla.</td></tr>`;
    }
});

async function cargarYProcesarCandidatos(avisoId) {
    processingStatus.classList.remove('hidden');
    
    const candidatos = await getCandidatosByAvisoId(avisoId);
    archivosCache = candidatos;

    if (candidatos.length === 0) {
        processingStatus.textContent = "Aún no hay candidatos para esta búsqueda.";
        resumenesList.innerHTML = `<tr><td colspan="5" style="text-align: center;">Nadie se ha postulado todavía.</td></tr>`;
        return;
    }

    actualizarVistaCandidatos();
    filtroContainer.classList.remove('hidden');

    const nuevosCandidatos = candidatos.filter(cv => cv.calificacion === null);
    if (nuevosCandidatos.length > 0) {
        processingStatus.textContent = `Analizando ${nuevosCandidatos.length} nuevos CVs...`;
        
        for (const [index, cv] of nuevosCandidatos.entries()) {
            processingStatus.textContent = `Procesando ${index + 1} de ${nuevosCandidatos.length}... (${cv.nombre_archivo})`;
            try {
                const textoCV = await extraerTextoOCR(cv.base64);
                // Aquí se llama a la función con el prompt mejorado.
                const iaData = await calificarCVConIA(textoCV, avisoActivo);
                
                const datosActualizados = {
                    texto_cv: textoCV,
                    nombre_candidato: iaData.nombreCompleto,
                    email: iaData.email,
                    telefono: iaData.telefono,
                    calificacion: iaData.calificacion,
                    resumen: iaData.justificacion
                };
                
                await actualizarCandidatoEnDB(cv.id, datosActualizados);
                Object.assign(cv, datosActualizados);
                
            } catch (error) {
                console.error(`Falló el procesamiento para el CV ${cv.id}:`, error);
                const datosError = {
                    calificacion: "Error",
                    resumen: `El análisis falló: ${error.message}`
                };
                await actualizarCandidatoEnDB(cv.id, datosError);
                Object.assign(cv, datosError);
            }
            actualizarFilaEnVista(cv.id);
        }
        processingStatus.textContent = "Análisis completado.";
    } else {
        processingStatus.textContent = "Todos los candidatos están calificados.";
    }
}

// --- FUNCIONES DE BASE DE DATOS (SUPABASE) ---
async function getAvisoById(id) {
    const { data, error } = await supabase.from('avisos').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
}

async function getCandidatosByAvisoId(avisoId) {
    const { data, error } = await supabase.from('candidatos').select('*').eq('aviso_id', avisoId);
    if (error) throw error;
    return data;
}

async function actualizarCandidatoEnDB(candidatoId, datos) {
    const { error } = await supabase.from('candidatos').update(datos).eq('id', candidatoId);
    if (error) throw error;
}

// =================================================================================
// ✨ NUEVA FUNCIÓN calificarCVConIA CON PROMPT DE RECLUTADOR EXPERTO ✨
// =================================================================================
async function calificarCVConIA(textoCV, aviso) {
    const textoCVOptimizado = textoCV.substring(0, 4000);
    const contextoAviso = `
- **Puesto:** ${aviso.titulo}
- **Condiciones Excluyentes (necesarias):** ${aviso.condiciones_necesarias.join(', ') || 'No especificadas'}
- **Condiciones Deseables (suman puntos):** ${aviso.condiciones_deseables.join(', ') || 'No especificadas'}
`;

    const prompt = `
Eres un especialista Senior en Reclutamiento y Selección, con un criterio muy agudo y realista. Tu misión es evaluar con precisión la idoneidad de un candidato para un puesto, asignando una calificación y una justificación que reflejen un análisis profundo.

**Contexto de la Búsqueda:**
${contextoAviso}

**Texto del CV a Analizar:**
"""${textoCVOptimizado}"""

**METODOLOGÍA DE EVALUACIÓN (SEGUIR ESTRICTAMENTE):**

**1. Análisis de Relevancia del Perfil (El Filtro Principal):**
Antes de ver los detalles, realiza un juicio holístico: ¿La experiencia principal y la profesión del candidato se alinean con la naturaleza fundamental del puesto?
- **Ejemplo:** Para un puesto de "Limpieza de Silos", la experiencia de un "Mecánico" es fundamentalmente NO relevante. Un "Operario de Producción" podría ser parcialmente relevante. Un "Técnico en Limpieza Industrial" es altamente relevante.
- **Regla Clave:** Un perfil no relevante NUNCA debe tener una calificación alta, sin importar qué otros requisitos secundarios cumpla.

**2. Sistema de Calificación (1-100) con Criterio Propio:**
No uses notas fijas. Aplica tu criterio dentro de estos rangos:
- **Calificación 1-30 (Descartado):** Para perfiles cuya experiencia central NO es relevante para el puesto. (Ej: el mecánico para el puesto de limpieza).
- **Calificación 31-65 (Bajo / Regular):** Para perfiles que son relevantes en su campo, PERO no cumplen con una o más de las **condiciones excluyentes**. La nota dependerá de la importancia del requisito no cumplido.
- **Calificación 66-85 (Bueno / Aceptable):** Para perfiles que son relevantes Y cumplen con **TODAS** las condiciones excluyentes. La nota base debería rondar los 70 y ajustarse según la calidad general del CV.
- **Calificación 86-100 (Excelente / Ideal):** Para perfiles que, además de ser relevantes y cumplir todo lo excluyente, también poseen varias de las **condiciones deseables** y demuestran una trayectoria sólida y coherente.
- **Importante:** Utiliza la escala completa para diferenciar candidatos. Evita repetir calificaciones exactas si hay diferencias, por sutiles que sean.

**3. Elaboración de la Justificación (Párrafo Único y Profesional):**
1.  **Extrae los datos de contacto** (nombre, email, teléfono).
2.  **Redacta un único párrafo de justificación.** Este debe ser tu dictamen profesional, explicando CLARAMENTE el porqué de la nota asignada, siguiendo esta estructura lógica:
    - Comienza con tu veredicto sobre la **relevancia del perfil**.
    - Luego, detalla el cumplimiento (o incumplimiento) de las **condiciones excluyentes y deseables** clave.
    - Concluye con una síntesis que justifique la calificación otorgada y una recomendación final.
    - **Ejemplo (Mecánico para Limpieza):** "La calificación es baja (ej. 18/100) porque el perfil del candidato, enfocado en mecánica automotriz, es fundamentalmente no relevante para la posición de Limpieza de Silos. Aunque menciona habilidades generales, carece de la experiencia específica requerida, por lo que no se considera un perfil adecuado."
    - **Ejemplo (Perfil Bueno):** "Este candidato presenta una experiencia relevante en logística, cumpliendo con los requisitos excluyentes de manejo de inventario y sistema de gestión. Aunque no posee conocimientos en el software deseable 'SAP', su sólida trayectoria justifica una buena calificación (ej. 78/100). Se recomienda una entrevista para validar su capacidad de adaptación."

**Formato de Salida (JSON estricto):**
Devuelve un objeto JSON con 5 claves: "nombreCompleto", "email", "telefono", "calificacion" (número entero) y "justificacion" (el string de texto).
`;
    
    const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            response_format: { "type": "json_object" },
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2, // Temperatura baja para que sea preciso y siga las reglas
        })
    });

    if (!response.ok) throw new Error(`API Error: ${response.status} - ${await response.text()}`);
    
    const data = await response.json();
    try {
        const content = JSON.parse(data.choices[0].message.content);
        return {
            nombreCompleto: content.nombreCompleto || null,
            email: content.email || null,
            telefono: content.telefono || null,
            calificacion: content.calificacion || 0,
            justificacion: content.justificacion || "No se pudo generar la justificación."
        };
    } catch (e) {
        console.error("Error al parsear la respuesta JSON de la IA:", e);
        throw new Error("La respuesta de la IA no tenía el formato JSON esperado.");
    }
}

// --- EL RESTO DEL CÓDIGO (RENDERIZADO Y MODALES) NO NECESITA CAMBIOS ---

function abrirModalResumen(cv) {
    modalTitle.textContent = `Análisis de ${cv.nombre_candidato || 'Candidato'}`;
    let bodyContent = `<h4>Calificación: ${typeof cv.calificacion === 'number' ? cv.calificacion + '/100' : cv.calificacion}</h4><p>${cv.resumen ? cv.resumen.replace(/\n/g, '<br>') : 'No hay análisis disponible.'}</p>`;
    modalBody.innerHTML = bodyContent;
    abrirModal();
}

function actualizarVistaCandidatos() {
    const filtro = filtroNombre.value.toLowerCase();
    const candidatosFiltrados = archivosCache.filter(cv => {
        const nombre = (cv.nombre_candidato || cv.nombre_archivo || '').toLowerCase();
        return nombre.includes(filtro);
    });

    candidatosFiltrados.sort((a, b) => {
        const scoreA = (typeof a.calificacion === 'number' ? a.calificacion : -1);
        const scoreB = (typeof b.calificacion === 'number' ? b.calificacion : -1);
        return scoreB - scoreA;
    });

    resumenesList.innerHTML = '';
    if (candidatosFiltrados.length === 0) {
        resumenesList.innerHTML = '<tr><td colspan="5" style="text-align: center;">No se encontraron candidatos.</td></tr>';
    } else {
        candidatosFiltrados.forEach(cv => renderizarFila(cv, true));
    }
}

function actualizarFilaEnVista(cvId) {
    const cv = archivosCache.find(c => c.id === cvId);
    if (cv) {
        renderizarFila(cv, false);
    }
}

function renderizarFila(cv, esNueva) {
    const nombreCandidato = cv.nombre_candidato || cv.nombre_archivo.replace(/\.pdf$/i, '');
    let calificacionMostrada;
    if (cv.calificacion === null) {
        calificacionMostrada = '<em>Analizando...</em>';
    } else if (typeof cv.calificacion === 'number') {
        calificacionMostrada = `<strong>${cv.calificacion} / 100</strong>`;
    } else {
        calificacionMostrada = `<strong style="color: #dc3545;">${cv.calificacion}</strong>`;
    }

    const notasClass = cv.notas ? 'has-notes' : '';
    const rowHTML = `
        <td><strong>${nombreCandidato}</strong></td>
        <td>${calificacionMostrada}</td>
        <td><button class="action-btn" data-action="ver-resumen" ${cv.calificacion === null || cv.calificacion === 'Error' ? 'disabled' : ''}>Análisis IA</button></td>
        <td><button class="action-btn ${notasClass}" data-action="ver-notas">Notas</button></td>
        <td>
            <div class="actions-group">
                <a href="${cv.base64}" download="${nombreCandidato.replace(/ /g, '_')}.pdf" class="action-btn primary-btn">Ver CV</a>
                <button class="action-btn" data-action="ver-contacto" ${cv.calificacion === null || cv.calificacion === 'Error' ? 'disabled' : ''}>Contacto</button>
            </div>
        </td>
    `;
    
    if (esNueva) {
        const newRow = document.createElement('tr');
        newRow.dataset.id = cv.id;
        newRow.innerHTML = rowHTML;
        resumenesList.appendChild(newRow);
    } else {
        const existingRow = resumenesList.querySelector(`tr[data-id='${cv.id}']`);
        if (existingRow) {
            existingRow.innerHTML = rowHTML;
        }
    }
}

filtroNombre.addEventListener('input', actualizarVistaCandidatos);

resumenesList.addEventListener('click', (e) => {
    const button = e.target.closest('.action-btn');
    if (!button) return;

    const row = e.target.closest('tr');
    if (!row) return;

    const cvId = parseInt(row.dataset.id, 10);
    const action = button.dataset.action;
    const cv = archivosCache.find(c => c.id === cvId);

    if (!cv) {
        console.error("No se encontró el CV en la caché para el id:", cvId);
        return;
    }

    switch (action) {
        case 'ver-resumen':
            abrirModalResumen(cv);
            break;
        case 'ver-contacto':
            abrirModalContacto(cv);
            break;
        case 'ver-notas':
            abrirModalNotas(cv);
            break;
    }
});

modalCloseBtn.addEventListener('click', cerrarModal);
modalContainer.addEventListener('click', (e) => {
    if (e.target === modalContainer) {
        cerrarModal();
    }
});

function abrirModal() {
    modalContainer.classList.remove('hidden');
    setTimeout(() => modalContainer.classList.add('visible'), 10);
}

function cerrarModal() {
    modalContainer.classList.remove('visible');
    setTimeout(() => {
        modalContainer.classList.add('hidden');
        modalBody.innerHTML = '';
    }, 300);
}

function abrirModalContacto(cv) {
    modalTitle.textContent = `Contacto de ${cv.nombre_candidato || 'Candidato'}`;
    modalBody.innerHTML = `<ul><li><strong>Nombre:</strong> ${cv.nombre_candidato || 'No extraído'}</li><li><strong>Email:</strong> ${cv.email || 'No extraído'}</li><li><strong>Teléfono:</strong> ${cv.telefono || 'No extraído'}</li></ul>`;
    abrirModal();
}

async function abrirModalNotas(cv) {
    modalTitle.textContent = `Notas sobre ${cv.nombre_candidato || 'Candidato'}`;
    modalBody.innerHTML = `<textarea id="notas-textarea" placeholder="Escribe tus notas aquí...">${cv.notas || ''}</textarea><div class="modal-footer"><button id="guardar-notas-btn" class="action-btn primary-btn">Guardar</button></div>`;
    
    document.getElementById('guardar-notas-btn').onclick = async () => {
        const nuevasNotas = document.getElementById('notas-textarea').value;
        try {
            await actualizarCandidatoEnDB(cv.id, { notas: nuevasNotas });
            const candidatoCache = archivosCache.find(c => c.id === cv.id);
            candidatoCache.notas = nuevasNotas;
            cerrarModal();
            actualizarFilaEnVista(cv.id);
        } catch (error) {
            console.error("Error al guardar las notas:", error);
            alert("No se pudieron guardar las notas.");
        }
    };
    abrirModal();
}

async function fetchWithTimeout(resource, options = {}, timeout = 60000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error('La solicitud a la IA tardó demasiado (Timeout).');
        }
        throw error;
    }
}

async function extraerTextoOCR(base64) {
  try {
    const pdf = await pdfjsLib.getDocument(base64).promise;
    const totalPages = pdf.numPages;
    const canvas = document.createElement('canvas');
    let texto = '';
    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      const result = await Tesseract.recognize(canvas, 'spa');
      texto += `\n--- Página ${i} ---\n${result.data.text}`;
    }
    return texto;
  } catch (error) {
    console.error("Error en OCR:", error);
    throw new Error("Falla al leer el archivo PDF con OCR.");
  }
}