-- University-grade schema redesign for NUST Facial Recognition Attendance
-- Apply in Supabase SQL editor after backing up prototype data.

create extension if not exists pgcrypto;

-- ===== Enums =====
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'teacher', 'student');
  end if;

  if not exists (select 1 from pg_type where typname = 'enrollment_status') then
    create type public.enrollment_status as enum ('active', 'dropped', 'completed', 'waitlisted');
  end if;

  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    create type public.attendance_status as enum ('present', 'late', 'absent', 'excused', 'manual_present', 'manual_absent');
  end if;

  if not exists (select 1 from pg_type where typname = 'mark_method') then
    create type public.mark_method as enum ('face_auto', 'teacher_manual', 'admin_override', 'system');
  end if;

  if not exists (select 1 from pg_type where typname = 'session_state') then
    create type public.session_state as enum ('scheduled', 'open', 'closed', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'program_role') then
    create type public.program_role as enum ('major', 'minor', 'double_major', 'joint');
  end if;
end $$;

-- ===== Generic updated_at trigger =====
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===== Identity / RBAC =====
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role public.user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- ===== Academic structure =====
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_departments_updated_at on public.departments;
create trigger trg_departments_updated_at before update on public.departments
for each row execute function public.set_updated_at();

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  level text not null check (level in ('undergraduate', 'graduate', 'postgraduate', 'phd')),
  primary_department_id uuid not null references public.departments(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_programs_updated_at on public.programs;
create trigger trg_programs_updated_at before update on public.programs
for each row execute function public.set_updated_at();

create table if not exists public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null,
  term_name text not null check (term_name in ('Fall', 'Spring', 'Summer')),
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  unique (academic_year, term_name)
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  building text not null,
  room_number text not null,
  capacity integer check (capacity > 0),
  unique (building, room_number)
);

create table if not exists public.time_slots (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  check (start_time < end_time)
);

