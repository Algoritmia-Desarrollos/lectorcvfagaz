// --- SELECTORES ---
const avisoForm = document.getElementById('aviso-form');
const successMessage = document.getElementById('success-message');

// Inputs para condiciones
const necesariaInput = document.getElementById('necesaria-input');
const deseableInput = document.getElementById('deseable-input');

// Botones para añadir condiciones
const addNecesariaBtn = document.getElementById('add-necesaria-btn');
const addDeseableBtn = document.getElementById('add-deseable-btn');

// Listas para mostrar condiciones
const necesariasList = document.getElementById('necesarias-list');
const deseablesList = document.getElementById('deseables-list');

// --- ESTADO LOCAL ---
let condicionesNecesarias = [];
let condicionesDeseables = [];

// --- FUNCIONES DE RENDERIZADO ---
function renderizarCondiciones(lista, array, tipo) {
    lista.innerHTML = ''; // Limpiar la lista
    array.forEach((condicion, index) => {
        const item = document.createElement('li');
        item.className = 'condition-item';
        item.innerHTML = `
            <span>${condicion}</span>
            <button type="button" class="remove-btn" data-index="${index}" data-tipo="${tipo}">&times;</button>
        `;
        lista.appendChild(item);
    });
}

// --- MANEJO DE EVENTOS ---
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

// Event listener para los botones de eliminar (delegación)
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

avisoForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const avisoDeTrabajo = {
        titulo: document.getElementById('puesto-trabajo').value,
        descripcion: document.getElementById('descripcion-trabajo').value,
        maxCV: document.getElementById('max-cv').value,
        validoHasta: document.getElementById('valido-hasta').value,
        condicionesNecesarias,
        condicionesDeseables
    };

    localStorage.setItem('avisoDeTrabajoActivo', JSON.stringify(avisoDeTrabajo));

    successMessage.classList.remove('hidden');
    setTimeout(() => { successMessage.classList.add('hidden'); }, 4000);
});