// @ts-nocheck
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.ts";
import { createClient } from "npm:@supabase/supabase-js";

const app = new Hono().basePath('/server');

app.use('*', logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const getSupabaseAdmin = () =>
  createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || ''
  );

const getSupabaseAuthClient = (requestApiKey?: string | null) =>
  createClient(
    Deno.env.get('SUPABASE_URL') || '',
    requestApiKey || Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

const normalizeRole = (role: any) => {
  const normalized = String(role || '').toLowerCase();
  return normalized === 'admin' || normalized === 'teacher' ? normalized : null;
};

const getProfileById = async (userId: string) => {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.log('Error fetching profile by id:', error);
    return null;
  }

  return data || null;
};

const upsertProfile = async (payload: { id: string; email: string; full_name: string; role: 'admin' | 'teacher' }) => {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    console.log('Error upserting profile:', error);
    return false;
  }

  return true;
};

const hasAnyAdminProfile = async () => {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin');

  if (error) {
    console.log('Error checking admin profile count:', error);
    return true;
  }

  return (count || 0) > 0;
};

const requireAuth = async (c: any, next: any) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  const requestApiKey = c.req.header('apikey') || null;
  if (!accessToken) {
    return c.json({ error: 'Unauthorized: Missing access token' }, 401);
  }

  const supabase = getSupabaseAuthClient(requestApiKey);
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return c.json({ error: `Unauthorized: ${error?.message || 'Invalid token'}` }, 401);
  }

  c.set('userId', user.id);
  c.set('userEmail', user.email);
  c.set('authUser', user);
  await next();
};

const tryAuth = async (c: any, next: any) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const requestApiKey = c.req.header('apikey') || null;

    if (!accessToken) {
      await next();
      return;
    }

    const supabase = getSupabaseAuthClient(requestApiKey);
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!error && user) {
      c.set('userId', user.id);
      c.set('userEmail', user.email);
      c.set('authUser', user);
    }
  } catch {
    // Ignore auth parsing/validation errors for optional-auth routes.
  }

  await next();
};

const requireAdmin = async (c: any, next: any) => {
  const authUser = c.get('authUser');
  const profile = await getProfileById(c.get('userId'));
  const roleFromProfile = normalizeRole(profile?.role);
  const roleFromMetadata = normalizeRole(authUser?.user_metadata?.role) || normalizeRole(authUser?.app_metadata?.role);

  let bootstrapAdmin = false;
  if (!profile && !roleFromMetadata) {
    const adminExists = await hasAnyAdminProfile();
    bootstrapAdmin = !adminExists;
  }

  if (roleFromProfile !== 'admin' && roleFromMetadata !== 'admin' && !bootstrapAdmin) {
    return c.json({ error: 'Forbidden: admin access required' }, 403);
  }

  if (!profile) {
    const roleToPersist: 'admin' | 'teacher' = roleFromMetadata === 'admin' || bootstrapAdmin ? 'admin' : 'teacher';
    await upsertProfile({
      id: c.get('userId'),
      email: c.get('userEmail') || '',
      full_name: authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || c.get('userEmail') || 'Admin',
      role: roleToPersist
    });
  }

  c.set('profile', profile || { id: c.get('userId'), email: c.get('userEmail'), role: 'admin' });
  await next();
};

app.get("/health", (c) => c.json({ status: "ok" }));
app.post("/auth/signup", async (c) => c.json({ error: 'Public signup is disabled. Contact an administrator.' }, 403));

app.post("/students", requireAuth, async (c) => {
  try {
    const { studentId, name, email, department, batch, faceDescriptor } = await c.req.json();
    if (!studentId || !name || !faceDescriptor) return c.json({ error: 'Missing required fields: studentId, name, faceDescriptor' }, 400);

    const student = { studentId, name, email, department, batch, faceDescriptor, createdAt: new Date().toISOString(), createdBy: c.get('userId') };
    await kv.set(`student:${studentId}`, student);
    return c.json({ message: 'Student registered successfully', student });
  } catch {
    return c.json({ error: 'Failed to register student' }, 500);
  }
});

app.get("/students", requireAuth, async (c) => {
  try {
    const students = await kv.getByPrefix('student:');
    return c.json({ students });
  } catch {
    return c.json({ error: 'Failed to fetch students' }, 500);
  }
});

app.get("/students/:id", requireAuth, async (c) => {
  try {
    const studentId = c.req.param('id');
    const student = await kv.get(`student:${studentId}`);
    if (!student) return c.json({ error: 'Student not found' }, 404);
    return c.json({ student });
  } catch {
    return c.json({ error: 'Failed to fetch student' }, 500);
  }
});

app.put("/students/:id", requireAuth, async (c) => {
  try {
    const studentId = c.req.param('id');
    const updates = await c.req.json();
    const existingStudent = await kv.get(`student:${studentId}`);
    if (!existingStudent) return c.json({ error: 'Student not found' }, 404);

    const updatedStudent = { ...existingStudent, ...updates, updatedAt: new Date().toISOString(), updatedBy: c.get('userId') };
    await kv.set(`student:${studentId}`, updatedStudent);
    return c.json({ message: 'Student updated successfully', student: updatedStudent });
  } catch {
    return c.json({ error: 'Failed to update student' }, 500);
  }
});

app.delete("/students/:id", requireAuth, async (c) => {
  try {
    const studentId = c.req.param('id');
    await kv.del(`student:${studentId}`);
    return c.json({ message: 'Student deleted successfully' });
  } catch {
    return c.json({ error: 'Failed to delete student' }, 500);
  }
});

