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

const OPENAI_API_KEY = "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"; // Reemplaza con tu clave
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
        resumenesList.innerHTML = '<tr><td colspan="5">No se ha especificado una búsqueda. Selecciona una desde la <a href="lista-avisos.html">lista de búsquedas</a>.</td></tr>';
        return;
    }

    const db = await abrirDB();
    const aviso = await getAvisoById(db, avisoId);
    if (!aviso) {
        panelTitle.textContent = 'Error';
        resumenesList.innerHTML = '<tr><td colspan="5">La búsqueda laboral no fue encontrada.</td></tr>';
        return;
    }
    
    avisoActivo = aviso;
    panelTitle.textContent = `Candidatos para: ${aviso.titulo}`;
    
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

    // NOVEDAD: Muestra inmediatamente todos los candidatos (los nuevos aparecerán como "Analizando...")
    actualizarVistaCandidatos();
    filtroContainer.classList.remove('hidden');

    const nuevosCandidatos = candidatos.filter(cv => cv.calificacion === null);
    if (nuevosCandidatos.length > 0) {
        processingStatus.textContent = `Analizando ${nuevosCandidatos.length} nuevos CVs...`;
        
        let procesadosCount = 0;
        for (const cv of nuevosCandidatos) {
            procesadosCount++;
            const nombreOriginal = cv.nombreArchivo || "candidato";
            processingStatus.textContent = `Procesando ${procesadosCount} de ${nuevosCandidatos.length}... (${nombreOriginal})`;
            try {
                const textoCV = await extraerTextoOCR(cv.base64);
                const iaData = await calificarCVConIA(textoCV, avisoActivo);
                
                // Actualizar el objeto en la caché local
                cv.texto = textoCV;
                cv.nombreCandidato = iaData.nombreCompleto;
                cv.email = iaData.email;
                cv.telefono = iaData.telefono;
                cv.calificacion = iaData.calificacion;
                cv.resumen = iaData.justificacion;
                
            } catch (error) {
                console.error(`Falló el procesamiento para el CV ${cv.id}:`, error);
                cv.calificacion = "Error"; // Marcar como error
                cv.resumen = `El análisis falló: ${error.message}`;
            }
            // Guardar en la DB y refrescar la tabla para mostrar el cambio
            await actualizarCandidatoEnDB(db, cv);
            actualizarVistaCandidatos();
        }
        processingStatus.textContent = "Análisis completado.";
    } else {
        processingStatus.textContent = "Todos los candidatos están calificados.";
    }
}


// --- FUNCIÓN CENTRAL PARA FILTRAR, ORDENAR Y RENDERIZAR ---
function actualizarVistaCandidatos() {
    const filtro = filtroNombre.value.toLowerCase();

    const candidatosFiltrados = archivosCache.filter(cv => {
        const nombre = (cv.nombreCandidato || cv.nombreArchivo || '').toLowerCase();
        return nombre.includes(filtro);
    });

    candidatosFiltrados.sort((a, b) => {
        const scoreA = (typeof a.calificacion === 'number' ? a.calificacion : 0);
        const scoreB = (typeof b.calificacion === 'number' ? b.calificacion : 0);
        return scoreB - scoreA;
    });

    resumenesList.innerHTML = '';
    if (candidatosFiltrados.length === 0) {
        resumenesList.innerHTML = '<tr><td colspan="5" style="text-align: center;">No se encontraron candidatos.</td></tr>';
    } else {
        candidatosFiltrados.forEach(cv => renderizarFila(cv));
    }
}

// --- MANEJO DE EVENTOS ---
filtroNombre.addEventListener('input', actualizarVistaCandidatos);

