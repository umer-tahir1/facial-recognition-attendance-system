# Smart Attendance System - Facial Recognition

An intelligent facial recognition attendance system designed for university environments that automatically marks student attendance when teachers capture classroom images.

## Features

### Admin Panel
- **Student Registration**: Register students with facial image capture and encoding
- **Face Capture**: Use webcam to capture student photos and generate facial descriptors
- **Teacher Management**: View all registered teachers
- **Course Management**: Create courses and assign teachers
- **Student Enrollment**: Enroll students in courses

### Teacher Portal
- **Course Access**: View assigned courses with enrollment data
- **Classroom Capture**: Take photos of the classroom using webcam
- **Automated Recognition**: AI automatically detects and recognizes students
- **Attendance Marking**: Confirm and submit attendance records
- **Attendance History**: View past attendance sessions with statistics

## Technology Stack

### Frontend
- React with TypeScript
- Tailwind CSS for styling
- face-api.js for facial recognition
- react-webcam for camera access
- Lucide React for icons
- Sonner for notifications

### Backend
- Supabase for authentication and database
- Hono web framework (Deno runtime)
- Edge Functions for serverless API
- Key-Value store for data persistence

## System Architecture

### Three-Tier Architecture
```
Frontend (React) → Server (Hono) → Database (Supabase KV)
```

### API Endpoints

#### Authentication
- `POST /auth/signup` - Create new user account

#### Students
- `POST /students` - Register new student with face encoding
- `GET /students` - Get all students
- `GET /students/:id` - Get single student
- `PUT /students/:id` - Update student
- `DELETE /students/:id` - Delete student

#### Courses
- `POST /courses` - Create new course
- `GET /courses` - Get all courses
- `POST /courses/:courseCode/enroll` - Enroll student in course

#### Attendance
- `POST /attendance` - Mark attendance for a session
- `GET /attendance/:courseCode` - Get attendance records for course
- `GET /attendance/:courseCode/student/:studentId` - Get student attendance stats

#### Users
- `GET /profile` - Get current user profile
- `GET /teachers` - Get all teachers

## Getting Started

### 1. Sign Up
- Create an account with role "Admin" or "Teacher"
- Admin accounts have full access to all features
- Teacher accounts can only mark attendance for assigned courses

### 2. Admin Setup (First Time)
1. Register students with their facial images
2. Create courses and assign teachers
3. Enroll students in courses

### 3. Teacher Usage
1. Sign in to access the Teacher Portal
2. Select a course from your assigned courses
3. Capture a classroom photo
4. Review recognized students
5. Confirm and submit attendance

## Facial Recognition

The system uses face-api.js with the following models:
- **TinyFaceDetector**: Fast face detection
- **FaceLandmark68Net**: Facial landmark detection
- **FaceRecognitionNet**: Face descriptor generation (128-d vectors)
- **FaceExpressionNet**: Additional facial features

### Recognition Process
1. Capture image from webcam
2. Detect all faces in the image
3. Extract 128-dimensional face descriptors
4. Compare with enrolled students' descriptors
5. Match faces using Euclidean distance (threshold: 0.6)
6. Display recognized students with confidence scores

## Security & Privacy

### Authentication
- Secure authentication via Supabase Auth
- Role-based access control (Admin/Teacher)
- JWT tokens for API authorization
- Session management with access tokens

### Data Security
- Facial descriptors stored as 128-d numeric arrays (not images)
- Service role key never exposed to frontend
- CORS enabled for secure API access
- All API endpoints require authentication

### Privacy Considerations
- Students should provide consent for facial data collection
- Facial encodings are mathematical representations, not photos
- System designed for educational use only
- Complies with biometric data handling best practices

## API-First Design

The system is designed for future integration with LMS platforms like Qalam:

### Integration Points
- RESTful API endpoints
- Standard JSON responses
- JWT authentication
- Course and student synchronization
- Attendance data export

## Limitations

### Database Schema
- Uses flexible KV store for prototyping
- No custom table creation available in this environment
- Suitable for most university attendance scenarios
- Data stored with prefixed keys (student:, course:, attendance:)

## Future Enhancements

- Mobile app for teachers
- Bulk student import via CSV
- Advanced analytics dashboard
- Multi-factor authentication
- Attendance reports export (PDF/Excel)
- Integration with existing LMS systems
- Real-time notifications
- Attendance alerts for low attendance

## Browser Requirements

- Modern browser with webcam access (Chrome, Firefox, Safari, Edge)
- HTTPS required for camera permissions
- Minimum 2GB RAM for face-api.js models
- Good lighting conditions for accurate recognition

## Troubleshooting

### Face Recognition Issues
- Ensure good lighting in the room
- Position camera to capture faces clearly
- Students should face the camera
- Avoid backlighting or shadows
- Minimum face size: 160x160 pixels

### Camera Access
- Grant browser permission to access webcam
- Check if camera is being used by another application
- Use HTTPS for production deployment

### Performance
- Models load once at startup (~5-10 seconds)
- Recognition takes 2-5 seconds per image
- Performance depends on number of faces in image

## Support

For technical issues or questions:
- Check browser console for error messages
- Verify webcam is working properly
- Ensure models are loaded successfully
- Contact system administrator for access issues

---

**Built for NUST University** - Smart Attendance with AI-powered facial recognition
