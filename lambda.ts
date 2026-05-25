import serverless from "serverless-http";
import dotenv from "dotenv";
dotenv.config();

import { app } from "./server-app.js";

// AWS Lambda handler — API Gateway or Lambda Function URL both work with this.
export const handler = serverless(app);
