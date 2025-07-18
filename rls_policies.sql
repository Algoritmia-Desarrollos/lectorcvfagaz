-- =================================================================
-- PASO 1: HABILITAR RLS (ROW LEVEL SECURITY)
-- Esto activa la protección en las tablas. Nadie podrá acceder
-- a ellas hasta que creemos las políticas específicas.
-- =================================================================
ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidatos ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- PASO 2: POLÍTICAS PARA LA TABLA "AVISOS"
-- Queremos que cualquiera pueda ver los avisos de trabajo.
-- =================================================================

-- Primero, borramos cualquier política de SELECT existente para evitar conflictos.
DROP POLICY IF EXISTS "Permitir lectura pública de avisos" ON public.avisos;

-- Creamos la política para permitir que CUALQUIERA (rol "anon") lea los avisos.
CREATE POLICY "Permitir lectura pública de avisos"
ON public.avisos
FOR SELECT
TO anon -- El rol "anon" es el que usa tu frontend con la ANON_KEY
USING (true); -- La condición "true" significa que se aplica a todas las filas.


-- =================================================================
-- PASO 3: POLÍTICAS PARA LA TABLA "CANDIDATOS"
-- Esta es la tabla con datos sensibles.
-- =================================================================

-- Primero, borramos cualquier política de INSERT existente para evitar conflictos.
DROP POLICY IF EXISTS "Permitir inserción pública de candidatos" ON public.candidatos;

-- Creamos la política para permitir que CUALQUIERA (rol "anon") inserte un nuevo candidato.
-- Esto es lo que permite que el formulario de postulación funcione.
CREATE POLICY "Permitir inserción pública de candidatos"
ON public.candidatos
FOR INSERT
TO anon -- Se aplica al rol público
WITH CHECK (true); -- Permite la inserción sin restricciones de datos.

-- IMPORTANTE:
-- No creamos una política de SELECT, UPDATE o DELETE para la tabla "candidatos".
-- Al no existir, RLS deniega por defecto estas acciones al rol "anon".
-- Esto significa que un usuario público NO PODRÁ ver, modificar o borrar
-- las postulaciones de otros candidatos, que es exactamente lo que queremos.
-- Solo tú, desde el panel de Supabase o con la clave de servicio, podrás ver los datos.
