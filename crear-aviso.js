const avisoForm = document.getElementById('aviso-form');
const successMessage = document.getElementById('success-message');
const necesariaInput = document.getElementById('necesaria-input');
const deseableInput = document.getElementById('deseable-input');
const addNecesariaBtn = document.getElementById('add-necesaria-btn');
const addDeseableBtn = document.getElementById('add-deseable-btn');
const necesariasList = document.getElementById('necesarias-list');
const deseablesList = document.getElementById('deseables-list');

let condicionesNecesarias = [];
let condicionesDeseables = [];

// --- Base de datos ---
const DB_NAME = 'RecruitmentDB';
function abrirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject("Error");
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('avisos')) {
        db.createObjectStore('avisos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('candidatos')) {
        db.createObjectStore('candidatos', { keyPath: 'id' }).createIndex('avisoId', 'avisoId');
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
  });
}

async function guardarAvisoEnDB(aviso) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['avisos'], 'readwrite');
    const store = transaction.objectStore('avisos');
    const request = store.add(aviso);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject('Error al guardar el aviso: ' + event.target.error);
  });
}

// --- Lógica de la interfaz ---
function renderizarCondiciones(lista, array, tipo) {
    lista.innerHTML = '';
    array.forEach((condicion, index) => {
        const item = document.createElement('li');
        item.className = 'condition-item';
        item.innerHTML = `<span>${condicion}</span><button type="button" class="remove-btn" data-index="${index}" data-tipo="${tipo}">&times;</button>`;
        lista.appendChild(item);
    });
}

addNecesariaBtn.addEventListener('click', () => {
    if (necesariaInput.value.trim()) {
        condicionesNecesarias.push(necesariaInput.value.trim());
        necesariaInput.value = '';
        renderizarCondiciones(necesariasList, condicionesNecesarias, 'necesaria');
    }
});

addDeseableBtn.addEventListener('click', () => {
    if (deseableInput.value.trim()) {
        condicionesDeseables.push(deseableInput.value.trim());
        deseableInput.value = '';
        renderizarCondiciones(deseablesList, condicionesDeseables, 'deseable');
    }
});

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-btn')) {
        const index = parseInt(e.target.dataset.index, 10);
        const tipo = e.target.dataset.tipo;
        if (tipo === 'necesaria') {
            condicionesNecesarias.splice(index, 1);
            renderizarCondiciones(necesariasList, condicionesNecesarias, 'necesaria');
        } else if (tipo === 'deseable') {
            condicionesDeseables.splice(index, 1);
            renderizarCondiciones(deseablesList, condicionesDeseables, 'deseable');
        }
    }
});

avisoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const avisoDeTrabajo = {
        id: Date.now(),
        titulo: document.getElementById('puesto-trabajo').value,
        descripcion: document.getElementById('descripcion-trabajo').value,
        maxCV: document.getElementById('max-cv').value,
        validoHasta: document.getElementById('valido-hasta').value,
        condicionesNecesarias,
        condicionesDeseables
    };
    await guardarAvisoEnDB(avisoDeTrabajo);
    successMessage.classList.remove('hidden');
    setTimeout(() => { successMessage.classList.add('hidden'); }, 4000);
    avisoForm.reset();
    condicionesNecesarias = [];
    condicionesDeseables = [];
    renderizarCondiciones(necesariasList, [], 'necesaria');
    renderizarCondiciones(deseablesList, [], 'deseable');
});