-- ===== People =====
create table if not exists public.teachers (
  id uuid primary key references public.profiles(id) on delete cascade,
  employee_number text not null unique,
  designation text,
  joining_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_teachers_updated_at on public.teachers;
create trigger trg_teachers_updated_at before update on public.teachers
for each row execute function public.set_updated_at();

create table if not exists public.students (
  id uuid primary key references public.profiles(id) on delete cascade,
  cms_id text not null unique,
  registration_number text unique,
  batch text,
  admission_date date,
  status text not null default 'active' check (status in ('active', 'suspended', 'graduated', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_students_updated_at on public.students;
create trigger trg_students_updated_at before update on public.students
for each row execute function public.set_updated_at();

-- ===== Many-to-many mappings =====
create table if not exists public.teacher_departments (
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (teacher_id, department_id)
);

create table if not exists public.student_programs (
  student_id uuid not null references public.students(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  program_role public.program_role not null,
  start_term_id uuid references public.academic_terms(id) on delete set null,
  end_term_id uuid references public.academic_terms(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (student_id, program_id, program_role)
);

create table if not exists public.student_departments (
  student_id uuid not null references public.students(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, department_id)
);

-- ===== Courses / Classes =====
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  credit_hours numeric(3,1) not null check (credit_hours > 0),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_courses_updated_at on public.courses;
create trigger trg_courses_updated_at before update on public.courses
for each row execute function public.set_updated_at();

create table if not exists public.course_departments (
  course_id uuid not null references public.courses(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  is_home_department boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (course_id, department_id)
);

create table if not exists public.teacher_courses (
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  can_grade boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (teacher_id, course_id)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  section text not null,
  term_id uuid not null references public.academic_terms(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  primary_teacher_id uuid not null references public.teachers(id) on delete restrict,
  room_id uuid references public.rooms(id) on delete set null,
  time_slot_id uuid references public.time_slots(id) on delete set null,
  capacity integer check (capacity > 0),
  attendance_grace_minutes integer not null default 10 check (attendance_grace_minutes >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, section, term_id)
);

drop trigger if exists trg_classes_updated_at on public.classes;
create trigger trg_classes_updated_at before update on public.classes
for each row execute function public.set_updated_at();

create table if not exists public.class_teachers (
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  role text not null default 'instructor' check (role in ('instructor', 'co_instructor', 'ta')),
  created_at timestamptz not null default now(),
  primary key (class_id, teacher_id)
);

create table if not exists public.class_enrollments (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_status public.enrollment_status not null default 'active',
  enrolled_at timestamptz not null default now(),
  dropped_at timestamptz,
  primary key (class_id, student_id)
);

create index if not exists idx_class_enrollments_student on public.class_enrollments(student_id);

-- ===== Face data / anti-duplication =====
create table if not exists public.student_face_profiles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  profile_version integer not null default 1,
  embedding_model text not null,
  vector_dim integer not null check (vector_dim > 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id, profile_version)
);

create table if not exists public.face_samples (
  id uuid primary key default gen_random_uuid(),
  face_profile_id uuid not null references public.student_face_profiles(id) on delete cascade,
  image_path text not null,
  embedding jsonb not null,
  quality_score numeric(5,4),
  capture_conditions jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.face_identity_conflicts (
  id uuid primary key default gen_random_uuid(),
  candidate_student_id uuid references public.students(id) on delete set null,
  conflicting_student_id uuid references public.students(id) on delete set null,
  similarity_score numeric(5,4) not null,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'merged')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz
);

create table if not exists public.face_model_versions (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,
  model_version text not null,
  threshold numeric(5,4) not null,
  anti_spoofing_enabled boolean not null default true,
  is_active boolean not null default false,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (model_name, model_version)
);

-- ===== Attendance =====
create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  session_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  state public.session_state not null default 'open',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (class_id, session_date)
);

create index if not exists idx_attendance_sessions_class on public.attendance_sessions(class_id, session_date desc);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status public.attendance_status not null,
  recognition_confidence numeric(5,4),
  recognized_at timestamptz,
  is_late boolean not null default false,
  marked_by uuid references public.profiles(id) on delete set null,
  mark_method public.mark_method not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

drop trigger if exists trg_attendance_records_updated_at on public.attendance_records;
create trigger trg_attendance_records_updated_at before update on public.attendance_records
for each row execute function public.set_updated_at();

create index if not exists idx_attendance_records_student on public.attendance_records(student_id);

create table if not exists public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null references public.attendance_records(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_status public.attendance_status not null,
  reason text not null,
  evidence_url text,
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_override_logs (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null references public.attendance_records(id) on delete cascade,
  old_status public.attendance_status not null,
  new_status public.attendance_status not null,
  override_by uuid not null references public.profiles(id) on delete restrict,
  override_reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.unknown_face_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  image_path text,
  embedding jsonb,
  confidence numeric(5,4),
  suspected_spoof boolean not null default false,
  review_status text not null default 'open' check (review_status in ('open', 'reviewed', 'ignored')),
  created_at timestamptz not null default now()
);

-- ===== Bulk import =====
create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('students', 'teachers', 'courses', 'enrollments')),
  source_file text not null,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'completed', 'failed')),
  summary jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_import_jobs_updated_at on public.import_jobs;
create trigger trg_import_jobs_updated_at before update on public.import_jobs
for each row execute function public.set_updated_at();

create table if not exists public.import_job_rows (
  id bigint generated always as identity primary key,
  import_job_id uuid not null references public.import_jobs(id) on delete cascade,
  row_number integer not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  error_message text
);

-- ===== Auditing =====
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  old_values jsonb,
  new_values jsonb,
  request_id text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

-- ===== Derived views for analytics =====
create or replace view public.vw_department_stats as
select
  d.id as department_id,
  d.name as department_name,
  count(distinct td.teacher_id) as teacher_count,
  count(distinct sd.student_id) as student_count,
  count(distinct c.id) as class_count
from public.departments d
left join public.teacher_departments td on td.department_id = d.id
left join public.student_departments sd on sd.department_id = d.id
left join public.classes c on c.department_id = d.id
group by d.id, d.name;

create or replace view public.vw_teacher_workload as
select
  t.id as teacher_id,
  p.full_name,
  count(distinct ct.class_id) as active_class_count,
  count(distinct tc.course_id) as course_count
from public.teachers t
join public.profiles p on p.id = t.id
left join public.class_teachers ct on ct.teacher_id = t.id
left join public.teacher_courses tc on tc.teacher_id = t.id
group by t.id, p.full_name;

create or replace view public.vw_student_attendance_summary as
select
  ar.student_id,
  count(*) as total_sessions,
  count(*) filter (where ar.status in ('present', 'late', 'manual_present')) as attended_sessions,
  round(
    (count(*) filter (where ar.status in ('present', 'late', 'manual_present'))::numeric / nullif(count(*), 0)) * 100,
    2
  ) as attendance_percentage
from public.attendance_records ar
group by ar.student_id;

-- ===== Basic RLS enablement (policies to be completed per endpoint) =====
alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.programs enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.courses enable row level security;
alter table public.classes enable row level security;
alter table public.class_enrollments enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_corrections enable row level security;
alter table public.audit_logs enable row level security;

-- NOTE:
-- 1) Existing prototype endpoints (KV-based) should be replaced by SQL-backed endpoints.
-- 2) Define strict RLS policies by role (admin/teacher/student) before production.
-- 3) Migrate existing students/courses/attendance from KV to these relational tables.
