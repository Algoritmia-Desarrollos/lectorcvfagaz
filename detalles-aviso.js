// --- SELECTORES ---
const avisoTitulo = document.getElementById('aviso-titulo');
const avisoIdSpan = document.getElementById('aviso-id');
const avisoMaxCv = document.getElementById('aviso-max-cv');
const avisoValidoHasta = document.getElementById('aviso-valido-hasta');
const avisoDescripcion = document.getElementById('aviso-descripcion');
const necesariasList = document.getElementById('necesarias-list');
const deseablesList = document.getElementById('deseables-list');
const linkPostulanteInput = document.getElementById('link-postulante');
const copiarLinkBtn = document.getElementById('copiar-link-btn');
const qrCanvas = document.getElementById('qr-canvas');
const compartirBtn = document.getElementById('compartir-btn');

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

async function getAvisoById(id) {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['avisos'], 'readonly');
        const store = transaction.objectStore('avisos');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = e => reject(e.target.error);
    });
}

// --- Lógica Principal ---
window.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = parseInt(urlParams.get('id'), 10);

    if (!id) {
        avisoTitulo.textContent = 'Aviso no encontrado';
        return;
    }

    const aviso = await getAvisoById(id);

    if (aviso) {
        avisoTitulo.textContent = aviso.titulo;
        avisoIdSpan.textContent = aviso.id;
        avisoMaxCv.textContent = aviso.maxCV;
        avisoValidoHasta.textContent = new Date(aviso.validoHasta).toLocaleDateString('es-AR');
        avisoDescripcion.textContent = aviso.descripcion;

        necesariasList.innerHTML = aviso.condicionesNecesarias.map(c => `<li>${c}</li>`).join('');
        deseablesList.innerHTML = aviso.condicionesDeseables.map(c => `<li>${c}</li>`).join('');

        const link = `${window.location.origin}/index.html?avisoId=${aviso.id}`;
        linkPostulanteInput.value = link;

        new QRious({
            element: qrCanvas,
            value: link,
            size: 150,
            background: 'white',
            foreground: '#1e293b'
        });
    } else {
        avisoTitulo.textContent = 'Aviso no encontrado';
    }
});

copiarLinkBtn.addEventListener('click', () => {
    linkPostulanteInput.select();
    document.execCommand('copy');
    copiarLinkBtn.textContent = '¡Copiado!';
    setTimeout(() => { copiarLinkBtn.textContent = 'Copiar'; }, 2000);
});

compartirBtn.addEventListener('click', async () => {
    const shareData = {
        title: `Postulate para: ${avisoTitulo.textContent}`,
        text: 'Encontramos esta búsqueda laboral que podría interesarte.',
        url: linkPostulanteInput.value
    };
    try {
        await navigator.share(shareData);
    } catch (err) {
        console.error("Error al compartir:", err);
    }
});