resumenesList.addEventListener('click', (e) => {
    const button = e.target.closest('.action-btn');
    if (!button) return;
    const row = e.target.closest('tr');
    const cvId = parseInt(row.dataset.id);
    const action = button.dataset.action;
    const cv = archivosCache.find(c => c.id === cvId);
    if (!cv) return;
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

// --- FUNCIÓN FETCH CON TIMEOUT ---
async function fetchWithTimeout(resource, options = {}, timeout = 60000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal  
        });
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

// --- LÓGICA DE IA ---
async function calificarCVConIA(textoCV, aviso) {
    const textoCVOptimizado = textoCV.substring(0, 4000);
    const contextoAviso = `Título del Puesto: ${aviso.titulo}, Condiciones Necesarias: ${aviso.condicionesNecesarias.join(', ')}, Condiciones Deseables: ${aviso.condicionesDeseables.join(', ')}`;
    const prompt = `Analiza el CV y compáralo con el aviso. Devuelve un JSON con 5 claves: "nombreCompleto", "email", "telefono", "calificacion" (número de 1 a 100) y "justificacion". REGLAS: Si no cumple TODAS las condiciones necesarias, la calificación no puede superar 40. Si las cumple, parte de 70 y suma puntos por las deseables. AVISO: """${contextoAviso}""" CV: """${textoCVOptimizado}"""`;
    
    const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            response_format: { "type": "json_object" },
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
        })
    });

    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);
    return {
        nombreCompleto: content.nombreCompleto || null,
        email: content.email || null,
        telefono: content.telefono || null,
        calificacion: content.calificacion || 0,
        justificacion: content.justificacion || "No se pudo generar la justificación."
    };
}

// --- RENDERIZADO Y MODALES ---
function renderizarFila(cv) {
    const nombreCandidato = cv.nombreCandidato || cv.nombreArchivo.replace(/\.pdf$/i, '');
    let calificacionMostrada;
    if (cv.calificacion === null) {
        calificacionMostrada = '<em>Analizando...</em>';
    } else if (typeof cv.calificacion === 'number') {
        calificacionMostrada = `<strong>${cv.calificacion} / 100</strong>`;
    } else {
        calificacionMostrada = `<strong style="color: #dc3545;">${cv.calificacion}</strong>`;
    }

    const notasClass = cv.notas ? 'has-notes' : '';
    const row = document.createElement('tr');
    row.dataset.id = cv.id;
    
    row.innerHTML = `
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
    
    const existingRow = resumenesList.querySelector(`tr[data-id='${cv.id}']`);
    if (existingRow) {
        existingRow.replaceWith(row);
    } else {
        resumenesList.appendChild(row);
    }
}

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
    let bodyContent = `<h4>Calificación: ${typeof cv.calificacion === 'number' ? cv.calificacion + '/100' : cv.calificacion}</h4><p>${cv.resumen ? cv.resumen.replace(/\n/g, '<br>') : 'No hay análisis disponible.'}</p>`;
    modalBody.innerHTML = bodyContent;
    abrirModal();
}
function abrirModalContacto(cv) {
    modalTitle.textContent = `Contacto de ${cv.nombreCandidato || 'Candidato'}`;
    modalBody.innerHTML = `<ul><li><strong>Nombre:</strong> ${cv.nombreCandidato || 'No extraído'}</li><li><strong>Email:</strong> ${cv.email || 'No extraído'}</li><li><strong>Teléfono:</strong> ${cv.telefono || 'No extraído'}</li></ul>`;
    abrirModal();
}
async function abrirModalNotas(cv) {
    modalTitle.textContent = `Notas sobre ${cv.nombreCandidato || 'Candidato'}`;
    modalBody.innerHTML = `<textarea id="notas-textarea" placeholder="Escribe tus notas aquí...">${cv.notas || ''}</textarea><div class="modal-footer"><button id="guardar-notas-btn" class="action-btn primary-btn">Guardar</button></div>`;
    document.getElementById('guardar-notas-btn').onclick = async () => {
        const nuevasNotas = document.getElementById('notas-textarea').value;
        const db = await abrirDB();
        const candidato = archivosCache.find(c => c.id === cv.id);
        candidato.notas = nuevasNotas;
        await actualizarCandidatoEnDB(db, candidato);
        cerrarModal();
        actualizarVistaCandidatos();
    };
    abrirModal();
}
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