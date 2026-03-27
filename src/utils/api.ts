import { createClient } from './supabase/client';
import { supabaseAnonKey, supabaseFunctionsBaseUrl, supabaseUrl, validateSupabaseConfig } from './supabase/config';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

validateSupabaseConfig();

const API_BASE_URL = supabaseFunctionsBaseUrl;
const STUDENT_BUCKET = 'student-faces';
const LOCAL_COURSES_KEY = 'nust_local_courses';
const LOCAL_CREATED_TEACHERS_KEY = 'nust_created_teachers';
const TEACHER_DEPARTMENTS_KEY = 'nust_teacher_departments';

type UserRole = 'admin' | 'teacher';

async function getAccessToken(forceRefresh = false) {
  const supabase = createClient();
  let token = '';

  // On forced retries, refresh first so we don't reuse a stale access token.
  if (forceRefresh) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError && !String(refreshError.message || '').toLowerCase().includes('refresh token not found')) {
      throw new Error('Unable to refresh session. Please sign in again.');
    }
    token = refreshed.session?.access_token || '';
  }

  // Prefer current session token to avoid unnecessary refresh churn.
  if (!token) {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error('Unable to validate session. Please sign in again.');
    }
    token = data.session?.access_token || '';
  }

  // Refresh only when no active token is available.
  if (!token) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError && !String(refreshError.message || '').toLowerCase().includes('refresh token not found')) {
      throw new Error('Unable to refresh session. Please sign in again.');
    }
    token = refreshed.session?.access_token || '';
  }

  if (!token) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  // Keep storage in sync for legacy call sites that still read this key.
  sessionStorage.setItem('access_token', token);
  return token;
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function formatSupabaseError(error: any, fallback = 'Request failed') {
  if (!error) return fallback;
  const code = error.code ? ` [${error.code}]` : '';
  const hint = error.hint ? ` ${error.hint}` : '';
  const details = error.details ? ` ${error.details}` : '';
  return `${error.message || fallback}${code}${hint}${details}`.trim();
}

function normalizeStudent(student: any) {
  return {
    id: student.id,
    studentId: student.cms_id,
    cmsId: student.cms_id,
    name: student.name,
    email: student.email,
    department: student.department,
    batch: student.batch,
    imageUrl: student.image_url,
    faceDescriptor: student.face_descriptor,
    createdAt: student.created_at,
    createdBy: student.created_by
  };
}

