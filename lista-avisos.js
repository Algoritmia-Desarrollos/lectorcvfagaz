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
        avisoListBody.innerHTML = '<p class="empty-state">Aún no has creado ninguna búsqueda laboral.</p>';
        return;
    }

    // Ordenar avisos del más reciente al más antiguo
    avisos.sort((a, b) => b.id - a.id);

    avisos.forEach(aviso => {
        const postulacionesCount = candidatos.filter(c => c.avisoId === aviso.id).length;
        const fecha = new Date(aviso.id).toLocaleDateString('es-AR');

        const row = document.createElement('div');
        row.className = 'aviso-list-row';
        row.innerHTML = `
            <div>${aviso.id}</div>
            <div>${fecha}</div>
            <div>${aviso.titulo}</div>
            <div class="postulaciones-count">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M16 11.333a4.667 4.667 0 1 0-9.333 0A4.667 4.667 0 0 0 16 11.333ZM12.5 17.5a7.5 7.5 0 0 0 7.5-7.5c0-2.488-1.213-4.71-3.218-6.104a.75.75 0 0 0-.964 1.208A4.49 4.49 0 0 1 18.5 10a5.999 5.999 0 0 1-5.011 5.917A5.968 5.968 0 0 1 12 16a6 6 0 0 1-6-6c0-2.488 1.5-4.625 3.718-5.596a.75.75 0 0 0-.536-1.392A7.5 7.5 0 0 0 2.5 10a7.5 7.5 0 0 0 7.5 7.5h2.5Z"></path></svg>
                ${postulacionesCount}
            </div>
            <div><a href="detalles-aviso.html?id=${aviso.id}" class="ver-detalles">Ver</a></div>
        `;
        avisoListBody.appendChild(row);
    });
});