-- Adición de tablas propias: no modifica datos anteriores ni auth.users.
-- Una sola organización PCM; perfiles administrados exclusivamente desde backend/SQL.
begin;
create table if not exists public.pcm_perfiles (
  id uuid primary key references auth.users(id),
  nombre text not null check (length(trim(nombre)) > 0),
  rol text not null check (rol in ('Planificador', 'Taller', 'Administrador', 'Consulta')),
  activo boolean not null default true
);
create table if not exists public.pcm_modulo1 (
  id integer primary key check (id = 1),
  registro jsonb not null check (registro->>'esquema' = '13'),
  actualizado timestamptz not null default now()
);
alter table public.pcm_perfiles enable row level security;
alter table public.pcm_modulo1 enable row level security;
-- Sin políticas públicas: todo acceso de la aplicación pasa por la API autenticada.
revoke all on public.pcm_perfiles, public.pcm_modulo1 from anon, authenticated;
grant select on public.pcm_perfiles to service_role;
grant select, update, insert on public.pcm_modulo1 to service_role;

insert into public.pcm_modulo1 (id, registro) values (1, '{"esquema":13,"revision":0,"contador":0,"catalogos":{"remolcadores":[],"ubicaciones":[],"responsables":[{"id":"responsable-1","nombre":"TALLER MECÁNICO","activo":true,"externo":false},{"id":"responsable-2","nombre":"TALLER ELECTRICISTA","activo":true,"externo":false},{"id":"responsable-3","nombre":"TALLER SOLDADOR","activo":true,"externo":false},{"id":"responsable-4","nombre":"TALLER REFRIGERACIÓN","activo":true,"externo":false},{"id":"responsable-5","nombre":"TALLER ELECTRÓNICO","activo":true,"externo":false},{"id":"responsable-6","nombre":"TALLER ELECTROMECÁNICO","activo":true,"externo":false},{"id":"responsable-7","nombre":"TERCERIZADO","activo":true,"externo":true}]},"fuente":[],"importaciones":[],"planes":[],"historial":[],"solicitudes":{}}'::jsonb)
on conflict (id) do nothing;

-- Compare-and-swap: bloquea la fila y verifica versión dentro de la misma transacción.
-- TAG, contador, envío, instantáneas, recibo idempotente y auditoría se guardan juntos.
create or replace function public.pcm_guardar(nuevo jsonb, revision_esperada integer, solicitud text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare actual jsonb;
begin
  select registro into actual from public.pcm_modulo1 where id = 1 for update;
  if actual is null then raise exception 'Módulo sin inicializar'; end if;
  if actual->'solicitudes' ? solicitud then return actual; end if;
  if (actual->>'revision')::integer <> revision_esperada then
    raise exception using errcode = '40001', message = 'Conflicto de versión';
  end if;
  if nuevo->>'esquema' <> '13' or (nuevo->>'revision')::integer <> revision_esperada + 1
    or not (nuevo->'solicitudes' ? solicitud)
    or (nuevo->>'contador')::bigint < (actual->>'contador')::bigint then
    raise exception 'Registro inválido';
  end if;
  update public.pcm_modulo1 set registro = nuevo, actualizado = now() where id = 1;
  return nuevo;
end;
$$;
revoke all on function public.pcm_guardar(jsonb, integer, text) from public, anon, authenticated;
grant execute on function public.pcm_guardar(jsonb, integer, text) to service_role;
commit;
