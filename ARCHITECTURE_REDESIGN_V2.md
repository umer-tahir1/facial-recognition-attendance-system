# NUST Facial Recognition Attendance - Architecture Redesign (V2)

## 1) Executive Summary
This redesign replaces prototype KV logic with a normalized relational model suitable for university-scale deployment. The new design fixes core logical issues:

- Full CRUD expected for all core entities
- Many-to-many teacher-department assignments
- Many-to-many student-department/program enrollment
- Proper class/section model with term, room, slot, and session lifecycle
- Session-based attendance with duplicate protection and correction workflow
- Role-based controls and full auditability

## 2) Corrected Domain Model

### Core entities
- Profiles (admin/teacher/student)
- Departments
- Programs
- Teachers
- Students
- Courses
- Classes (course offerings/sections)
- Attendance Sessions
- Attendance Records
- Attendance Corrections
- Audit Logs

### Required relationships
- Teacher <-> Department: many-to-many via teacher_departments
- Student <-> Department: many-to-many via student_departments
- Student <-> Program: many-to-many via student_programs
- Student <-> Class: many-to-many via class_enrollments
- Teacher <-> Course: many-to-many via teacher_courses
- Course <-> Department: many-to-many via course_departments
- Course -> Class: one-to-many
- Class -> Attendance Session: one-to-many
- Attendance Session -> Attendance Record: one-to-many
- Attendance Record -> Corrections/Overrides: one-to-many

## 3) CRUD Contract (Admin + APIs)

### Departments
- Create: code, name, description
- Read: list, detail, department stats
- Update: metadata, active state
- Delete: soft-delete if linked records exist

### Teachers
- Create: profile + teacher record
- Read: list, detail, workload view
- Update: profile, designation, department memberships
- Delete: soft-delete, maintain historical attendance links

### Students
- Create: profile + student record + face profile bootstrap
- Read: list, detail, enrollment/attendance summary
- Update: profile, programs/departments, face profile version
- Delete: soft-delete + archive face artifacts

### Courses
- Create: course metadata + departments + teachers
- Read: list, detail, eligibility and term offerings
- Update: title, credit hours, mappings
- Delete: disable when historical classes exist

### Classes / Sections
- Create: course, section, term, teacher, room, slot
- Read: list by term/teacher/department
- Update: schedule, room, instructor roster, enrollment caps
- Delete: only if no attendance sessions, else cancel/archive

### Attendance sessions/records
- Create session: one per class + date
- Read session: roster + marked status
- Update records: manual mark, late mark, correction workflow
- Delete: forbidden in production; use cancellation + audit

## 4) Attendance Workflow (Production)

1. Teacher opens class session.
2. System materializes roster from active class_enrollments.
3. Face pipeline proposes matches with confidence score.
4. For each matched student:
   - Upsert attendance_record(session_id, student_id) with unique key.
   - Duplicate prevention guaranteed by DB unique constraint.
5. Late status:
   - Compare recognized_at to session starts_at + class grace period.
6. Teacher may perform manual mark/override with mandatory reason.
7. Any override is logged in attendance_override_logs + audit_logs.
8. Admin can approve/reject correction requests.

## 5) Facial Recognition Pipeline Improvements

### Registration
- Require multiple samples per student (lighting/angle variations).
- Track model version and embedding metadata.
- Reject low-quality captures using quality score thresholds.

### Detection and matching
- Liveness / anti-spoof check before recognition.
- Configurable confidence threshold per model version.
- Unknown faces stored in unknown_face_events for review.
- Automatic identity conflict checks for near-duplicate embeddings.

### Dataset lifecycle
- Face profile versioning per student.
- Sample-level metadata and quality scoring.
- Retraining policy with rollback to previous model version.

## 6) API Architecture (Recommended)

- Keep Hono edge functions but migrate from KV operations to SQL repositories.
- Add service layer:
  - validation
  - authorization
  - transactions
  - audit emission
- Add idempotency keys for attendance mark operations.
- Add pagination/filter/sort on all list endpoints.

## 7) RBAC and Security

- Admin:
  - full CRUD and correction approvals
- Teacher:
  - assigned class/session operations
  - manual marks with reason
- Student:
  - own attendance view and correction request submission

Security controls:
- Row-level security policy by role and assignment
- Immutable audit trail for critical mutations
- Soft-delete for core academic records
- PII and biometric retention policy enforcement

## 8) Analytics and Reporting

Minimum production dashboards:
- Attendance percentage by class, course, department, term
- At-risk students (below threshold)
- Daily/weekly absentee trend
- Teacher workload and marking anomalies
- Override and correction volume by actor

## 9) Missing Enterprise Features to Add

- Timetable conflict detection engine (teacher/student/room)
- Notification system (email/SMS/app) for absences
- Parent/guardian channel for undergraduate alerts
- Exam lock rules based on attendance threshold
- Data warehouse sync for long-term analytics
- Disaster recovery and offline capture fallback
- SSO integration (university identity provider)

## 10) Implementation Phases

### Phase 1 (Immediate)
- Apply university_schema_v2.sql
- Build SQL-backed repository layer for CRUD
- Replace KV endpoints for departments/teachers/courses/classes

### Phase 2
- Attendance session + correction/override workflow
- Audit log integration on all mutations
- Basic analytics views in admin panel

### Phase 3
- Enhanced face pipeline (liveness, conflict detection, model versioning)
- Bulk import jobs and validation
- Timetable conflict and capacity controls

## 11) Status of this redesign

- New schema specification is implemented in:
  - supabase/sql/university_schema_v2.sql
- This document defines the final target architecture and migration plan.
