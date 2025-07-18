// Se importa el cliente de Supabase para poder interactuar con la base de datos.
import { supabase } from './supabaseClient.js';

// Se obtiene la referencia al cuerpo de la tabla donde se mostrarán los avisos.
const avisoListBody = document.getElementById('aviso-list-body');

/**
 * Esta es la función principal que se ejecuta cuando el contenido de la página se ha cargado.
 * Se conecta a Supabase para obtener los datos y construir la tabla de avisos.
 */
window.addEventListener('DOMContentLoaded', async () => {
    // Muestra un mensaje de carga mientras se obtienen los datos.
    avisoListBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Cargando búsquedas laborales...</td></tr>';

    // 1. Obtiene todos los registros de la tabla 'avisos' en Supabase.
    //    Los ordena por fecha de creación para mostrar los más nuevos primero.
    const { data: avisos, error: errorAvisos } = await supabase
        .from('avisos')
        .select('*')
        .order('created_at', { ascending: false });

    // Si ocurre un error al obtener los avisos, lo muestra en la consola y en la tabla.
    if (errorAvisos) {
        console.error("Error al cargar los avisos:", errorAvisos);
        avisoListBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Error al cargar los avisos. Revisa la consola para más detalles.</td></tr>`;
        return;
    }
    
    // 2. Obtiene la columna 'aviso_id' de todos los candidatos.
    //    Esto es necesario para contar cuántas postulaciones tiene cada aviso.
    const { data: candidatos, error: errorCandidatos } = await supabase
        .from('candidatos')
        .select('aviso_id');
        
    // Si hay un error al obtener los candidatos, solo se muestra en la consola, pero la página sigue funcionando.
    if (errorCandidatos) {
        console.error("Error al cargar el conteo de candidatos:", errorCandidatos);
    }

    // Si no hay avisos en la base de datos, muestra un mensaje informativo.
    if (avisos.length === 0) {
        avisoListBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Aún no has creado ninguna búsqueda laboral.</td></tr>';
        return;
    }

    // Limpia la tabla (quita el mensaje de "Cargando...") antes de agregar las filas con los datos.
    avisoListBody.innerHTML = '';

    // 3. Recorre cada aviso obtenido para crear una fila en la tabla.
    avisos.forEach(aviso => {
        // Cuenta cuántos candidatos corresponden al ID del aviso actual.
        const postulacionesCount = candidatos ? candidatos.filter(c => c.aviso_id === aviso.id).length : 0;
        
        // Formatea la fecha para que se muestre en un formato legible (DD/MM/AAAA).
        // Se añade 'timeZone: UTC' para evitar problemas de desfasaje de un día.
        const validoHasta = new Date(aviso.valido_hasta).toLocaleDateString('es-AR', { timeZone: 'UTC' });

        // Crea un nuevo elemento <tr> (fila de tabla).
        const row = document.createElement('tr');
        
        // Define el contenido HTML de la fila con los datos del aviso.
        row.innerHTML = `
            <td>${aviso.id}</td>
            <td><strong>${aviso.titulo}</strong></td>
            <td>${postulacionesCount} / ${aviso.max_cv}</td>
            <td>${validoHasta}</td>
            <td>
                <div class="actions-group">
                    <a href="resumenes.html?avisoId=${aviso.id}" class="action-btn">Ver Postulantes</a>
                    <a href="detalles-aviso.html?id=${aviso.id}" class="action-btn">Detalles</a>
                </div>
            </td>
        `;
        
        // Añade la fila recién creada al cuerpo de la tabla.
        avisoListBody.appendChild(row);
    });
});