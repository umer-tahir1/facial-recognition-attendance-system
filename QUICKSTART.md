## Quick Start Guide

### Step 1: Create Your First Admin Account

1. Click "Sign Up" on the login page
2. Fill in your details:
   - Name: Your full name
   - Email: Your email address
   - Password: Choose a strong password
   - Role: Select **Admin**
3. Click "Sign Up"
4. You'll be automatically redirected to sign in
5. Sign in with your credentials

### Step 2: Access the Admin Dashboard

After signing in as an admin, you'll see three tabs:
- **Students**: Register and manage students
- **Courses**: Create and manage courses
- **Teachers**: View registered teachers

### Step 3: Register Your First Student

1. Go to the "Students" tab
2. Click "Add Student"
3. Fill in the student details:
   - Student ID (e.g., "2024-CS-001")
   - Full Name
   - Email (optional)
   - Department (e.g., "Computer Science")
   - Batch (e.g., "2024")
4. **Important**: Click "Capture Photo"
   - Allow browser camera access if prompted
   - Position the student's face in the frame
   - Ensure good lighting
   - Click "Capture Photo"
   - Wait for face detection (you'll see a success message)
5. Click "Register Student"

### Step 4: Create a Teacher Account

1. Open a new incognito/private browser window
2. Go to the login page
3. Click "Sign Up"
4. Fill in teacher details:
   - Name: Teacher's full name
   - Email: Teacher's email
   - Password: Teacher's password
   - Role: Select **Teacher**
5. Sign up and sign in

### Step 5: Create a Course (Admin)

1. Back in your admin account, go to "Courses" tab
2. Click "Add Course"
3. Fill in course details:
   - Course Code (e.g., "CS101")
   - Course Name (e.g., "Introduction to Programming")
   - Instructor: Select the teacher you created
   - Department (e.g., "Computer Science")
   - Semester (e.g., "Spring 2026")
4. Click "Create Course"
5. Click "Enroll Students" on the course card
6. Select the students to enroll
7. Click "Enroll X Students"

### Step 6: Mark Attendance (Teacher)

1. Sign in as the teacher
2. You'll see the Teacher Portal with your assigned courses
3. Click on a course card
4. Wait for "Face recognition ready" notification
5. Click "Capture & Recognize"
   - Point camera at classroom
   - Ensure students are facing the camera
   - Click the button
6. Wait for recognition to complete (2-5 seconds)
7. Review recognized students
8. Click "Confirm Attendance"

### Tips for Best Results

**For Face Capture (Student Registration):**
- Use good lighting (avoid backlighting)
- Face should be directly facing camera
- Remove glasses if they cause glare
- Keep a neutral expression
- Ensure face fills about 1/3 of the frame

**For Attendance Marking:**
- Good classroom lighting is essential
- Students should face the camera
- Capture from a slight elevation
- Include 5-30 students per photo
- Multiple photos can be taken if needed

**Common Issues:**

1. **"No face detected"**
   - Improve lighting
   - Move closer to camera
   - Ensure face is visible and not obscured

2. **"No students recognized"**
   - Check if students are enrolled in the course
   - Verify lighting conditions match registration
   - Students may need to re-register if conditions differ significantly

3. **Camera not working**
   - Grant browser camera permissions
   - Close other apps using the camera
   - Try a different browser
   - Ensure using HTTPS (required for camera access)

### Testing the System

1. Register 3-5 test students with your own face from different angles
2. Create a test course and enroll them
3. Sign in as teacher
4. Try marking attendance by capturing your own face
5. You should be recognized as multiple students (this is expected for testing)

### Data Management

**View Attendance Records:**
- Teachers can see attendance history at the bottom of the attendance marking page
- Shows date, students present, and percentage

**Edit Students:**
- Admins can delete students from the Students tab
- Click the trash icon on any student card

**Manage Enrollments:**
- Click "Enroll Students" on any course to add/remove students

### Security Notes

- Each user can only access features for their role
- Admin: Full system access
- Teacher: Only assigned courses
- All API calls require authentication
- Session expires require re-login

### Next Steps

Once you've tested the basic workflow:
1. Register all your students
2. Create all required courses
3. Assign teachers to courses
4. Enroll students in their courses
5. Start marking attendance daily

### Support

If you encounter issues:
1. Check browser console for errors (F12 → Console)
2. Verify camera permissions
3. Ensure models loaded successfully
4. Try refreshing the page
5. Clear browser cache if needed

---

**Ready to start!** Begin with Step 1 above and follow the workflow.
