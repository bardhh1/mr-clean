import { validateEnvironment } from "../config/env.validation";

validateEnvironment(process.env);
console.log("Runtime environment validation passed before database migration.");
