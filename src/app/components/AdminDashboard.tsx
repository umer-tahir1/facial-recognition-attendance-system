import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import Webcam from "react-webcam";
import {
  Users, BookOpen, LogOut, LayoutDashboard,
  Building2, GraduationCap, MessageSquare,
  Settings, Bell, Search, ChevronDown, Plus, Menu, UserPlus, X, Camera, CheckCircle
} from "lucide-react";
import { toast } from "sonner";
import { courseApi, studentApi, userApi } from "../../utils/api";
import { detectFaceFromImage, loadFaceApiModels } from "../../utils/faceRecognition";

const TEACHER_DEPARTMENTS_KEY = "nust_teacher_departments";

function readTeacherDepartmentMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(TEACHER_DEPARTMENTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeTeacherDepartmentMap(map: Record<string, string>) {
  localStorage.setItem(TEACHER_DEPARTMENTS_KEY, JSON.stringify(map));
}

function Modal({ isOpen, title, children, onClose }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto p-4 flex items-start justify-center sm:items-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 my-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div className="mb-4">
      <label className="text-sm font-medium text-gray-700 block mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

export function AdminDashboard() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const webcamRef = useRef<Webcam>(null);
  const [loading, setLoading] = useState(true);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [capturingStudent, setCapturingStudent] = useState(false);
  const [creatingTeacher, setCreatingTeacher] = useState(false);

  // Modal states
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);

  // Data states
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [customDepartments, setCustomDepartments] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedDepartmentClassCode, setSelectedDepartmentClassCode] = useState<string | null>(null);

  // Form states
  const [deptForm, setDeptForm] = useState({ name: "", code: "", description: "" });
  const [teacherForm, setTeacherForm] = useState({ name: "", email: "", password: "", department: "" });
  const [classForm, setClassForm] = useState({
    courseName: "",
    courseCode: "",
    department: "",
    semester: "",
    teacherId: "",
    enrolledStudentIds: [] as string[]
  });
  const [studentForm, setStudentForm] = useState({
    name: "",
    email: "",
    studentId: "",
    department: "",
    batch: "",
    capturedImage: "",
    faceDescriptor: [] as number[]
  });

  useEffect(() => {
    void initialize();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nust_custom_departments");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setCustomDepartments(parsed);
      }
    } catch {
      setCustomDepartments([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("nust_custom_departments", JSON.stringify(customDepartments));
  }, [customDepartments]);

  useEffect(() => {
    if (activeTab !== "departments") {
      setSelectedDepartment(null);
      setSelectedDepartmentClassCode(null);
    }
  }, [activeTab]);

  const initialize = async () => {
    try {
      setLoading(true);
      await Promise.all([initializeFaceModels(), loadData()]);
    } finally {
      setLoading(false);
    }
  };

  const initializeFaceModels = async () => {
    try {
      await loadFaceApiModels();
      setModelsLoaded(true);
    } catch {
      setModelsLoaded(false);
      toast.error("Face recognition models failed to load");
    }
  };

  const loadData = async () => {
    const [teacherResult, studentResult, courseResult] = await Promise.allSettled([
      userApi.getTeachers(),
      studentApi.getAll(),
      courseApi.getAll()
    ]);

    if (teacherResult.status === "fulfilled") {
      const departmentMap = readTeacherDepartmentMap();
      let normalizedTeachers = (teacherResult.value || []).map((teacher: any) => {
        const emailKey = String(teacher?.email || "").toLowerCase();
        return {
          ...teacher,
          department: teacher?.department || departmentMap[emailKey] || null
        };
      });

      // When backend teacher listing is empty (e.g., restrictive RLS on profiles),
      // reconstruct known teachers from locally stored department assignments.
      if (normalizedTeachers.length === 0) {
        normalizedTeachers = Object.keys(departmentMap).map((email) => {
          const localPart = String(email).split('@')[0] || 'Teacher';
          return {
            id: `local-${email}`,
            email,
            name: localPart,
            role: 'teacher',
            department: departmentMap[email] || null
          };
        });
      }

      setTeachers(normalizedTeachers);
    } else {
      setTeachers([]);
    }
    if (studentResult.status === "fulfilled") {
      setStudents(studentResult.value || []);
    } else {
      setStudents([]);
    }
    if (courseResult.status === "fulfilled") {
      setClasses(courseResult.value || []);
    } else {
      setClasses([]);
    }
  };

  const departments = useMemo(() => {
    const deptMap = new Map<string, { name: string; code: string; description: string; teachers: number; students: number; isCustom: boolean }>();

    const upsert = (department?: string | null) => {
      const deptName = (department || "").trim();
      if (!deptName) return null;
      if (!deptMap.has(deptName)) {
        deptMap.set(deptName, {
          name: deptName,
          code: deptName.slice(0, 4).toUpperCase(),
          description: `${deptName} department`,
          teachers: 0,
          students: 0,
          isCustom: false
        });
      }
      return deptMap.get(deptName)!;
    };

    teachers.forEach((teacher: any) => {
      const item = upsert(teacher.department);
      if (item) item.teachers += 1;
    });
    students.forEach((student: any) => {
      const item = upsert(student.department);
      if (item) item.students += 1;
    });
    classes.forEach((course: any) => {
      upsert(course.department);
    });

    customDepartments.forEach((dept: any) => {
      const deptName = (dept?.name || "").trim();
      if (!deptName) return;
      if (!deptMap.has(deptName)) {
        deptMap.set(deptName, {
          name: deptName,
          code: (dept?.code || deptName.slice(0, 4).toUpperCase()).trim(),
          description: (dept?.description || `${deptName} department`).trim(),
          teachers: 0,
          students: 0,
          isCustom: true
        });
      }
    });

    return Array.from(deptMap.values());
  }, [teachers, students, classes, customDepartments]);

  const stats = {
    departments: departments.length,
    teachers: teachers.length,
    classes: classes.length,
    students: students.length
  };

  const departmentClasses = useMemo(() => {
    if (!selectedDepartment) return [];
    return classes.filter((course: any) => ((course.department || "Unassigned").trim() || "Unassigned") === selectedDepartment);
  }, [classes, selectedDepartment]);

  const selectedDepartmentClass = useMemo(() => {
    if (!selectedDepartmentClassCode) return null;
    return departmentClasses.find((course: any) => course.courseCode === selectedDepartmentClassCode) || null;
  }, [departmentClasses, selectedDepartmentClassCode]);

  const selectedClassStudents = useMemo(() => {
    if (!selectedDepartmentClass) return [];
    const enrolled = selectedDepartmentClass.enrolledStudents || [];
    return students.filter((student: any) => enrolled.includes(student.studentId));
  }, [students, selectedDepartmentClass]);

  const resolveTeacherDisplay = (course: any) => {
    const teacherId = String(course?.teacherId || '').trim();
    const teacherEmail = String(course?.teacherEmail || '').trim().toLowerCase();

    const matched = teachers.find((teacher: any) => {
      const tId = String(teacher?.id || '').trim();
      const tEmail = String(teacher?.email || '').trim().toLowerCase();
      return (
        (teacherId && tId === teacherId) ||
        (teacherEmail && tEmail === teacherEmail) ||
        (teacherId && tEmail && teacherId.toLowerCase() === tEmail) ||
        (teacherId && tEmail && teacherId.toLowerCase() === `local-${tEmail}`)
      );
    });

    if (matched) return `${matched.name} (${matched.email})`;
    if (course?.teacherName && course?.teacherEmail) return `${course.teacherName} (${course.teacherEmail})`;
    if (course?.teacherEmail) return course.teacherEmail;
    if (teacherId) return teacherId;
    return 'Unassigned';
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "departments", label: "Departments", icon: Building2 },
    { id: "teachers", label: "Teachers", icon: Users },
    { id: "classes", label: "Classes", icon: BookOpen },
    { id: "students", label: "Students", icon: GraduationCap },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const addDepartment = () => {
    const deptName = deptForm.name.trim();
    if (!deptName) {
      toast.error("Department name is required");
      return;
    }

    const exists = departments.some((d: any) => d.name.toLowerCase() === deptName.toLowerCase());
    if (exists) {
      toast.error("Department already exists");
      return;
    }

    setCustomDepartments((prev) => [
      ...prev,
      {
        name: deptName,
        code: deptForm.code.trim() || deptName.slice(0, 4).toUpperCase(),
        description: deptForm.description.trim() || `${deptName} department`
      }
    ]);

    toast.success("Department added successfully");
    setDeptForm({ name: "", code: "", description: "" });
    setShowDeptModal(false);
  };

  const deleteDepartment = (departmentName: string) => {
    const canDelete = customDepartments.some((d: any) => d.name === departmentName);
    if (!canDelete) {
      toast.error("This department is tied to existing records and cannot be removed here.");
      return;
    }
    setCustomDepartments((prev) => prev.filter((d: any) => d.name !== departmentName));
    toast.success("Department removed");
  };

  const addTeacher = async () => {
    if (creatingTeacher) return;

    if (!teacherForm.name.trim() || !teacherForm.email.trim() || !teacherForm.password.trim()) {
      toast.error("Name, email, and password are required", { id: "teacher-create" });
      return;
    }

    try {
      setCreatingTeacher(true);
      const createResult = await userApi.createUser({
        name: teacherForm.name.trim(),
        email: teacherForm.email.trim(),
        password: teacherForm.password,
        role: "teacher"
      });

      const teacherDepartment = teacherForm.department.trim();
      if (teacherDepartment) {
        const map = readTeacherDepartmentMap();
        map[teacherForm.email.trim().toLowerCase()] = teacherDepartment;
        writeTeacherDepartmentMap(map);
      }

      const requiresEmailConfirmation = Boolean((createResult as any)?.requiresEmailConfirmation);
      if (requiresEmailConfirmation) {
        toast.error("Teacher created, but login is blocked until email is confirmed in Supabase Authentication > Users.", { id: "teacher-create" });
      } else if (teacherDepartment) {
        toast.success("Teacher created and department assigned.", { id: "teacher-create" });
      } else {
        toast.success("Teacher created successfully", { id: "teacher-create" });
      }

      setTeacherForm({ name: "", email: "", password: "", department: "" });
      setShowTeacherModal(false);
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create teacher", { id: "teacher-create" });
    } finally {
      setCreatingTeacher(false);
    }
  };

  const deleteTeacher = (_id: string) => {
    toast.error("Teacher deletion is not available yet.");
  };

  const addClass = async () => {
    if (!classForm.courseName.trim() || !classForm.courseCode.trim() || !classForm.teacherId) {
      toast.error("Course name, code, and teacher are required");
      return;
    }

    try {
      const selectedTeacher = teachers.find((teacher: any) => teacher.id === classForm.teacherId);
      const selectedTeacherEmail = String(selectedTeacher?.email || '').trim().toLowerCase();
      const normalizedTeacherId =
        String(classForm.teacherId).startsWith('local-') && selectedTeacherEmail
          ? selectedTeacherEmail
          : classForm.teacherId;

      await courseApi.create({
        courseName: classForm.courseName.trim(),
        courseCode: classForm.courseCode.trim(),
        teacherId: normalizedTeacherId,
        teacherEmail: selectedTeacherEmail || null,
        teacherName: selectedTeacher?.name || null,
        department: classForm.department.trim() || null,
        semester: classForm.semester.trim() || null
      });

      if (classForm.enrolledStudentIds.length > 0) {
        await Promise.all(
          classForm.enrolledStudentIds.map((studentId) =>
            courseApi.enrollStudent(classForm.courseCode.trim(), studentId)
          )
        );
      }

      toast.success("Class created and students enrolled");
      setClassForm({
        courseName: "",
        courseCode: "",
        department: "",
        semester: "",
        teacherId: "",
        enrolledStudentIds: []
      });
      setShowClassModal(false);
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create class");
    }
  };

  const deleteClass = (_id: string) => {
    toast.error("Class deletion is not available yet.");
  };

  const captureStudentFace = async () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      toast.error("Could not capture image. Check camera permissions.");
      return;
    }

    if (!modelsLoaded) {
      toast.error("Face models are still loading");
      return;
    }

    setCapturingStudent(true);
    try {
      const image = new Image();
      image.src = imageSrc;
      await image.decode();

      const detection = await detectFaceFromImage(image);
      if (!detection) {
        toast.error("No face detected. Please face the camera clearly.");
        return;
      }

      setStudentForm((prev) => ({
        ...prev,
        capturedImage: imageSrc,
        faceDescriptor: Array.from(detection.descriptor)
      }));
      toast.success("Face captured successfully");
    } catch {
      toast.error("Failed to process face image");
    } finally {
      setCapturingStudent(false);
    }
  };

  const retakeStudentFace = () => {
    setStudentForm((prev) => ({
      ...prev,
      capturedImage: "",
      faceDescriptor: []
    }));
  };

  const addStudent = async () => {
    if (!studentForm.name.trim() || !studentForm.studentId.trim()) {
      toast.error("Student name and student ID are required");
      return;
    }

    if (!studentForm.capturedImage || studentForm.faceDescriptor.length === 0) {
      toast.error("Capture student face before registration");
      return;
    }

    try {
      const result = await studentApi.create({
        studentId: studentForm.studentId.trim(),
        name: studentForm.name.trim(),
        email: studentForm.email.trim() || null,
        department: studentForm.department.trim() || null,
        batch: studentForm.batch.trim() || null,
        capturedImage: studentForm.capturedImage,
        faceDescriptor: studentForm.faceDescriptor
      });

      toast.success(result?.message || "Student saved with face data");
      setStudentForm({
        name: "",
        email: "",
        studentId: "",
        department: "",
        batch: "",
        capturedImage: "",
        faceDescriptor: []
      });
      setShowStudentModal(false);
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to register student");
    }
  };

  const deleteStudent = async (studentId: string) => {
    try {
      await studentApi.delete(studentId);
      toast.success("Student deleted");
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete student");
    }
  };

  const sidebarClass = sidebarOpen ? "w-64" : "w-20";

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden font-sans">
      <aside className={`bg-dark-900 text-white transition-all duration-300 flex flex-col ${sidebarClass} shrink-0 shadow-xl z-20`} style={{ backgroundColor: "#1e1e2d" }}>
        <div className="h-16 flex items-center justify-center border-b border-gray-800 px-4">
          {sidebarOpen ? (
            <div className="flex items-center gap-3 w-full px-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg shadow-sm">N</div>
              <span className="text-xl font-bold tracking-tight text-white">NUST Attendance</span>
            </div>
          ) : (
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg">N</div>
          )}
        </div>
        
        <nav className="flex-1 py-6 space-y-1 overflow-y-auto px-3">
          {!sidebarOpen ? null : <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Management</p>}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const bgClass = isActive ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:bg-gray-800 hover:text-white";
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200 ${bgClass}`}
                title={item.label}
              >
                <Icon className={sidebarOpen ? "w-5 h-5 mr-3 shrink-0" : "w-6 h-6 mx-auto shrink-0"} />
                {sidebarOpen && <span className="font-medium tracking-wide text-sm">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center px-3 py-3 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-xl transition-colors"
          >
            <LogOut className={sidebarOpen ? "w-5 h-5 mr-3" : "w-5 h-5 mx-auto"} />
            {sidebarOpen && <span className="font-medium text-sm">Sign Out</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 lg:px-10 shrink-0 z-10">
          <div className="flex items-center gap-6 flex-1">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-500 hover:text-blue-600 transition-colors">
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative w-full max-w-md hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search departments, teachers, students..." className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-200 transition-all" />
            </div>
          </div>

          <div className="flex items-center gap-5">
            <button className="relative text-gray-400 hover:text-gray-600 transition-colors hidden sm:block">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className=" h-8 w-px bg-gray-200 hidden sm:block"></div>
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center text-white font-bold shadow-sm group-hover:shadow-md transition-shadow">
                {user?.name?.[0]?.toUpperCase() || "A"}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-gray-700 leading-tight">{user?.name || "System Admin"}</p>
                <p className="text-xs text-gray-500">Administrator</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto w-full p-6 lg:p-10">
          {activeTab === "dashboard" && (
            <div className="max-w-7xl mx-auto space-y-8">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System Overview</h1>
                  <p className="text-gray-500 mt-1 text-sm">Welcome to NUST Attendance System</p>
                </div>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Generate Report
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                   { label: "Total Departments", value: stats.departments, icon: Building2, bg: "bg-purple-100", color: "text-purple-600" },
                   { label: "Total Teachers", value: stats.teachers, icon: Users, bg: "bg-blue-100", color: "text-blue-600" },
                   { label: "Active Classes", value: stats.classes, icon: BookOpen, bg: "bg-orange-100", color: "text-orange-600" },
                   { label: "Enrolled Students", value: stats.students, icon: GraduationCap, bg: "bg-emerald-100", color: "text-emerald-600" }
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                          <h3 className="text-3xl font-bold text-gray-900 mt-2">{stat.value.toLocaleString()}</h3>
                        </div>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">Departments</h3>
                    <button className="text-sm text-blue-600 font-medium hover:text-blue-700">View All</button>
                  </div>
                  <div className="overflow-x-auto">
                    {departments.length === 0 ? (
                      <div className="p-12 text-center">
                        <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No departments added yet</p>
                      </div>
                    ) : (
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Department</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Code</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Staff</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {departments.map((dept, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <span className="font-semibold text-gray-900">{dept.name}</span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">{dept.code}</td>
                              <td className="px-6 py-4">
                                <p className="text-sm text-gray-700 font-medium">{dept.teachers} Teachers / {dept.students} Students</p>
                              </td>
                              <td className="px-6 py-4 text-right"></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4 mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    {[
                      { label: "Add Teacher", icon: Users, bg: "bg-blue-50", color: "text-blue-600", onClick: () => setShowTeacherModal(true) },
                      { label: "Create Class", icon: BookOpen, bg: "bg-orange-50", color: "text-orange-600", onClick: () => setShowClassModal(true) },
                      { label: "Register Student", icon: UserPlus, bg: "bg-emerald-50", color: "text-emerald-600", onClick: () => setShowStudentModal(true) },
                      { label: "Add Department", icon: Building2, bg: "bg-purple-50", color: "text-purple-600", onClick: () => setShowDeptModal(true) },
                    ].map((action, j) => {
                      const Icon = action.icon;
                      return (
                        <button key={j} onClick={action.onClick} className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200 group text-left">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.bg} ${action.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className="font-medium text-gray-700 group-hover:text-gray-900 text-sm">{action.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "departments" && (
            <div className="max-w-7xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
                  {selectedDepartment && !selectedDepartmentClass && (
                    <p className="text-sm text-gray-500 mt-1">Showing classes in {selectedDepartment}</p>
                  )}
                  {selectedDepartment && selectedDepartmentClass && (
                    <p className="text-sm text-gray-500 mt-1">Showing students in {selectedDepartmentClass.courseName}</p>
                  )}
                </div>
                <button onClick={() => setShowDeptModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Department
                </button>
              </div>

              {!selectedDepartment && departments.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                  <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No departments yet. Click "Add Department" to get started.</p>
                </div>
              ) : !selectedDepartment ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {departments.map((dept, index) => (
                    <div key={`${dept.name}-${index}`} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-gray-900">{dept.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">{dept.code}</p>
                        </div>
                        <button onClick={() => deleteDepartment(dept.name)} className="text-red-400 hover:text-red-600">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600">{dept.description}</p>
                      <button
                        onClick={() => {
                          setSelectedDepartment(dept.name);
                          setSelectedDepartmentClassCode(null);
                        }}
                        className="mt-4 w-full px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-950 text-sm"
                      >
                        Open Department
                      </button>
                    </div>
                  ))}
                </div>
              ) : !selectedDepartmentClass ? (
                <div className="space-y-4">
                  <button
                    onClick={() => {
                      setSelectedDepartment(null);
                      setSelectedDepartmentClassCode(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Back to Departments
                  </button>

                  {departmentClasses.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                      <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 text-lg">No classes found in {selectedDepartment}</p>
                      <p className="text-gray-500 text-sm mt-2">Create a class and assign this department to see it here.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {departmentClasses.map((cls: any) => (
                        <div key={cls.courseCode} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                          <h3 className="font-bold text-gray-900">{cls.courseName}</h3>
                          <p className="text-sm text-gray-500 mt-1">{cls.courseCode}</p>
                          <p className="text-sm text-gray-600 mt-3">
                            {(cls.enrolledStudents || []).length} students enrolled
                          </p>
                          <button
                            onClick={() => setSelectedDepartmentClassCode(cls.courseCode)}
                            className="mt-4 w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                          >
                            Open Class
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedDepartmentClassCode(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Back to Classes
                  </button>

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                      <h3 className="font-semibold text-gray-900">{selectedDepartmentClass.courseName}</h3>
                      <p className="text-sm text-gray-500">{selectedDepartmentClass.courseCode}</p>
                    </div>

                    {selectedClassStudents.length === 0 ? (
                      <div className="p-10 text-center">
                        <GraduationCap className="w-14 h-14 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-600">No students enrolled in this class yet.</p>
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Registration ID</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {selectedClassStudents.map((student: any) => (
                            <tr key={student.studentId} className="hover:bg-gray-50">
                              <td className="px-6 py-4 font-medium text-gray-900">{student.name}</td>
                              <td className="px-6 py-4 text-sm text-gray-500">{student.email || "N/A"}</td>
                              <td className="px-6 py-4 text-sm text-gray-500">{student.studentId}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "teachers" && (
            <div className="max-w-7xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Teachers</h1>
                <button onClick={() => setShowTeacherModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Teacher
                </button>
              </div>
              {teachers.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No teachers yet. Click "Add Teacher" to get started.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Department</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {teachers.map((teacher) => (
                        <tr key={teacher.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium text-gray-900">{teacher.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{teacher.email}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{teacher.department || "N/A"}</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => deleteTeacher(teacher.id)} className="text-red-400 hover:text-red-600"><X className="w-5 h-5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "classes" && (
            <div className="max-w-7xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
                <button onClick={() => setShowClassModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Class
                </button>
              </div>
              {classes.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                  <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No classes yet. Click "Add Class" to get started.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Code</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Teacher</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Department</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {classes.map((cls) => (
                        <tr key={cls.courseCode} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium text-gray-900">{cls.courseName}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{cls.courseCode}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{resolveTeacherDisplay(cls)}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{cls.department || "N/A"}</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => deleteClass(cls.courseCode)} className="text-red-400 hover:text-red-600"><X className="w-5 h-5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "students" && (
            <div className="max-w-7xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Students</h1>
                <button onClick={() => setShowStudentModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Student
                </button>
              </div>
              {students.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                  <GraduationCap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No students yet. Click "Add Student" to get started.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Department</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Registration ID</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {students.map((student) => (
                        <tr key={student.studentId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium text-gray-900">{student.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{student.email}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{student.department || "N/A"}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{student.studentId}</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => deleteStudent(student.studentId)} className="text-red-400 hover:text-red-600"><X className="w-5 h-5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {(activeTab === "messages" || activeTab === "settings") && (
            <div className="max-w-7xl mx-auto flex flex-col items-center justify-center h-96 text-center space-y-4">
              <div className="w-24 h-24 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500">
                {activeTab === "messages" && <MessageSquare className="w-12 h-12" />}
                {activeTab === "settings" && <Settings className="w-12 h-12" />}
              </div>
              <h2 className="text-3xl font-bold text-gray-900">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
              <p className="text-gray-500 max-w-md text-sm">Coming soon!</p>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <Modal isOpen={showDeptModal} title="Add Department" onClose={() => setShowDeptModal(false)}>
        <InputField label="Department Name" value={deptForm.name} onChange={(e: any) => setDeptForm({...deptForm, name: e.target.value})} placeholder="e.g., Computer Science" />
        <InputField label="Code" value={deptForm.code} onChange={(e: any) => setDeptForm({...deptForm, code: e.target.value})} placeholder="e.g., CS-101" />
        <InputField label="Description" value={deptForm.description} onChange={(e: any) => setDeptForm({...deptForm, description: e.target.value})} placeholder="Department description" />
        <div className="flex gap-3">
          <button onClick={() => setShowDeptModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={addDepartment} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add</button>
        </div>
      </Modal>

      <Modal isOpen={showTeacherModal} title="Add Teacher" onClose={() => setShowTeacherModal(false)}>
        <InputField label="Full Name" value={teacherForm.name} onChange={(e: any) => setTeacherForm({...teacherForm, name: e.target.value})} placeholder="e.g., Dr. Ahmed Khan" />
        <InputField label="Email" value={teacherForm.email} onChange={(e: any) => setTeacherForm({...teacherForm, email: e.target.value})} placeholder="e.g., teacher@nust.edu" />
        <InputField label="Password" type="password" value={teacherForm.password} onChange={(e: any) => setTeacherForm({...teacherForm, password: e.target.value})} placeholder="Temporary password" />
        <InputField label="Department" value={teacherForm.department} onChange={(e: any) => setTeacherForm({...teacherForm, department: e.target.value})} placeholder="Optional" />
        <div className="flex gap-3">
          <button onClick={() => setShowTeacherModal(false)} disabled={creatingTeacher} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed">Cancel</button>
          <button onClick={addTeacher} disabled={creatingTeacher} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed">{creatingTeacher ? "Adding..." : "Add"}</button>
        </div>
      </Modal>

      <Modal isOpen={showClassModal} title="Create Class" onClose={() => setShowClassModal(false)}>
        <InputField label="Class Name" value={classForm.courseName} onChange={(e: any) => setClassForm({...classForm, courseName: e.target.value})} placeholder="e.g., Data Structures" />
        <InputField label="Class Code" value={classForm.courseCode} onChange={(e: any) => setClassForm({...classForm, courseCode: e.target.value})} placeholder="e.g., CS-201" />
        <InputField label="Department" value={classForm.department} onChange={(e: any) => setClassForm({...classForm, department: e.target.value})} placeholder="e.g., Computer Science" />
        <InputField label="Semester" value={classForm.semester} onChange={(e: any) => setClassForm({...classForm, semester: e.target.value})} placeholder="e.g., Fall 2026" />
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">Teacher</label>
          {teachers.length === 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 mb-2">
              No teachers available. Add a teacher first, then create the class.
            </p>
          )}
          <select
            value={classForm.teacherId}
            onChange={(e) => setClassForm({ ...classForm, teacherId: e.target.value })}
            disabled={teachers.length === 0}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select teacher</option>
            {teachers.map((teacher: any) => (
              <option key={teacher.id} value={teacher.id}>{teacher.name} ({teacher.email})</option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">Enroll Students</label>
          <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-2">
            {students.length === 0 && <p className="text-sm text-gray-500">No students registered yet</p>}
            {students.map((student: any) => (
              <label key={student.studentId} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={classForm.enrolledStudentIds.includes(student.studentId)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setClassForm((prev) => ({
                      ...prev,
                      enrolledStudentIds: checked
                        ? [...prev.enrolledStudentIds, student.studentId]
                        : prev.enrolledStudentIds.filter((id) => id !== student.studentId)
                    }));
                  }}
                />
                {student.name} ({student.studentId})
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowClassModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={addClass} disabled={teachers.length === 0} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed">Create</button>
        </div>
      </Modal>

      <Modal isOpen={showStudentModal} title="Register Student" onClose={() => setShowStudentModal(false)}>
        <div className="space-y-5">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
            Complete student details, then capture one clear frontal face photo.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Full Name" value={studentForm.name} onChange={(e: any) => setStudentForm({...studentForm, name: e.target.value})} placeholder="Student name" />
            <InputField label="Student ID" value={studentForm.studentId} onChange={(e: any) => setStudentForm({...studentForm, studentId: e.target.value})} placeholder="e.g., STU-2024-001" />
            <InputField label="Email" value={studentForm.email} onChange={(e: any) => setStudentForm({...studentForm, email: e.target.value})} placeholder="student@nust.edu" />
            <InputField label="Batch" value={studentForm.batch} onChange={(e: any) => setStudentForm({...studentForm, batch: e.target.value})} placeholder="e.g., 2026" />
          </div>

          <InputField label="Department" value={studentForm.department} onChange={(e: any) => setStudentForm({...studentForm, department: e.target.value})} placeholder="e.g., Computer Science" />

          <div className="rounded-xl border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-800">Face Capture</label>
              <span className={`text-xs px-2 py-1 rounded-full ${modelsLoaded ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                {modelsLoaded ? "Model Ready" : "Model Loading"}
              </span>
            </div>

            {!studentForm.capturedImage ? (
              <>
                <div className="rounded-lg overflow-hidden border border-gray-200 bg-black aspect-video mb-3">
                  <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" className="w-full h-full object-cover" />
                </div>
                <button
                  onClick={captureStudentFace}
                  disabled={!modelsLoaded || capturingStudent}
                  className="w-full px-3 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-950 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  {capturingStudent ? "Processing..." : "Capture & Encode Face"}
                </button>
              </>
            ) : (
              <>
                <img src={studentForm.capturedImage} alt="Captured student" className="w-full rounded-lg border border-gray-200 mb-3" />
                <div className="flex gap-2">
                  <div className="flex-1 text-green-700 text-sm flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-4 h-4" /> Face captured successfully
                  </div>
                  <button
                    onClick={retakeStudentFace}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Retake
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setShowStudentModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={addStudent} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Register Student</button>
          </div>
        </div>
      </Modal>

      {loading && (
        <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center">
          <div className="bg-white rounded-xl px-6 py-4 shadow-xl text-gray-800">Loading dashboard data...</div>
        </div>
      )}
    </div>
  );
}
