import fs from "fs";
import csv from "csv-parser";
import { CsvRecord } from "./types";

/**
 * Read and parse a CSV file
 * @param filePath - Path to the CSV file
 * @returns Promise that resolves to array of records
 */
export function readCsvFile(filePath: string): Promise<CsvRecord[]> {
  return new Promise((resolve, reject) => {
    const records: CsvRecord[] = [];

    if (!fs.existsSync(filePath)) {
      reject(new Error(`File does not exist: ${filePath}`));
      return;
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row: CsvRecord) => {
        records.push(row);
      })
      .on("end", () => {
        console.log(
          `Successfully read ${records.length} records from ${filePath}`
        );
        resolve(records);
      })
      .on("error", (error) => {
        reject(
          new Error(`Error reading CSV file ${filePath}: ${error.message}`)
        );
      });
  });
}

/**
 * Get column headers from a CSV file without reading all data
 * @param filePath - Path to the CSV file
 * @returns Promise that resolves to array of column names
 */
export function getCsvHeaders(filePath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error(`File does not exist: ${filePath}`));
      return;
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("headers", (headers: string[]) => {
        resolve(headers);
      })
      .on("error", (error) => {
        reject(
          new Error(
            `Error reading CSV headers from ${filePath}: ${error.message}`
          )
        );
      });
  });
}
