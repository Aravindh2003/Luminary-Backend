import express from "express";
import { body, query, param } from "express-validator";
import multer from "multer";
import asyncHandler from "../utils/asyncHandler.js";
import validate from "../middleware/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import * as courseController from "../controllers/courseController.js";
import fileUploadService from "../services/fileUploadService.js";

const router = express.Router();

// Configure multer for course media uploads (thumbnail, video/introVideo)
const courseUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max per file
    files: 3, // Maximum 3 files (thumbnail, video or introVideo)
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "thumbnail") {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Thumbnail must be JPEG, PNG, or WebP format"), false);
      }
    } else if (file.fieldname === "video" || file.fieldname === "introVideo") {
      if (file.mimetype.startsWith("video/")) {
        cb(null, true);
      } else {
        cb(new Error("Video file must be a valid video format"), false);
      }
    } else {
      cb(new Error("Unexpected field"), false);
    }
  },
});

// Validation rules
const createCourseValidation = [
  body("title")
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Title must be between 3 and 200 characters"),
  body("description")
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Description must be between 10 and 2000 characters"),
  body("benefits")
    .optional()
    .isString()
    .isLength({ max: 2000 })
    .withMessage("Benefits must be less than 2000 characters"),
  body("category").trim().notEmpty().withMessage("Category is required"),
  body("program")
    .optional()
    .isIn(["morning", "afternoon", "evening"])
    .withMessage("Program must be morning, afternoon, or evening"),
  body("credits")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Credits must be a positive number"),
  body("timezone")
    .optional()
    .isString()
    .withMessage("Timezone must be a string"),
  body("weeklySchedule")
    .optional()
    .custom((value) => {
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      if (!Array.isArray(parsed))
        throw new Error("weeklySchedule must be an array");
      return true;
    }),
  body("courseDuration")
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage("courseDuration must be a short string"),
  // Legacy/optional fields maintained for backward compatibility
  body("level")
    .optional()
    .isIn(["BEGINNER", "INTERMEDIATE", "ADVANCED"])
    .withMessage("Level must be BEGINNER, INTERMEDIATE, or ADVANCED"),
  body("duration")
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage("Duration must be a positive integer (minutes)"),
  body("price")
    .optional()
    .isFloat({ min: 0, max: 10000 })
    .withMessage("Price must be between 0 and 10000"),
  body("currency")
    .optional()
    .isIn(["USD", "EUR", "GBP", "CAD"])
    .withMessage("Currency must be USD, EUR, GBP, or CAD"),
];

const updateCourseValidation = [
  ...createCourseValidation,
  param("courseId").isInt().withMessage("Invalid course ID format"),
];

const getCoursesValidation = [
  query("category").optional().isString().trim(),
  query("level").optional().isIn(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  query("search").optional().isString().trim().isLength({ max: 100 }),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("sortBy")
    .optional()
    .isIn(["title", "price", "rating", "createdAt", "students"]),
  query("sortOrder").optional().isIn(["asc", "desc"]),
  query("minPrice").optional().isFloat({ min: 0 }),
  query("maxPrice").optional().isFloat({ min: 0 }),
  query("coachId").optional().isInt({ min: 1 }),
];

/**
 * @swagger
 * /courses:
 *   get:
 *     summary: Get all courses with filtering and search
 *     tags: [Courses]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [BEGINNER, INTERMEDIATE, ADVANCED]
 *         description: Filter by difficulty level
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title and description
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of courses per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [title, price, rating, createdAt, students]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *       - in: query
 *         name: coachId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by coach ID
 *     responses:
 *       200:
 *         description: Courses retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     courses:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Course'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalCount:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean
 *                 message:
 *                   type: string
 */
router.get(
  "/",
  getCoursesValidation,
  validate,
  asyncHandler(courseController.getCourses)
);

/**
 * @swagger
 * /courses/{courseId}:
 *   get:
 *     summary: Get course details by ID
 *     tags: [Courses]
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Course details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Course'
 *                 message:
 *                   type: string
 *       404:
 *         description: Course not found
 */
router.get(
  "/:courseId",
  [param("courseId").isInt().withMessage("Invalid course ID format")],
  validate,
  asyncHandler(courseController.getCourseById)
);

/**
 * @swagger
 * /courses:
 *   post:
 *     summary: Create a new course (Coach only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - category
 *               - program
 *               - credits
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *                 example: "Advanced Calculus for High School"
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 2000
 *                 example: "Comprehensive calculus course covering derivatives, integrals, and applications"
 *               benefits:
 *                 type: string
 *                 maxLength: 2000
 *                 example: "Critical thinking, problem solving, exam readiness"
 *               category:
 *                 type: string
 *                 example: "Mathematics"
 *               program:
 *                 type: string
 *                 enum: [morning, afternoon, evening]
 *                 example: "morning"
 *               credits:
 *                 type: number
 *                 minimum: 0
 *                 example: 5
 *               currency:
 *                 type: string
 *                 enum: [USD, EUR, GBP, CAD]
 *                 default: "USD"
 *               timezone:
 *                 type: string
 *                 example: "UTC"
 *               courseDuration:
 *                 type: string
 *                 example: "12 weeks"
 *               level:
 *                 type: string
 *                 enum: [BEGINNER, INTERMEDIATE, ADVANCED]
 *               duration:
 *                 type: integer
 *                 description: Legacy duration in minutes (optional)
 *               price:
 *                 type: number
 *                 description: Legacy currency price (optional)
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *                 description: Course thumbnail image (JPEG, PNG, WebP - max 5MB)
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Course introduction video (video format - max 50MB)
 *               introVideo:
 *                 type: string
 *                 format: binary
 *                 description: Alias for course introduction video (video format - max 50MB)
 *               weeklySchedule:
 *                 type: array
 *                 description: Weekly availability schedule
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Course created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Course'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Coach access required
 */
router.post(
  "/",
  authenticate,
  authorize("COACH"),
  courseUpload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "video", maxCount: 1 },
    { name: "introVideo", maxCount: 1 },
  ]),
  createCourseValidation,
  validate,
  asyncHandler(courseController.createCourse)
);

