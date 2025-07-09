import fs from "fs";
import path from "path";
import { EnterpriseMapping } from "./types";

export const ENTERPRISE_MAPPING: EnterpriseMapping = {
  ghec: "GHEC",
  "ghec-emu": "GHEC-EMU",
  ghes: "GHES",
};

/**
 * Extract enterprise from filename
 * @param filename - The CSV filename
 * @returns The enterprise string or throws error if not found
 */
export function extractEnterprise(filename: string): string {
  const basename = path.basename(filename, ".csv");
  const firstUnderscore = basename.indexOf("_");

  if (firstUnderscore === -1) {
    throw new Error(
      `Invalid filename format: ${filename}. Expected format: enterprise_org_data.csv`
    );
  }

  const enterprisePrefix = basename.substring(0, firstUnderscore).toLowerCase();
  const enterprise = ENTERPRISE_MAPPING[enterprisePrefix];

  if (!enterprise) {
    throw new Error(
      `Unknown enterprise prefix: ${enterprisePrefix} in file ${filename}`
    );
  }

  return enterprise;
}

/**
 * Generate timestamp string for filename
 * @returns Timestamp in YYYYMMDD_HHMMSS format
 */
export function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Ensure directory exists
 * @param dirPath - Path to directory
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get all CSV files from directory
 * @param inputDir - Input directory path
 * @returns Array of CSV file paths
 */
export function getCsvFiles(inputDir: string): string[] {
  if (!fs.existsSync(inputDir)) {
    throw new Error(`Input directory does not exist: ${inputDir}`);
  }

  const files = fs.readdirSync(inputDir);
  const csvFiles = files
    .filter((file) => file.toLowerCase().endsWith(".csv"))
    .map((file) => path.join(inputDir, file));

  if (csvFiles.length === 0) {
    throw new Error(`No CSV files found in directory: ${inputDir}`);
  }

  return csvFiles;
}
