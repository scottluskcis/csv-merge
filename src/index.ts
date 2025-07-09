import dotenv from "dotenv";

// Load environment variables
dotenv.config();

console.log("Hello TypeScript with ESM!");
console.log("Environment variable:", process.env.NODE_ENV || "not set");
