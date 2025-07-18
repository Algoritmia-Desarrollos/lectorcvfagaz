// --- SELECTORES Y CONSTANTES GLOBALES ---
const resumenesList = document.getElementById('resumenes-list');
const modalContainer = document.getElementById('modal-container');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalCloseBtn = document.getElementById('modal-close');
const OPENAI_API_KEY = "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";
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
let archivosCache = []; // Caché local para no leer de la DB constantemente

// --- LÓGICA PRINCIPAL ---
window.addEventListener('DOMContentLoaded', async () => {
    const processingStatus = document.createElement('div');
    document.querySelector('.resumenes-container').prepend(processingStatus);
    processingStatus.className = 'processing-status';
    
    try {
        archivosCache = await obtenerTodosLosCVs();
        
        if (archivosCache.length === 0) {
            processingStatus.textContent = "Aún no se ha postulado ningún candidato.";
            return;
        }

        const nuevosArchivos = archivosCache.filter(cv => !cv.resumen);
        processingStatus.textContent = nuevosArchivos.length > 0 ? `Analizando ${nuevosArchivos.length} CVs nuevos...` : "Todos los CVs están actualizados.";
        
        let procesadosCount = 0;
        for (const cv of archivosCache) {
            try {
                if (!cv.resumen) {
                    procesadosCount++;
                    const nombreOriginal = cv.nombreArchivo || cv.nombre || "candidato";
                    processingStatus.textContent = `Procesando ${procesadosCount} de ${nuevosArchivos.length} CVs nuevos... (${nombreOriginal})`;
                    
                    const texto = await extraerTextoOCR(cv.base64);
                    const iaData = await procesarCVConIA(texto);
                    
                    cv.texto = texto;
                    cv.resumen = iaData.resumen;
                    cv.nombreCandidato = iaData.nombreCompleto;
                    cv.email = iaData.email;
                    cv.telefono = iaData.telefono;
                    
                    await actualizarCVEnDB(cv);
                }
            } catch (error) {
                console.error(`Falló el procesamiento para el CV con ID ${cv.id}:`, error);
                cv.resumen = `❌ Error irrecuperable al procesar este CV.`;
                await actualizarCVEnDB(cv);
            }
            renderizarTarjeta(cv);
        }

        if (nuevosArchivos.length > 0) {
            processingStatus.textContent = `Proceso completado. Se analizaron ${nuevosArchivos.length} CVs.`;
        }
    } catch (dbError) {
        console.error("Error fatal al interactuar con la base de datos:", dbError);
        processingStatus.textContent = "Error crítico al cargar los datos de los candidatos.";
    }
});