/**
 * @swagger
 * /courses/{courseId}:
 *   put:
 *     summary: Update course (Coach only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Course ID
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 2000
 *               category:
 *                 type: string
 *               level:
 *                 type: string
 *                 enum: [BEGINNER, INTERMEDIATE, ADVANCED]
 *               duration:
 *                 type: integer
 *                 minimum: 15
 *                 maximum: 480
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 10000
 *               currency:
 *                 type: string
 *                 enum: [USD, EUR, GBP, CAD]
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *               video:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Course updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Coach access required
 *       404:
 *         description: Course not found
 */
router.put(
  "/:courseId",
  authenticate,
  authorize("COACH"),
  courseUpload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "video", maxCount: 1 },
    { name: "introVideo", maxCount: 1 },
  ]),
  updateCourseValidation,
  validate,
  asyncHandler(courseController.updateCourse)
);

/**
 * @swagger
 * /courses/{courseId}:
 *   delete:
 *     summary: Delete course (Coach only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Course deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Coach access required
 *       404:
 *         description: Course not found
 */
router.delete(
  "/:courseId",
  authenticate,
  authorize("COACH"),
  [param("courseId").isInt().withMessage("Invalid course ID format")],
  validate,
  asyncHandler(courseController.deleteCourse)
);

/**
 * @swagger
 * /courses/{courseId}/toggle-status:
 *   patch:
 *     summary: Toggle course active status (Coach only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Course status toggled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Coach access required
 *       404:
 *         description: Course not found
 */
router.patch(
  "/:courseId/toggle-status",
  authenticate,
  authorize("COACH"),
  [param("courseId").isInt().withMessage("Invalid course ID format")],
  validate,
  asyncHandler(courseController.toggleCourseStatus)
);

/**
 * @swagger
 * /courses/{courseId}/enroll:
 *   post:
 *     summary: Enroll in a course (Parent only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Course ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - childId
 *             properties:
 *               childId:
 *                 type: string
 *                 format: uuid
 *                 description: Child ID to enroll
 *     responses:
 *       201:
 *         description: Enrollment created successfully
 *       400:
 *         description: Validation error or enrollment already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Parent access required
 *       404:
 *         description: Course or child not found
 */
router.post(
  "/:courseId/enroll",
  authenticate,
  authorize("PARENT"),
  [
    param("courseId").isInt().withMessage("Invalid course ID format"),
    body("childId").isUUID().withMessage("Invalid child ID format"),
  ],
  validate,
  asyncHandler(courseController.enrollInCourse)
);

/**
 * @swagger
 * /courses/{courseId}/reviews:
 *   get:
 *     summary: Get course reviews
 *     tags: [Courses]
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Course ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of reviews per page
 *     responses:
 *       200:
 *         description: Course reviews retrieved successfully
 *       404:
 *         description: Course not found
 */
router.get(
  "/:courseId/reviews",
  [
    param("courseId").isInt().withMessage("Invalid course ID format"),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  asyncHandler(courseController.getCourseReviews)
);

/**
 * @swagger
 * /courses/{courseId}/reviews:
 *   post:
 *     summary: Add course review (Parent only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Course ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               comment:
 *                 type: string
 *                 maxLength: 1000
 *                 example: "Excellent course with great teaching methods"
 *     responses:
 *       201:
 *         description: Review added successfully
 *       400:
 *         description: Validation error or already reviewed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Parent access required
 *       404:
 *         description: Course not found
 */
router.post(
  "/:courseId/reviews",
  authenticate,
  authorize("PARENT"),
  [
    param("courseId").isInt().withMessage("Invalid course ID format"),
    body("rating")
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be between 1 and 5"),
    body("comment")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Comment must be less than 1000 characters"),
  ],
  validate,
  asyncHandler(courseController.addCourseReview)
);

export default router;
