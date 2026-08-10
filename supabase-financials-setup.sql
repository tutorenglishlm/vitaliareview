-- Finanzas: add a price per project. Revenue is booked when status = 'Entregado'.
-- Safe to run multiple times.
alter table public.projects add column if not exists price numeric(12,2) default 0;

-- (optional) index to speed up the delivered-revenue view
create index if not exists projects_status_idx on public.projects (status);
