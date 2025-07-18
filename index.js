const fileInput = document.getElementById('fileInput');
const cvForm = document.getElementById('cv-form');
const submitBtn = document.getElementById('submit-btn');
const fileLabelText = document.getElementById('file-label-text');
const formView = document.getElementById('form-view');
const successView = document.getElementById('success-view');
const avisoContainer = document.getElementById('aviso-container');
const uploadSection = document.getElementById('upload-section');

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

// --- Lógica para mostrar el aviso ---
window.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const avisoId = parseInt(urlParams.get('avisoId'), 10);

    if (!avisoId) {
        avisoContainer.innerHTML = '<h1>Link de postulación inválido.</h1>';
        uploadSection.classList.add('hidden');
        return;
    }
    
    const db = await abrirDB();
    const transaction = db.transaction(['avisos'], 'readonly');
    const store = transaction.objectStore('avisos');
    const request = store.get(avisoId);

    request.onsuccess = () => {
        avisoActivo = request.result;
        if (avisoActivo) {
            // CORRECCIÓN: Usar snake_case para coincidir con la base de datos
            avisoContainer.innerHTML = `
                <div class="aviso-header">
                    <h1>${avisoActivo.titulo}</h1>
                    <div class="aviso-meta">
                        <span><strong>Cierre:</strong> ${new Date(avisoActivo.valido_hasta).toLocaleDateString('es-AR')}</span>
                        <span><strong>Cupo:</strong> ${avisoActivo.max_cv}</span>
                    </div>
                </div>
                <p class="descripcion">${avisoActivo.descripcion.replace(/\n/g, '<br>')}</p>
            `;
        } else {
            avisoContainer.innerHTML = '<h1>Esta búsqueda laboral no fue encontrada.</h1>';
            uploadSection.classList.add('hidden');
        }
    };
});

// --- Lógica de subida de archivo ---
let selectedFile = null;
fileInput.addEventListener('change', (e) => {
  selectedFile = e.target.files[0];
  if (selectedFile && selectedFile.type === 'application/pdf') {
    fileLabelText.textContent = selectedFile.name;
    submitBtn.disabled = false;
  } else {
    fileLabelText.textContent = 'Seleccionar archivo PDF';
    submitBtn.disabled = true;
    selectedFile = null;
  }
});

cvForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedFile || !avisoActivo) return;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando...';
  const reader = new FileReader();
  reader.onload = async function () {
    const base64 = reader.result;
    try {
      await guardarCVEnDB(selectedFile.name, base64, avisoActivo.id);
      formView.classList.add('hidden');
      successView.classList.remove('hidden');
    } catch (error) {
      console.error("Error al guardar en IndexedDB:", error);
      submitBtn.textContent = 'Error al guardar';
    }
  };
  reader.readAsDataURL(selectedFile);
});

async function guardarCVEnDB(nombre, base64, avisoId) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['candidatos'], 'readwrite');
    const objectStore = transaction.objectStore('candidatos');
    const nuevoCV = {
      id: Date.now(),
      avisoId: avisoId,
      nombreArchivo: nombre,
      base64: base64,
      texto: null,
      resumen: null,
      nombreCandidato: null,
      email: null,
      telefono: null,
      notas: '',
      calificacion: null
    };
    const request = objectStore.add(nuevoCV);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject('Error al guardar el CV: ' + event.target.error);
  });
}