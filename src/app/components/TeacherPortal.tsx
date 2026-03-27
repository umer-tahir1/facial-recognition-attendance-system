import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Webcam from 'react-webcam';
import {
  Camera,
  BookOpen,
  LogOut,
  Users,
  CheckCircle,
  AlertCircle,
  Calendar,
  Download
} from 'lucide-react';
import { courseApi, studentApi, attendanceApi } from '../../utils/api';
import { loadFaceApiModels, recognizeFacesInClassroom } from '../../utils/faceRecognition';
import { toast } from 'sonner';

export function TeacherPortal() {
  const { user, signOut } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const modelToastShownRef = useRef(false);

  useEffect(() => {
    initializeFaceApi();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    loadCourses();
  }, [user?.id]);

  const initializeFaceApi = async () => {
    try {
      await loadFaceApiModels();
      setModelsLoaded(true);

      if (!modelToastShownRef.current) {
        toast.success('Face recognition ready');
        modelToastShownRef.current = true;
      }
    } catch (error) {
      console.error('Failed to load face-api models:', error);
      toast.error('Failed to load face recognition');
    }
  };

  const loadCourses = async () => {
    try {
      setLoading(true);
      const allCourses = await courseApi.getAll();
      const userId = String(user?.id || '').trim();
      const userEmail = String(user?.email || '').trim().toLowerCase();

      const teacherCourses = allCourses.filter((course: any) => {
        const courseTeacherId = String(course?.teacherId || '').trim();
        const courseTeacherIdLower = courseTeacherId.toLowerCase();
        const courseTeacherEmail = String(course?.teacherEmail || '').trim().toLowerCase();

        return (
          (userId && courseTeacherId === userId) ||
          (userEmail && courseTeacherEmail === userEmail) ||
          (userEmail && courseTeacherIdLower === userEmail) ||
          (userEmail && courseTeacherIdLower === `local-${userEmail}`)
        );
      });

      setCourses(teacherCourses);
    } catch (error) {
      console.error('Error loading courses:', error);
      toast.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Teacher Portal</h1>
              <p className="text-sm text-gray-600 mt-1">Welcome, {user?.name}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!selectedCourse ? (
          <CourseList
            courses={courses}
            onSelectCourse={setSelectedCourse}
            modelsLoaded={modelsLoaded}
          />
        ) : (
          <AttendanceMarking
            course={selectedCourse}
            onBack={() => setSelectedCourse(null)}
            modelsLoaded={modelsLoaded}
          />
        )}
      </div>
    </div>
  );
}

function CourseList({ courses, onSelectCourse, modelsLoaded }: any) {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">My Courses</h2>

      {!modelsLoaded && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <p className="text-sm text-yellow-800">Loading face recognition models...</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course: any) => (
          <div
            key={course.courseCode}
            className="bg-white rounded-xl border hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
            onClick={() => onSelectCourse(course)}
          >
            <div className="bg-blue-700 p-6 text-white">
              <BookOpen className="w-12 h-12 mb-4" />
              <h3 className="text-xl font-semibold mb-2">{course.courseName}</h3>
              <p className="text-blue-100">{course.courseCode}</p>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2 text-gray-600">
                <Users className="w-5 h-5" />
                <span className="text-sm">
                  {course.enrolledStudents?.length || 0} students enrolled
                </span>
              </div>
              <button
                disabled={!modelsLoaded}
                className="mt-4 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Mark Attendance
              </button>
            </div>
          </div>
        ))}
      </div>

      {courses.length === 0 && (
        <div className="text-center py-16 bg-white rounded-lg border">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Courses Assigned</h3>
          <p className="text-gray-600">Contact admin to get courses assigned</p>
        </div>
      )}
    </div>
  );
}