// --- MANEJO DE EVENTOS DE BOTONES (DELEGACIÓN) ---
resumenesList.addEventListener('click', (e) => {
    const button = e.target.closest('.action-btn');
    if (!button) return;

    const card = button.closest('.cv-card');
    const cvId = parseInt(card.dataset.id);
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

modalCloseBtn.addEventListener('click', cerrarModal);
modalContainer.addEventListener('click', (e) => {
    if (e.target === modalContainer) {
        cerrarModal();
    }
});

// --- FUNCIONES PARA MANEJAR LAS VENTANAS MODALES ---
function abrirModal() {
    modalContainer.classList.remove('hidden');
    setTimeout(() => modalContainer.classList.add('visible'), 10);
}

function cerrarModal() {
    modalContainer.classList.remove('visible');
    setTimeout(() => {
        modalContainer.classList.add('hidden');
        modalBody.innerHTML = ''; // Limpiar contenido
    }, 300);
}

function abrirModalResumen(cv) {
    modalTitle.textContent = `Resumen de ${cv.nombreCandidato || 'Candidato'}`;
    modalBody.innerHTML = `<p>${cv.resumen ? cv.resumen.replace(/\n/g, '<br>') : 'No hay resumen disponible.'}</p>`;
    abrirModal();
}

function abrirModalContacto(cv) {
    modalTitle.textContent = `Contacto de ${cv.nombreCandidato || 'Candidato'}`;
    modalBody.innerHTML = `
        <ul>
            <li><strong>Nombre:</strong> ${cv.nombreCandidato || 'No extraído'}</li>
            <li><strong>Email:</strong> ${cv.email || 'No extraído'}</li>
            <li><strong>Teléfono:</strong> ${cv.telefono || 'No extraído'}</li>
        </ul>
    `;
    abrirModal();
}

function abrirModalNotas(cv) {
    modalTitle.textContent = `Notas sobre ${cv.nombreCandidato || 'Candidato'}`;
    modalBody.innerHTML = `
        <textarea id="notas-textarea" placeholder="Escribe tus notas aquí...">${cv.notas || ''}</textarea>
        <div class="modal-footer">
            <button id="guardar-notas-btn" class="action-btn download-btn">Guardar Notas</button>
        </div>
    `;
    document.getElementById('guardar-notas-btn').onclick = async () => {
        const nuevasNotas = document.getElementById('notas-textarea').value;
        cv.notas = nuevasNotas;
        await actualizarCVEnDB(cv);
        cerrarModal();
        const cardElement = document.querySelector(`.cv-card[data-id="${cv.id}"]`);
        if (cardElement) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = renderizarTarjeta(cv, true);
            cardElement.replaceWith(tempDiv.firstChild);
        }
    };
    abrirModal();
}

// --- FUNCIÓN DE RENDERIZADO ---
function renderizarTarjeta(cv, returnHtml = false) {
    const nombreOriginal = cv.nombreArchivo || cv.nombre || 'archivo.pdf';
    const nombreCandidato = cv.nombreCandidato || nombreOriginal.replace(/\.pdf$/i, '');
    const nombreArchivoDescarga = (cv.nombreCandidato ? cv.nombreCandidato.replace(/ /g, '_') : 'CV_Descargado') + '.pdf';
    const notasClass = cv.notas ? 'has-notes' : '';

    const cardHtml = `
        <div class="cv-card" data-id="${cv.id}">
            <div class="candidate-name">${nombreCandidato}</div>
            <div>-</div>
            <div><button class="action-btn" data-action="ver-resumen" title="Ver resumen de la IA">Resumen IA</button></div>
            <div><button class="action-btn ${notasClass}" data-action="ver-notas" title="Ver o editar notas">Notas</button></div>
            <div class="actions">
                <a href="${cv.base64}" download="${nombreArchivoDescarga}" class="action-btn download-btn">Ver CV</a>
                <button class="action-btn" data-action="ver-contacto" title="Ver información de contacto">Contacto</button>
            </div>
        </div>
    `;
    if (returnHtml) {
        return cardHtml;
    }
    const existingCard = document.querySelector(`.cv-card[data-id='${cv.id}']`);
    if(existingCard) {
        existingCard.outerHTML = cardHtml;
    } else {
        resumenesList.insertAdjacentHTML('beforeend', cardHtml);
    }
}

// --- FUNCIÓN DE IA (CON PROMPT MEJORADO) ---
async function procesarCVConIA(texto) {
    if (!texto || texto.startsWith("❌")) {
        return { nombreCompleto: null, email: null, telefono: null, resumen: "No hay texto válido para analizar." };
    }
    
    // --- NOVEDAD: INSTRUCCIONES MÁS DETALLADAS PARA LA IA ---
    const prompt = `
        Tu tarea es analizar el siguiente texto extraído de un Currículum Vitae y actuar como un asistente de RRHH experto. 
        Debes extraer 4 datos específicos con alta precisión. 
        Devuelve tu respuesta únicamente en un formato JSON válido con las claves "nombreCompleto", "email", "telefono" y "resumen".

        **Instrucciones detalladas para la extracción:**

        1.  **"nombreCompleto"**: Identifica el nombre y apellido completos del candidato que encabeza el CV.
        
        2.  **"email"**: Localiza la dirección de correo electrónico principal. Busca obligatoriamente el símbolo "@". A menudo, el email está precedido por la palabra \`email:\` o un icono (ej: ✉️, 📧) que el OCR puede transcribir como un caracter extraño. Asegúrate de que el email pertenezca al candidato.

        3.  **"telefono"**: Extrae el número de teléfono o celular principal. **La mayoría de los números son de Argentina.** Presta especial atención a secuencias de 8 a 12 dígitos. Busca activamente palabras clave como \`teléfono:\`, \`tel:\`, \`celular:\`, \`cel:\`, \`whatsapp:\`, \`número:\` o \`contacto:\`. A veces, un icono (ej: 📞, 📱) es transcrito por el OCR como un caracter extraño justo antes del número; considéralo una pista clave. El número final debe estar limpio: sin espacios, guiones ni paréntesis, pero conservando el prefijo internacional \`+54\` si está presente. Por ejemplo, si encuentras \`(0341) 155-123456\`, un buen resultado sería \`341155123456\` o \`+549341...\`.

        4.  **"resumen"**: Crea un resumen profesional y conciso de aproximadamente 150 palabras sobre la experiencia, estudios y habilidades del candidato.

        Si un dato no se encuentra de forma clara, su valor en el JSON debe ser null. No inventes información.

        **TEXTO DEL CV:**
        """${texto}"""
    `;
    
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4-1106-preview",
                response_format: { "type": "json_object" },
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2, // Reducimos la temperatura para que sea más determinista
            })
        });
        if (!response.ok) {
            throw new Error(`Error de la API de OpenAI: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        const content = JSON.parse(data.choices[0].message.content);
        return {
            nombreCompleto: content.nombreCompleto || null,
            email: content.email || null,
            telefono: content.telefono || null,
            resumen: content.resumen || "No se pudo generar un resumen."
        };
    } catch (error) {
        console.error("Error llamando a OpenAI o parseando su respuesta:", error);
        return { nombreCompleto: null, email: null, telefono: null, resumen: "Fallo en la comunicación con la IA." };
    }
}

// --- FUNCIONES DE BASE DE DATOS (INDEXEDDB) ---
const DB_NAME = 'CVDatabase';
const STORE_NAME = 'cvs';

function abrirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3); 
    request.onerror = () => reject("Error al abrir IndexedDB");
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
  });
}

async function obtenerTodosLosCVs() {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject('Error al obtener los CVs: ' + event.target.error);
    });
}

async function actualizarCVEnDB(cv) {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.put(cv); 
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject('Error al actualizar el CV: ' + event.target.error);
    });
}

// --- FUNCIÓN DE PROCESAMIENTO DE PDF (OCR) ---
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