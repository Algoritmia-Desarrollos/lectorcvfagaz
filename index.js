const fileInput = document.getElementById('fileInput');
const cvForm = document.getElementById('cv-form');
const submitBtn = document.getElementById('submit-btn');
const fileLabelText = document.getElementById('file-label-text');
const formView = document.getElementById('form-view');
const successView = document.getElementById('success-view');
const avisoContainer = document.getElementById('aviso-container');
const uploadSection = document.getElementById('upload-section');

// --- LÓGICA PARA MOSTRAR EL AVISO ---
window.addEventListener('DOMContentLoaded', () => {
    const avisoJSON = localStorage.getItem('avisoDeTrabajoActivo');

    if (avisoJSON) {
        const aviso = JSON.parse(avisoJSON);
        
        avisoContainer.innerHTML = `
            <div class="aviso-header">
                <h1>${aviso.titulo}</h1>
                <div class="aviso-meta">
                    <span><strong>Cierre de postulación:</strong> ${aviso.validoHasta}</span>
                    <span><strong>Cupo de CVs:</strong> ${aviso.maxCV}</span>
                </div>
            </div>
            <p class="descripcion">${aviso.descripcion.replace(/\n/g, '<br>')}</p>
            <h3>Condiciones Necesarias</h3>
            <ul class="lista-condiciones">
                ${aviso.condicionesNecesarias.map(item => `<li>${item}</li>`).join('')}
            </ul>
             <h3>Condiciones Deseables</h3>
            <ul class="lista-condiciones">
                ${aviso.condicionesDeseables.map(item => `<li>${item}</li>`).join('')}
            </ul>
        `;
    } else {
        avisoContainer.innerHTML = '<h1>Actualmente no hay búsquedas activas.</h1>';
        uploadSection.classList.add('hidden');
    }
});


// --- LÓGICA DE SUBIDA DE ARCHIVO ---
// ... (El resto del archivo index.js, incluyendo la lógica de subida de CV y las funciones de IndexedDB, se mantiene exactamente igual que en la versión anterior. No es necesario cambiarlo).
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
  if (!selectedFile) return;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando...';
  const reader = new FileReader();
  reader.onload = async function () {
    const base64 = reader.result;
    try {
      await guardarCVEnDB(selectedFile.name, base64);
      formView.classList.add('hidden');
      successView.classList.remove('hidden');
    } catch (error) {
      console.error("Error al guardar en IndexedDB:", error);
      submitBtn.textContent = 'Error al guardar';
    }
  };
  reader.readAsDataURL(selectedFile);
});
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
async function guardarCVEnDB(nombre, base64) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const nuevoCV = {
      id: Date.now(),
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
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject('Error al guardar el CV: ' + event.target.error);
  });
}