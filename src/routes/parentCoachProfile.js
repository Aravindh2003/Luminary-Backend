import express from "express";
import { param } from "express-validator";
import validate from "../middleware/validation.js";
import {
  getCoachProfileForParent,
  getCoachProfileByCourseId,
} from "../controllers/parentCoachProfile.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();

// Publicly fetch coach profile by coachId (for Parent dashboard)
router.get(
  "/coach/:coachId",
  [param("coachId").isString().withMessage("Invalid coach ID format")],
  validate,
  asyncHandler(getCoachProfileForParent)
);

// Publicly fetch coach profile by courseId (for Parent dashboard)
router.get(
  "/coach/by-course/:courseId",
  [param("courseId").isInt().withMessage("Invalid course ID format")],
  validate,
  asyncHandler(getCoachProfileByCourseId)
);

export default router;
