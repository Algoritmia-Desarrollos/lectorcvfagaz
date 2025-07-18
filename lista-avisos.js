const avisoListBody = document.getElementById('aviso-list-body');

// --- Base de datos ---
const DB_NAME = 'RecruitmentDB';
function abrirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject("Error al abrir IndexedDB");
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('avisos')) {
        db.createObjectStore('avisos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('candidatos')) {
        const candidatosStore = db.createObjectStore('candidatos', { keyPath: 'id' });
        candidatosStore.createIndex('avisoId', 'avisoId', { unique: false });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
  });
}

async function obtenerTodosLosDatos() {
    const db = await abrirDB();
    return new Promise((resolve) => {
        const transaction = db.transaction(['avisos', 'candidatos'], 'readonly');
        const avisosStore = transaction.objectStore('avisos');
        const candidatosStore = transaction.objectStore('candidatos');
        
        const avisosRequest = avisosStore.getAll();
        const candidatosRequest = candidatosStore.getAll();

        let avisos, candidatos;

        avisosRequest.onsuccess = () => {
            avisos = avisosRequest.result;
            if (candidatos !== undefined) resolve({ avisos, candidatos });
        };
        candidatosRequest.onsuccess = () => {
            candidatos = candidatosRequest.result;
            if (avisos !== undefined) resolve({ avisos, candidatos });
        };
    });
}

// --- Lógica principal ---
window.addEventListener('DOMContentLoaded', async () => {
    const { avisos, candidatos } = await obtenerTodosLosDatos();

    if (avisos.length === 0) {
        avisoListBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Aún no has creado ninguna búsqueda laboral.</td></tr>';
        return;
    }

    avisos.sort((a, b) => b.id - a.id);

    avisos.forEach(aviso => {
        const postulacionesCount = candidatos.filter(c => c.avisoId === aviso.id).length;
        
        // CORRECCIÓN: Usar snake_case para coincidir con la base de datos
        const validoHasta = new Date(aviso.valido_hasta).toLocaleDateString('es-AR');

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${aviso.id}</td>
            <td><strong>${aviso.titulo}</strong></td>
            <td>${postulacionesCount} / ${aviso.max_cv}</td>
            <td>${validoHasta}</td>
            <td>
                <div class="actions-group">
                    <a href="resumenes.html?avisoId=${aviso.id}">Ver Postulantes</a>
                    <a href="detalles-aviso.html?id=${aviso.id}">Detalles</a>
                </div>
            </td>
        `;
        avisoListBody.appendChild(row);
    });
});