function readLocalCourses() {
  try {
    const raw = localStorage.getItem(LOCAL_COURSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalCourses(courses: any[]) {
  localStorage.setItem(LOCAL_COURSES_KEY, JSON.stringify(courses));
}

function readCreatedTeachers() {
  try {
    const raw = localStorage.getItem(LOCAL_CREATED_TEACHERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((teacher) => teacher && teacher.email && teacher.name);
  } catch {
    return [];
  }
}

function writeCreatedTeachers(teachers: any[]) {
  localStorage.setItem(LOCAL_CREATED_TEACHERS_KEY, JSON.stringify(teachers));
}

function readTeacherDepartmentEmails() {
  try {
    const raw = localStorage.getItem(TEACHER_DEPARTMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return [];
    return Object.keys(parsed)
      .map((email) => String(email || '').toLowerCase().trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function cacheCreatedTeacher(payload: { name: string; email: string }, userId?: string | null) {
  const email = payload.email.trim().toLowerCase();
  if (!email) return;

  const cached = readCreatedTeachers();
  const next = [
    {
      id: userId || `local-${email}`,
      email,
      name: payload.name.trim() || email,
      role: 'teacher',
      createdAt: new Date().toISOString()
    },
    ...cached.filter((teacher: any) => String(teacher?.email || '').toLowerCase() !== email)
  ];
  writeCreatedTeachers(next);
}

function mergeTeachers(primaryTeachers: any[]) {
  const byEmail = new Map<string, any>();

  for (const email of readTeacherDepartmentEmails()) {
    byEmail.set(email, {
      id: `local-${email}`,
      email,
      name: email.split('@')[0] || email,
      role: 'teacher'
    });
  }

  for (const teacher of readCreatedTeachers()) {
    const email = String(teacher?.email || '').toLowerCase();
    if (!email) continue;
    byEmail.set(email, {
      id: teacher.id || `local-${email}`,
      email,
      name: teacher.name || email,
      role: 'teacher'
    });
  }

  for (const teacher of primaryTeachers || []) {
    const email = String(teacher?.email || '').toLowerCase();
    if (!email) continue;
    byEmail.set(email, {
      ...byEmail.get(email),
      ...teacher,
      email,
      name: teacher?.name || teacher?.full_name || byEmail.get(email)?.name || email,
      role: teacher?.role || 'teacher'
    });
  }

  return Array.from(byEmail.values());
}


function dataUrlToBlob(dataUrl: string) {
  const parts = dataUrl.split(',');
  if (parts.length !== 2) {
    throw new Error('Captured image format is invalid. Please retake the photo.');
  }

  const header = parts[0];
  const base64 = parts[1];
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] || 'image/jpeg';

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
}

async function requestJson(path: string, init: RequestInit = {}) {
  try {
    const resolveHeaders = (requestInit: RequestInit, tokenOverride?: string) => {
      const incomingHeaders = (requestInit.headers as Record<string, string>) || {};
      return {
        apikey: supabaseAnonKey,
        ...incomingHeaders,
        ...(tokenOverride ? { Authorization: `Bearer ${tokenOverride}` } : {})
      };
    };

    const execute = async (requestInit: RequestInit) => {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...requestInit,
        headers: resolveHeaders(requestInit)
      });
      const data = await safeJson(response);
      return { response, data };
    };

    let { response, data } = await execute(init);

    if (response.status === 401) {
      // Retry once with a newly refreshed token to recover from stale Authorization headers.
      const freshToken = await getAccessToken(true);
      ({ response, data } = await execute({
        ...init,
        headers: resolveHeaders(init, freshToken)
      }));
    }

    if (!response.ok) {
      const backendMessage =
        (typeof data.error === 'string' && data.error)
        || (typeof data.message === 'string' && data.message)
        || '';

      const message = backendMessage
        || (response.status === 401
          ? 'Unauthorized. Please sign out and sign in again.'
          : `Request failed (${response.status})`);
      throw new Error(message);
    }

    return data;
  } catch (error: any) {
    if (error instanceof TypeError) {
      throw new Error('Unable to reach the server. Verify Supabase URL, deployed function, and internet connection.');
    }
    throw error;
  }
}

async function ensureAuthenticatedSession() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(formatSupabaseError(error, 'Unable to validate login session.'));
  }

  if (!data.session?.user) {
    throw new Error('No active session. Please sign in again.');
  }

  return data.session;
}

// Student API (Supabase table + storage)
export const studentApi = {
  async create(studentData: any) {
    const session = await ensureAuthenticatedSession();
    const supabase = createClient();
    const db = supabase as any;

    if (!studentData?.studentId || !studentData?.name) {
      throw new Error('Student ID and name are required.');
    }

    if (!studentData?.capturedImage) {
      throw new Error('Captured image is required. Please capture a photo before registering.');
    }

    if (!studentData?.faceDescriptor || !Array.isArray(studentData.faceDescriptor)) {
      throw new Error('Face descriptor is missing. Please capture photo again.');
    }

    let imageUrl = '';

    try {
      const imageBlob = dataUrlToBlob(studentData.capturedImage);
      const extension = imageBlob.type.includes('png') ? 'png' : 'jpg';
      const filePath = `${studentData.studentId}/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(STUDENT_BUCKET)
        .upload(filePath, imageBlob, {
          contentType: imageBlob.type,
          upsert: true
        });

      if (uploadError) {
        throw new Error(formatSupabaseError(uploadError, 'Image upload failed.'));
      }

      const { data: publicData } = supabase.storage.from(STUDENT_BUCKET).getPublicUrl(filePath);
      imageUrl = publicData.publicUrl;

      const payload = {
        cms_id: studentData.studentId,
        name: studentData.name,
        email: studentData.email || null,
        department: studentData.department || null,
        batch: studentData.batch || null,
        image_url: imageUrl,
        face_descriptor: studentData.faceDescriptor,
        created_by: session.user.id
      };

      const { data: inserted, error: insertError } = await db
        .from('students')
        .upsert(payload, { onConflict: 'cms_id' })
        .select('*')
        .single();

      if (insertError) {
        throw new Error(formatSupabaseError(insertError, 'Failed to save student record.'));
      }

      return {
        message: 'Student record saved successfully',
        student: normalizeStudent(inserted)
      };
    } catch (error: any) {
      console.error('studentApi.create error:', error);
      throw new Error(error?.message || 'Student registration failed.');
    }
  },

  async getAll() {
    await ensureAuthenticatedSession();
    const supabase = createClient();
    const db = supabase as any;

    const { data, error } = await db
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('studentApi.getAll error:', error);
      throw new Error(formatSupabaseError(error, 'Failed to fetch students.'));
    }

    return (data || []).map(normalizeStudent);
  },

  async getById(studentId: string) {
    await ensureAuthenticatedSession();
    const supabase = createClient();
    const db = supabase as any;

    const { data, error } = await db
      .from('students')
      .select('*')
      .eq('cms_id', studentId)
      .single();

    if (error) {
      console.error('studentApi.getById error:', error);
      throw new Error(formatSupabaseError(error, 'Failed to fetch student.'));
    }

    return normalizeStudent(data);
  },

  async update(studentId: string, updates: any) {
    await ensureAuthenticatedSession();
    const supabase = createClient();
    const db = supabase as any;

    const payload: Record<string, any> = {};
    if (typeof updates?.name === 'string') payload.name = updates.name;
    if (typeof updates?.email === 'string' || updates?.email === null) payload.email = updates.email;
    if (typeof updates?.department === 'string' || updates?.department === null) payload.department = updates.department;
    if (typeof updates?.batch === 'string' || updates?.batch === null) payload.batch = updates.batch;
    if (Array.isArray(updates?.faceDescriptor)) payload.face_descriptor = updates.faceDescriptor;

    const { data, error } = await db
      .from('students')
      .update(payload)
      .eq('cms_id', studentId)
      .select('*')
      .single();

    if (error) {
      console.error('studentApi.update error:', error);
      throw new Error(formatSupabaseError(error, 'Failed to update student.'));
    }

    return {
      message: 'Student updated successfully',
      student: normalizeStudent(data)
    };
  },

  async delete(studentId: string) {
    await ensureAuthenticatedSession();
    const supabase = createClient();
    const db = supabase as any;

    const { data: existing, error: fetchError } = await db
      .from('students')
      .select('image_url')
      .eq('cms_id', studentId)
      .single();

    if (fetchError) {
      console.error('studentApi.delete lookup error:', fetchError);
      throw new Error(formatSupabaseError(fetchError, 'Failed to locate student before delete.'));
    }

    const { error: deleteError } = await db
      .from('students')
      .delete()
      .eq('cms_id', studentId);

    if (deleteError) {
      console.error('studentApi.delete error:', deleteError);
      throw new Error(formatSupabaseError(deleteError, 'Failed to delete student.'));
    }

    if (existing?.image_url && existing.image_url.includes(`/storage/v1/object/public/${STUDENT_BUCKET}/`)) {
      const prefix = `/storage/v1/object/public/${STUDENT_BUCKET}/`;
      const objectPath = existing.image_url.split(prefix)[1];
      if (objectPath) {
        const { error: storageDeleteError } = await supabase.storage
          .from(STUDENT_BUCKET)
          .remove([objectPath]);
        if (storageDeleteError) {
          console.error('studentApi.delete storage cleanup error:', storageDeleteError);
        }
      }
    }

    return { message: 'Student deleted successfully' };
  }
};

// Course API
export const courseApi = {
  async create(courseData: any) {
    const accessToken = await getAccessToken();
    return requestJson('/courses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(courseData)
    });
  },

  async getAll() {
    const accessToken = await getAccessToken();
    const data = await requestJson('/courses', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return data.courses ?? [];
  },

  async enrollStudent(courseCode: string, studentId: string) {
    const accessToken = await getAccessToken();
    return requestJson(`/courses/${courseCode}/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ studentId })
    });
  }
};