function AttendanceMarking({ course, onBack, modelsLoaded }: any) {
  const webcamRef = useRef<Webcam>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [recognitionResults, setRecognitionResults] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);

  useEffect(() => {
    loadEnrolledStudents();
    loadAttendanceHistory();
  }, [course]);

  const loadEnrolledStudents = async () => {
    try {
      const allStudents = await studentApi.getAll();
      const enrolled = allStudents.filter((s: any) =>
        course.enrolledStudents?.includes(s.studentId)
      );
      setEnrolledStudents(enrolled);
    } catch (error) {
      console.error('Error loading students:', error);
      toast.error('Failed to load enrolled students');
    }
  };

  const loadAttendanceHistory = async () => {
    try {
      const records = await attendanceApi.getByCourse(course.courseCode);
      setAttendanceHistory(records);
    } catch (error) {
      console.error('Error loading attendance history:', error);
    }
  };

  const captureAndRecognize = async () => {
    if (!webcamRef.current) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    setCapturedImage(imageSrc);
    setProcessing(true);

    try {
      const img = new Image();
      img.src = imageSrc;
      await img.decode();

      const results = await recognizeFacesInClassroom(img, enrolledStudents);

      setRecognitionResults(results);

      if (results.recognized.length > 0) {
        toast.success(`Recognized ${results.recognized.length} students!`);
      } else {
        toast.warning('No students recognized in the image');
      }
    } catch (error) {
      console.error('Error recognizing faces:', error);
      toast.error('Failed to recognize faces');
    } finally {
      setProcessing(false);
    }
  };

  const confirmAttendance = async () => {
    if (!recognitionResults) return;

    try {
      const date = new Date().toISOString().split('T')[0];

      await attendanceApi.mark({
        courseCode: course.courseCode,
        date,
        recognizedStudents: recognitionResults.recognized.map((r: any) => ({
          studentId: r.studentId,
          name: r.name,
          confidence: r.confidence,
          timestamp: new Date().toISOString()
        })),
        totalStudents: enrolledStudents.length
      });

      toast.success('Attendance marked successfully!');

      setCapturedImage(null);
      setRecognitionResults(null);
      loadAttendanceHistory();
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark attendance');
    }
  };

  const retake = () => {
    setCapturedImage(null);
    setRecognitionResults(null);
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-6 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
      >
        ← Back to Courses
      </button>

      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-2">{course.courseName}</h2>
        <p className="text-gray-600">{course.courseCode}</p>
        <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            {enrolledStudents.length} enrolled
          </span>
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {attendanceHistory.length} sessions
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold mb-4">Capture Classroom Photo</h3>

          {!capturedImage ? (
            <div className="space-y-4">
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={captureAndRecognize}
                disabled={!modelsLoaded || processing}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg font-medium"
              >
                <Camera className="w-6 h-6" />
                {processing ? 'Processing...' : 'Capture & Recognize'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <img src={capturedImage} alt="Captured" className="w-full rounded-lg" />

              {recognitionResults && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    <p className="font-semibold text-blue-900">Recognition Complete</p>
                  </div>
                  <p className="text-sm text-blue-800">
                    Detected {recognitionResults.totalDetected} faces, recognized{' '}
                    {recognitionResults.recognized.length} students
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={retake}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Retake
                </button>
                <button
                  onClick={confirmAttendance}
                  disabled={!recognitionResults || recognitionResults.recognized.length === 0}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Attendance
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold mb-4">
            {recognitionResults ? 'Recognized Students' : 'Enrolled Students'}
          </h3>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {recognitionResults ? (
              recognitionResults.recognized.map((student: any) => (
                <div
                  key={student.studentId}
                  className="p-3 bg-green-50 border border-green-200 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{student.name}</p>
                      <p className="text-sm text-gray-600">{student.studentId}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-600">
                        {(student.confidence * 100).toFixed(0)}%
                      </span>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              enrolledStudents.map((student) => (
                <div key={student.studentId} className="p-3 border rounded-lg">
                  <p className="font-medium text-gray-900">{student.name}</p>
                  <p className="text-sm text-gray-600">{student.studentId}</p>
                </div>
              ))
            )}
          </div>

          {recognitionResults && recognitionResults.recognized.length === 0 && (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
              <p className="text-gray-600">No students recognized</p>
              <p className="text-sm text-gray-500 mt-1">Try capturing again with better lighting</p>
            </div>
          )}
        </div>
      </div>

      {attendanceHistory.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Attendance</h3>
          <div className="space-y-3">
            {attendanceHistory.slice(0, 5).map((record: any, index: number) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{record.date}</p>
                  <p className="text-sm text-gray-600">
                    {record.recognizedStudents?.length || 0} / {record.totalStudents} students present
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">
                    {record.totalStudents > 0
                      ? ((record.recognizedStudents?.length / record.totalStudents) * 100).toFixed(0)
                      : 0}
                    %
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
