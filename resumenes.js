// --- SELECTORES Y CONSTANTES GLOBALES ---
const resumenesList = document.getElementById('resumenes-list');
const modalContainer = document.getElementById('modal-container');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalCloseBtn = document.getElementById('modal-close');
const panelTitle = document.getElementById('panel-title');
const cvListHeader = document.getElementById('cv-list-header');
const processingStatus = document.getElementById('processing-status');

const OPENAI_API_KEY = "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";
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
let archivosCache = [];
let avisoActivo = null;

// --- Base de datos ---
const DB_NAME = 'RecruitmentDB';
function abrirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject("Error");
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('avisos')) db.createObjectStore('avisos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('candidatos')) db.createObjectStore('candidatos', { keyPath: 'id' }).createIndex('avisoId', 'avisoId');
    };
    request.onsuccess = (event) => resolve(event.target.result);
  });
}

// --- LÓGICA PRINCIPAL ---
window.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const avisoId = parseInt(urlParams.get('avisoId'), 10);

    if (!avisoId) {
        panelTitle.textContent = 'Error';
        resumenesList.innerHTML = '<p>No se ha especificado una búsqueda laboral. Por favor, selecciona una desde la <a href="lista-avisos.html">lista de búsquedas</a>.</p>';
        return;
    }

    const db = await abrirDB();
    const aviso = await getAvisoById(db, avisoId);
    if (!aviso) {
        panelTitle.textContent = 'Error';
        resumenesList.innerHTML = '<p>La búsqueda laboral no fue encontrada.</p>';
        return;
    }
    
    avisoActivo = aviso;
    panelTitle.textContent = `Candidatos para: ${aviso.titulo}`;
    cvListHeader.classList.remove('hidden');
    
    await cargarYProcesarCandidatos(db, avisoId);
});

async function cargarYProcesarCandidatos(db, avisoId) {
    processingStatus.classList.remove('hidden');
    const candidatos = await getCandidatosByAvisoId(db, avisoId);
    archivosCache = candidatos;

    if (candidatos.length === 0) {
        processingStatus.textContent = "Aún no hay candidatos para esta búsqueda.";
        return;
    }

    const nuevosCandidatos = candidatos.filter(cv => cv.calificacion === null);
    processingStatus.textContent = nuevosCandidatos.length > 0 ? `Analizando ${nuevosCandidatos.length} nuevos CVs...` : "Todos los candidatos están calificados.";
    
    resumenesList.innerHTML = ''; // Limpiar lista antes de renderizar
    for (const cv of candidatos) {
        if (cv.calificacion === null) {
            try {
                const textoCV = await extraerTextoOCR(cv.base64);
                const iaData = await calificarCVConIA(textoCV, avisoActivo);
                
                cv.texto = textoCV;
                cv.nombreCandidato = iaData.nombreCompleto;
                cv.email = iaData.email;
                cv.telefono = iaData.telefono;
                cv.calificacion = iaData.calificacion;
                cv.resumen = iaData.justificacion;
                
                await actualizarCandidatoEnDB(db, cv);
            } catch (error) {
                console.error(`Falló el procesamiento para el CV ${cv.id}:`, error);
                cv.calificacion = 0;
                cv.resumen = "Error durante el análisis de IA.";
                await actualizarCandidatoEnDB(db, cv);
            }
        }
        renderizarTarjeta(cv);
    }
    if (nuevosCandidatos.length > 0) processingStatus.textContent = "Análisis completado.";
}


// --- LÓGICA DE IA MEJORADA ---
async function calificarCVConIA(textoCV, aviso) {
    const contextoAviso = `
        Título del Puesto: ${aviso.titulo}
        Descripción: ${aviso.descripcion}
        Condiciones Necesarias (Excluyentes y Críticas): ${aviso.condicionesNecesarias.join(', ')}
        Condiciones Deseables (Suman puntos extra): ${aviso.condicionesDeseables.join(', ')}
    `;

    const prompt = `
        Eres un reclutador experto de RRHH. Tu tarea es analizar un CV en comparación con un aviso de trabajo específico. Debes ser estricto y objetivo.

        **TAREA:**
        Compara el "TEXTO DEL CV" con el "CONTEXTO DEL AVISO". Devuelve tu análisis únicamente en formato JSON con 5 claves: "nombreCompleto", "email", "telefono", "calificacion" y "justificacion".

        **REGLAS DE ANÁLISIS Y CALIFICACIÓN:**
        1.  **"nombreCompleto", "email", "telefono"**: Extrae los datos de contacto del candidato del CV.
        2.  **"calificacion"**: Asigna una nota numérica de 1 a 100.
            - Si el candidato **NO CUMPLE** con **TODAS** las "Condiciones Necesarias", la nota **NO PUEDE SER SUPERIOR a 40**. Es un filtro excluyente.
            - Si cumple con todas las necesarias, parte de una base de 70 puntos.
            - Suma puntos por cada "Condición Deseable" que cumpla y por experiencia general relevante, hasta un máximo de 100.
        3.  **"justificacion"**: Redacta un párrafo justificando la nota. Empieza mencionando si cumple o no con los requisitos necesarios. Luego, detalla las fortalezas y debilidades del candidato en relación al puesto. Sé claro y directo.

        **CONTEXTO DEL AVISO:**
        """
        ${contextoAviso}
        """

        **TEXTO DEL CV:**
        """
        ${textoCV}
        """
    `;
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "gpt-4-1106-preview",
            response_format: { "type": "json_object" },
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
        })
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);
    return {
        nombreCompleto: content.nombreCompleto,
        email: content.email,
        telefono: content.telefono,
        calificacion: content.calificacion,
        justificacion: content.justificacion
    };
}


