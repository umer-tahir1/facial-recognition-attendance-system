import { AlertCircle, CheckCircle, Info } from 'lucide-react';

export function SetupGuide() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Info className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Welcome to Attendance System</h3>
            <p className="text-blue-800 text-sm">
              This system uses AI-powered facial recognition to automatically mark student attendance.
              Follow the steps below to get started.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4">Getting Started</h2>

        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
              1
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Admin Account Provisioning</h3>
              <p className="text-gray-600 text-sm">
                Administrator accounts are provisioned securely by system maintainers.
                Admin users can register students, create courses, and manage teacher accounts.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
              2
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Register Students</h3>
              <p className="text-gray-600 text-sm mb-2">
                Use the Admin Dashboard to register students. For each student:
              </p>
              <ul className="text-sm text-gray-600 space-y-1 ml-4">
                <li>• Enter student ID, name, and other details</li>
                <li>• Capture their facial photo using webcam</li>
                <li>• System automatically generates facial encoding</li>
                <li>• Save the student profile</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
              3
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Create Teacher Accounts</h3>
              <p className="text-gray-600 text-sm">
                Teachers are created by admins from the Teachers tab and then assigned to courses.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
              4
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Create Courses</h3>
              <p className="text-gray-600 text-sm">
                Create courses, assign teachers, and enroll students. Teachers will only see
                courses assigned to them.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-semibold">
              5
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Mark Attendance (Teachers)</h3>
              <p className="text-gray-600 text-sm mb-2">
                Teachers can now mark attendance by:
              </p>
              <ul className="text-sm text-gray-600 space-y-1 ml-4">
                <li>• Selecting their course</li>
                <li>• Capturing a classroom photo</li>
                <li>• Reviewing recognized students</li>
                <li>• Confirming attendance submission</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-yellow-900 mb-2">Important Notes</h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Ensure good lighting when capturing photos</li>
              <li>• Students should face the camera directly</li>
              <li>• System works best with 5-30 students per photo</li>
              <li>• Allow browser camera permissions</li>
              <li>• Face recognition models load automatically on startup</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-green-900 mb-2">Privacy & Security</h3>
            <p className="text-green-800 text-sm">
              Facial data is stored as mathematical descriptors (128-d vectors), not actual photos.
              All data is encrypted and securely stored. Students should provide consent before registration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
