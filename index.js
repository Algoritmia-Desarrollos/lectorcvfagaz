// Se importa el cliente de Supabase.
import { supabase } from './supabaseClient.js';

// --- SELECTORES (Sin cambios) ---
const fileInput = document.getElementById('fileInput');
const cvForm = document.getElementById('cv-form');
const submitBtn = document.getElementById('submit-btn');
const fileLabelText = document.getElementById('file-label-text');
const formView = document.getElementById('form-view');
const successView = document.getElementById('success-view');
const avisoContainer = document.getElementById('aviso-container');
const uploadSection = document.getElementById('upload-section');

let avisoActivo = null;

// --- Lógica para mostrar el aviso (Sin cambios) ---
window.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const avisoId = parseInt(urlParams.get('avisoId'), 10);

    if (!avisoId) {
        avisoContainer.innerHTML = '<h1>Link de postulación inválido.</h1>';
        uploadSection.classList.add('hidden');
        return;
    }
    
    const { data: aviso, error } = await supabase
        .from('avisos')
        .select('*')
        .eq('id', avisoId)
        .single();

    if (error || !aviso) {
        console.error("Error al buscar el aviso:", error);
        avisoContainer.innerHTML = '<h1>Esta búsqueda laboral no fue encontrada.</h1>';
        uploadSection.classList.add('hidden');
        return;
    }
    
    avisoActivo = aviso;
    avisoContainer.innerHTML = `
        <div class="aviso-header">
            <h1>${avisoActivo.titulo}</h1>
            <div class="aviso-meta">
                <span><strong>Cierre:</strong> ${new Date(avisoActivo.valido_hasta).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</span>
                <span><strong>Cupo:</strong> ${avisoActivo.max_cv}</span>
            </div>
        </div>
        <p class="descripcion">${avisoActivo.descripcion.replace(/\n/g, '<br>')}</p>
    `;
});

// --- Lógica de subida de archivo (Sin cambios) ---
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

// --- Lógica de envío del formulario (Sin cambios) ---
cvForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedFile || !avisoActivo) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    const reader = new FileReader();
    reader.onload = async function () {
        const base64 = reader.result;
        try {
            await guardarCVEnSupabase(selectedFile.name, base64, avisoActivo.id);
            formView.classList.add('hidden');
            successView.classList.remove('hidden');
        } catch (error) {
            console.error("Error al guardar en Supabase:", error);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Error al Enviar';
            alert(`Hubo un problema al enviar tu postulación: ${error.message}`);
        }
    };
    reader.readAsDataURL(selectedFile);
});

/**
 * Esta función prepara el objeto del candidato y lo inserta en Supabase.
 * Nota cómo NO se incluye un campo "id", ya que la base de datos
 * (una vez configurada con "Is Identity") se encargará de generarlo.
 */
async function guardarCVEnSupabase(nombre, base64, avisoId) {
    const nuevoCandidato = {
      aviso_id: avisoId,
      nombre_archivo: nombre,
      base64: base64,
      // El resto de los campos (resumen, calificación, etc.) se dejan nulos
      // para que el proceso de IA los llene después.
    };

    // Aquí es donde se intenta insertar en la base de datos.
    // Si la columna 'id' no es autoincremental, esta línea falla.
    const { error } = await supabase.from('candidatos').insert(nuevoCandidato);

    if (error) {
        // Si Supabase devuelve un error, se lanza para que el bloque .catch() lo muestre.
        throw new Error(error.message);
    }
}