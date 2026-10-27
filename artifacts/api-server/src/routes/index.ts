import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import workspaceRouter from "./workspace";
import managementRouter from "./management";
import tasksRouter from "./tasks";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(requireAuth);
router.use(workspaceRouter);
router.use(managementRouter);
router.use(tasksRouter);

export default router;
