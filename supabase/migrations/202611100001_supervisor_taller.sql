-- Amplía el catálogo de roles; no asigna privilegios a ninguna cuenta existente.
begin;
alter table public.pcm_perfiles drop constraint pcm_perfiles_rol_check;
alter table public.pcm_perfiles add constraint pcm_perfiles_rol_check
  check (rol in ('Planificador', 'Taller', 'Supervisor Taller', 'Administrador', 'Consulta'));
commit;