// Attendance API
export const attendanceApi = {
  async mark(attendanceData: any) {
    const accessToken = await getAccessToken();
    return requestJson('/attendance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(attendanceData)
    });
  },

  async getByCourse(courseCode: string) {
    const accessToken = await getAccessToken();
    const data = await requestJson(`/attendance/${courseCode}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return data.records ?? [];
  },

  async getStudentAttendance(courseCode: string, studentId: string) {
    const accessToken = await getAccessToken();
    return requestJson(`/attendance/${courseCode}/student/${studentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  }
};

// User API
export const userApi = {
  async getProfile() {
    const accessToken = await getAccessToken();
    const data = await requestJson('/profile', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return data.profile;
  },

  async getTeachers() {
    try {
      const accessToken = await getAccessToken();
      const data = await requestJson('/teachers', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      return mergeTeachers(data.teachers ?? []);
    } catch {
      try {
        await ensureAuthenticatedSession();
        const supabase = createClient();
        const db = supabase as any;
        const { data, error } = await db
          .from('profiles')
          .select('id, email, full_name, role')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('userApi.getTeachers fallback error:', error);
          return mergeTeachers([]);
        }

        const seededEmails = new Set([
          ...readCreatedTeachers().map((teacher: any) => String(teacher?.email || '').toLowerCase()),
          ...readTeacherDepartmentEmails()
        ]);

        return mergeTeachers((data || [])
          .filter((profile: any) => {
            const role = String(profile?.role || '').toLowerCase();
            const email = String(profile?.email || '').toLowerCase();
            return role === 'teacher' || seededEmails.has(email);
          })
          .map((profile: any) => ({
            id: profile.id,
            email: profile.email,
            name: profile.full_name || profile.email,
            role: (String(profile.role || '').toLowerCase() === 'admin' ? 'teacher' : (profile.role || 'teacher'))
          })));
      } catch {
        return mergeTeachers([]);
      }
    }
  },

  async createUser(payload: { name: string; email: string; password: string; role: UserRole }) {
    try {
      const accessToken = await getAccessToken();
      const data = await requestJson('/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      });
      cacheCreatedTeacher(payload, data?.user?.id || data?.id || null);
      return data;
    } catch (edgeError: any) {
      // Fallback path when edge function is unavailable: create user via Supabase Auth signup.
      // Use a non-persistent auth client so admin's current session is not replaced.
      const signupClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      const { data, error } = await signupClient.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: {
            full_name: payload.name,
            name: payload.name,
            role: payload.role
          }
        }
      });

      if (error) {
        if (String(error?.code || '').toLowerCase() === 'over_email_send_rate_limit') {
          throw new Error('Teacher was not created because Supabase email rate limit was hit. Use a different email for testing or wait for the rate limit window to reset.');
        }
        const fallbackMessage = formatSupabaseError(error, 'Failed to create teacher account.');
        throw new Error(edgeError?.message ? `${edgeError.message} | ${fallbackMessage}` : fallbackMessage);
      }

      cacheCreatedTeacher(payload, data?.user?.id || null);

      return {
        message: data?.session
          ? 'Teacher created successfully'
          : 'Teacher created (pending email confirmation if enabled)',
        user: data?.user || null,
        requiresEmailConfirmation: !data?.session,
        createdVia: 'supabase-auth-signup'
      };
    }
  }
};
