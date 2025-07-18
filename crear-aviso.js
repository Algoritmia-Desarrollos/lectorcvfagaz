import { supabase } from './supabaseClient.js';

// --- SELECTORES ---
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
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Guardando...';

    const nuevoAviso = {
        id: Date.now(),
        titulo: document.getElementById('puesto-trabajo').value,
        descripcion: document.getElementById('descripcion-trabajo').value,
        max_cv: parseInt(document.getElementById('max-cv').value, 10),
        valido_hasta: document.getElementById('valido-hasta').value,
        condiciones_necesarias: condicionesNecesarias,
        condiciones_deseables: condicionesDeseables
    };

    const { error } = await supabase.from('avisos').insert(nuevoAviso);

    if (error) {
        console.error('Error al guardar el aviso:', error);
        alert('Hubo un error al guardar el aviso.');
        submitButton.disabled = false;
        submitButton.textContent = 'Guardar y Publicar';
        return;
    }

    successMessage.classList.remove('hidden');
    setTimeout(() => { successMessage.classList.add('hidden'); }, 4000);
    
    avisoForm.reset();
    condicionesNecesarias = [];
    condicionesDeseables = [];
    renderizarCondiciones(necesariasList, [], 'necesaria');
    renderizarCondiciones(deseablesList, [], 'deseable');
    submitButton.disabled = false;
    submitButton.textContent = 'Guardar y Publicar';
});