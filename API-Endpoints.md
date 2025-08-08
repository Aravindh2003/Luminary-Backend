All endpoints are prefixed with:  
`/api/v1`  
Example: `/api/v1/auth/login`

---

## 🔐 1. Authentication (`/auth`)

| Method | Endpoint                           | Description                                 |
|--------|------------------------------------|---------------------------------------------|
| POST   | `/auth/register/parent`            | Register a new parent                       |
| POST   | `/auth/register/coach`             | Register a new coach (includes file uploads)|
| POST   | `/auth/login`                      | Login as Parent or Coach                    |
| POST   | `/auth/admin/login`                | Login as Admin                              |
| POST   | `/auth/logout`                     | Logout current user (auth required)         |
| POST   | `/auth/refresh`                    | Refresh access token                        |
| GET    | `/auth/verify-email/:token`        | Verify email address using token            |
| POST   | `/auth/forgot-password`            | Request password reset link                 |
| POST   | `/auth/reset-password/:token`      | Reset password using token                  |
| GET    | `/auth/profile`                    | Get current user profile (auth required)    |

---

## 🛠️ 2. Admin Panel (`/admin`)

| Method | Endpoint                                      | Description                                 |
|--------|-----------------------------------------------|---------------------------------------------|
| GET    | `/admin/dashboard`                            | Get dashboard data                          |
| GET    | `/admin/dashboard/stats`                      | Get dashboard statistics                    |
| GET    | `/admin/coaches`                              | List all coaches (with filter/search)       |
| GET    | `/admin/coaches/:coachId`                     | Get detailed coach information              |
| POST   | `/admin/coaches/:coachId/approve`             | Approve a coach application                 |
| POST   | `/admin/coaches/:coachId/reject`              | Reject a coach application                  |
| POST   | `/admin/coaches/:coachId/suspend`             | Suspend an approved coach                   |
| POST   | `/admin/coaches/:coachId/reactivate`          | Reactivate a suspended coach                |
| PUT    | `/admin/coaches/:coachId/notes`               | Update internal admin notes for a coach     |
| GET    | `/admin/activities`                           | Get recent admin activities (audit trail)   |
| POST   | `/admin/test-email`                           | Send a test email to verify email system    |

---

## 📁 3. File Uploads (`/upload`)

| Method | Endpoint                          | Description                                |
|--------|-----------------------------------|--------------------------------------------|
| POST   | `/upload/single`                  | Upload a single file (auth required)       |
| POST   | `/upload/multiple`                | Upload multiple files (auth required)      |
| POST   | `/upload/coach-files`             | Upload coach registration documents        |
| DELETE | `/upload/delete/:filename`        | Delete a file by filename                  |
| GET    | `/upload/files`                   | List all uploaded files for current user   |

---

## 📚 4. Courses (`/courses`)

| Method | Endpoint                                 | Description                                |
|--------|------------------------------------------|--------------------------------------------|
| GET    | `/courses`                               | Get all courses (with filters/search)      |
| GET    | `/courses/:courseId`                     | Get course details by ID                   |
| POST   | `/courses`                               | Create a new course (Coach only)           |
| PUT    | `/courses/:courseId`                     | Update a course (Coach only)               |
| DELETE | `/courses/:courseId`                     | Delete a course (Coach only)               |
| PATCH  | `/courses/:courseId/toggle-status`       | Toggle course active/inactive              |
| POST   | `/courses/:courseId/enroll`              | Enroll in a course (Parent only)           |
| GET    | `/courses/:courseId/reviews`             | Get course reviews                         |
| POST   | `/courses/:courseId/reviews`             | Add a course review (Parent only)          |

---

## 🧑‍🏫 5. Sessions (`/sessions`)

| Method | Endpoint                                  | Description                                |
|--------|-------------------------------------------|--------------------------------------------|
| GET    | `/sessions`                               | Get all sessions (with filters/search)     |
| GET    | `/sessions/:sessionId`                    | Get session details by ID                  |
| POST   | `/sessions`                               | Create a new session (Coach only)          |
| PUT    | `/sessions/:sessionId`                    | Update a session (Coach only)              |
| DELETE | `/sessions/:sessionId`                    | Cancel a session (Coach only)              |
| PATCH  | `/sessions/:sessionId/start`              | Mark session as started (Coach only)       |
| PATCH  | `/sessions/:sessionId/complete`           | Mark session as completed (Coach only)     |
| POST   | `/sessions/:sessionId/join`               | Join a session (Parent/Student only)       |
| PUT    | `/sessions/:sessionId/notes`              | Update session notes (Coach only)          |
| GET    | `/sessions/upcoming`                      | Get upcoming sessions for current user     |
| GET    | `/sessions/calendar`                      | Get sessions formatted for calendar view