// --- RENDERIZADO Y MODALES ---
// (Estas funciones se mantienen sin cambios significativos en su lógica interna)
function renderizarTarjeta(cv) {
    const nombreCandidato = cv.nombreCandidato || cv.nombreArchivo.replace(/\.pdf$/i, '');
    const calificacionMostrada = cv.calificacion !== null ? `<strong>${cv.calificacion} / 100</strong>` : '-';
    const notasClass = cv.notas ? 'has-notes' : '';
    const card = document.createElement('div');
    card.className = 'cv-card';
    card.dataset.id = cv.id;
    card.innerHTML = `
        <div class="candidate-name">${nombreCandidato}</div>
        <div>${calificacionMostrada}</div>
        <div><button class="action-btn" data-action="ver-resumen">Análisis IA</button></div>
        <div><button class="action-btn ${notasClass}" data-action="ver-notas">Notas</button></div>
        <div class="actions">
            <a href="${cv.base64}" download="${nombreCandidato.replace(/ /g, '_')}.pdf" class="action-btn download-btn">Ver CV</a>
            <button class="action-btn" data-action="ver-contacto">Contacto</button>
        </div>
    `;
    resumenesList.appendChild(card);
}
// ... (El resto de funciones como abrirModal, cerrarModal, etc. son idénticas a la versión anterior y no necesitan cambios)
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
function abrirModalResumen(cv) {
    modalTitle.textContent = `Análisis de ${cv.nombreCandidato || 'Candidato'}`;
    modalBody.innerHTML = `<h4>Calificación: ${cv.calificacion}/100</h4><p>${cv.resumen ? cv.resumen.replace(/\n/g, '<br>') : 'No hay análisis disponible.'}</p>`;
    abrirModal();
}
function abrirModalContacto(cv) {
    modalTitle.textContent = `Contacto de ${cv.nombreCandidato || 'Candidato'}`;
    modalBody.innerHTML = `<ul><li><strong>Nombre:</strong> ${cv.nombreCandidato}</li><li><strong>Email:</strong> ${cv.email}</li><li><strong>Teléfono:</strong> ${cv.telefono}</li></ul>`;
    abrirModal();
}
function abrirModalNotas(cv) {
    modalTitle.textContent = `Notas sobre ${cv.nombreCandidato || 'Candidato'}`;
    modalBody.innerHTML = `<textarea id="notas-textarea">${cv.notas || ''}</textarea><div class="modal-footer"><button id="guardar-notas-btn" class="action-btn download-btn">Guardar</button></div>`;
    document.getElementById('guardar-notas-btn').onclick = async () => {
        cv.notas = document.getElementById('notas-textarea').value;
        const db = await abrirDB();
        await actualizarCandidatoEnDB(db, cv);
        cerrarModal();
        renderizarTarjeta(cv); // Re-render to update notes button style
    };
    abrirModal();
}

// --- FUNCIONES DE BASE DE DATOS ---
async function getAvisoById(db, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['avisos'], 'readonly');
        const store = transaction.objectStore('avisos');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}
async function getCandidatosByAvisoId(db, avisoId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['candidatos'], 'readonly');
        const store = transaction.objectStore('candidatos');
        const index = store.index('avisoId');
        const request = index.getAll(avisoId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}
async function actualizarCandidatoEnDB(db, cv) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['candidatos'], 'readwrite');
        const store = transaction.objectStore('candidatos');
        const request = store.put(cv);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

// --- FUNCIÓN OCR ---
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