app.post("/courses", tryAuth, async (c) => {
  try {
    const { courseCode, courseName, teacherId, teacherEmail, teacherName, department, semester } = await c.req.json();
    if (!courseCode || !courseName || !teacherId) return c.json({ error: 'Missing required fields: courseCode, courseName, teacherId' }, 400);

    const course = {
      courseCode,
      courseName,
      teacherId,
      teacherEmail: teacherEmail || null,
      teacherName: teacherName || null,
      department,
      semester,
      enrolledStudents: [],
      createdAt: new Date().toISOString(),
      createdBy: c.get('userId') || 'anonymous'
    };
    await kv.set(`course:${courseCode}`, course);
    return c.json({ message: 'Course created successfully', course });
  } catch {
    return c.json({ error: 'Failed to create course' }, 500);
  }
});

app.get("/courses", tryAuth, async (c) => {
  try {
    const courses = await kv.getByPrefix('course:');
    return c.json({ courses });
  } catch {
    return c.json({ error: 'Failed to fetch courses' }, 500);
  }
});

app.post("/courses/:courseCode/enroll", tryAuth, async (c) => {
  try {
    const courseCode = c.req.param('courseCode');
    const { studentId } = await c.req.json();
    if (!studentId) return c.json({ error: 'Missing studentId' }, 400);

    const course = await kv.get(`course:${courseCode}`);
    if (!course) return c.json({ error: 'Course not found' }, 404);

    if (!course.enrolledStudents.includes(studentId)) {
      course.enrolledStudents.push(studentId);
      await kv.set(`course:${courseCode}`, course);
    }
    return c.json({ message: 'Student enrolled successfully', course });
  } catch {
    return c.json({ error: 'Failed to enroll student' }, 500);
  }
});

app.post("/attendance", tryAuth, async (c) => {
  try {
    const { courseCode, date, recognizedStudents, totalStudents } = await c.req.json();
    if (!courseCode || !date || !recognizedStudents) return c.json({ error: 'Missing required fields: courseCode, date, recognizedStudents' }, 400);

    const attendanceId = `attendance:${courseCode}:${date}`;
    const attendance = { courseCode, date, recognizedStudents, totalStudents, markedBy: c.get('userId') || 'anonymous', markedAt: new Date().toISOString() };
    await kv.set(attendanceId, attendance);
    return c.json({ message: 'Attendance marked successfully', attendance });
  } catch {
    return c.json({ error: 'Failed to mark attendance' }, 500);
  }
});

app.get("/attendance/:courseCode", tryAuth, async (c) => {
  try {
    const courseCode = c.req.param('courseCode');
    const records = await kv.getByPrefix(`attendance:${courseCode}:`);
    return c.json({ records });
  } catch {
    return c.json({ error: 'Failed to fetch attendance records' }, 500);
  }
});

app.get("/attendance/:courseCode/student/:studentId", tryAuth, async (c) => {
  try {
    const courseCode = c.req.param('courseCode');
    const studentId = c.req.param('studentId');
    const allRecords = await kv.getByPrefix(`attendance:${courseCode}:`);

    const studentAttendance = allRecords.filter((record: any) => record.recognizedStudents.some((s: any) => s.studentId === studentId));
    const totalClasses = allRecords.length;
    const attendedClasses = studentAttendance.length;
    const percentage = totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0;

    return c.json({ studentId, courseCode, totalClasses, attendedClasses, percentage: percentage.toFixed(2), records: studentAttendance });
  } catch {
    return c.json({ error: 'Failed to fetch student attendance' }, 500);
  }
});

app.post("/users", requireAuth, requireAdmin, async (c) => {
  try {
    const { email, password, name, role } = await c.req.json();
    if (!email || !password || !name || !role) return c.json({ error: 'Missing required fields: email, password, name, role' }, 400);
    if (!['admin', 'teacher'].includes(role)) return c.json({ error: 'Invalid role. Must be admin or teacher' }, 400);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, full_name: name, role }
    });
    if (error) return c.json({ error: `Failed to create user: ${error.message}` }, 400);

    await upsertProfile({
      id: data.user.id,
      email,
      full_name: name,
      role
    });

    const user = { id: data.user.id, email, name, role, createdAt: new Date().toISOString(), createdBy: c.get('userId') };
    return c.json({ message: 'User created successfully', user });
  } catch {
    return c.json({ error: 'Failed to create user account' }, 500);
  }
});

app.get("/profile", requireAuth, async (c) => {
  try {
    const authUser = c.get('authUser');
    const userId = c.get('userId');
    let profile = await getProfileById(userId);

    if (!profile) {
      const adminExists = await hasAnyAdminProfile();
      const role = normalizeRole(authUser?.user_metadata?.role)
        || normalizeRole(authUser?.app_metadata?.role)
        || (adminExists ? 'teacher' : 'admin');

      await upsertProfile({
        id: userId,
        email: c.get('userEmail') || '',
        full_name: authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || c.get('userEmail') || '',
        role
      });

      profile = await getProfileById(userId);
    }

    if (!profile) return c.json({ error: 'Profile not found' }, 404);
    return c.json({
      profile: {
        id: profile.id,
        email: profile.email,
        name: profile.full_name || profile.email,
        role: profile.role
      }
    });
  } catch {
    return c.json({ error: 'Failed to fetch profile' }, 500);
  }
});

app.get("/teachers", requireAuth, async (c) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('role', 'teacher')
      .order('created_at', { ascending: false });

    if (error) {
      return c.json({ error: `Failed to fetch teachers: ${error.message}` }, 500);
    }

    const teachers = (data || []).map((row: any) => ({
      id: row.id,
      email: row.email,
      name: row.full_name || row.email,
      role: row.role
    }));
    return c.json({ teachers });
  } catch {
    return c.json({ error: 'Failed to fetch teachers' }, 500);
  }
});

app.notFound((c) => c.json({ error: 'Route not found' }, 404));

Deno.serve(app.fetch);
