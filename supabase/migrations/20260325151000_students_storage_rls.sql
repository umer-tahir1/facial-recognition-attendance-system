create extension if not exists pgcrypto;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  cms_id text not null unique,
  name text not null,
  email text,
  department text,
  batch text,
  image_url text not null,
  face_descriptor jsonb not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_students_cms_id on public.students(cms_id);
create index if not exists idx_students_created_by on public.students(created_by);

create or replace function public.update_students_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_students_updated_at on public.students;
create trigger trg_students_updated_at
before update on public.students
for each row execute function public.update_students_updated_at();

alter table public.students enable row level security;

drop policy if exists "students_select_authenticated" on public.students;
create policy "students_select_authenticated"
on public.students
for select
to authenticated
using (true);

drop policy if exists "students_insert_admin_teacher" on public.students;
create policy "students_insert_admin_teacher"
on public.students
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher')
  )
);

drop policy if exists "students_update_admin_teacher" on public.students;
create policy "students_update_admin_teacher"
on public.students
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher')
  )
);

drop policy if exists "students_delete_admin_only" on public.students;
create policy "students_delete_admin_only"
on public.students
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

insert into storage.buckets (id, name, public)
values ('student-faces', 'student-faces', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "student_faces_public_read" on storage.objects;
create policy "student_faces_public_read"
on storage.objects
for select
to public
using (bucket_id = 'student-faces');

drop policy if exists "student_faces_upload_admin_teacher" on storage.objects;
create policy "student_faces_upload_admin_teacher"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'student-faces'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher')
  )
);

drop policy if exists "student_faces_update_admin_teacher" on storage.objects;
create policy "student_faces_update_admin_teacher"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'student-faces'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher')
  )
)
with check (
  bucket_id = 'student-faces'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'teacher')
  )
);

drop policy if exists "student_faces_delete_admin_only" on storage.objects;
create policy "student_faces_delete_admin_only"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'student-faces'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
