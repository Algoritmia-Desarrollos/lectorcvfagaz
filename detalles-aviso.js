// 1. Importamos el cliente de Supabase para poder usarlo.
import { supabase } from './supabaseClient.js';

// --- SELECTORES (Sin cambios) ---
const avisoTitulo = document.getElementById('aviso-titulo');
const avisoIdSpan = document.getElementById('aviso-id');
const avisoMaxCv = document.getElementById('aviso-max-cv');
const avisoValidoHasta = document.getElementById('aviso-valido-hasta');
const avisoDescripcion = document.getElementById('aviso-descripcion');
const necesariasList = document.getElementById('necesarias-list');
const deseablesList = document.getElementById('deseables-list');
const linkPostulanteInput = document.getElementById('link-postulante');
const copiarLinkBtn = document.getElementById('copiar-link-btn');
const abrirLinkBtn = document.getElementById('abrir-link-btn');
const qrCanvas = document.getElementById('qr-canvas');

// 2. ELIMINAMOS EL CÓDIGO ANTIGUO DE INDEXEDDB
/*
// --- Base de datos ---
const DB_NAME = 'RecruitmentDB';
function abrirDB() {
  // ...código eliminado...
}

async function getAvisoById(id) {
    // ...código eliminado...
}
*/

// --- Lógica Principal ---
window.addEventListener('DOMContentLoaded', async () => {
    // Obtiene el ID del aviso desde la URL (ej: ?id=123)
    const urlParams = new URLSearchParams(window.location.search);
    const id = parseInt(urlParams.get('id'), 10);

    // Si no hay un ID en la URL, muestra un error.
    if (!id) {
        avisoTitulo.textContent = 'Aviso no encontrado';
        return;
    }

    // 3. BUSCAMOS EL AVISO EN SUPABASE
    const { data: aviso, error } = await supabase
        .from('avisos')      // De la tabla 'avisos'
        .select('*')         // Seleccionamos todas las columnas
        .eq('id', id)        // Donde el 'id' sea igual al de la URL
        .single();           // Esperamos un único resultado

    // Si hubo un error o no se encontró el aviso, lo mostramos.
    if (error || !aviso) {
        console.error("Error al buscar el aviso:", error);
        avisoTitulo.textContent = 'Aviso no encontrado';
        return;
    }
    
    // Si se encontró el aviso, rellenamos la página con sus datos.
    avisoTitulo.textContent = aviso.titulo;
    avisoIdSpan.textContent = aviso.id;
    avisoMaxCv.textContent = aviso.max_cv;
    avisoDescripcion.textContent = aviso.descripcion;
    
    // Formateamos la fecha para mostrarla correctamente.
    avisoValidoHasta.textContent = new Date(aviso.valido_hasta).toLocaleDateString('es-AR', { timeZone: 'UTC' });

    // Mostramos las listas de condiciones.
    necesariasList.innerHTML = aviso.condiciones_necesarias.map(c => `<li>${c}</li>`).join('') || '<li>No se especificaron condiciones.</li>';
    deseablesList.innerHTML = aviso.condiciones_deseables.map(c => `<li>${c}</li>`).join('') || '<li>No se especificaron condiciones.</li>';

    // Generamos el link de postulación y el código QR.
    const path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
    const link = `${window.location.origin}${path}/index.html?avisoId=${aviso.id}`;
    
    linkPostulanteInput.value = link;
    abrirLinkBtn.href = link;

    new QRious({
        element: qrCanvas,
        value: link,
        size: 150,
        background: 'white',
        foreground: '#334155'
    });
});

// Lógica para el botón de copiar (sin cambios)
copiarLinkBtn.addEventListener('click', () => {
    linkPostulanteInput.select();
    document.execCommand('copy');
    copiarLinkBtn.textContent = '¡Copiado!';
    setTimeout(() => { copiarLinkBtn.textContent = 'Copiar'; }, 2000);
});