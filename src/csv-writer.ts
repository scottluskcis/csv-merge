import fs from "fs";
import { createObjectCsvWriter } from "csv-writer";
import { MergedRecord } from "./types";
import { ensureDirectoryExists } from "./utils";

/**
 * Write merged records to CSV file
 * @param records - Array of merged records
 * @param outputPath - Output file path
 * @param columns - Ordered column names
 */
export async function writeCsvFile(
  records: MergedRecord[],
  outputPath: string,
  columns: string[]
): Promise<void> {
  try {
    // Ensure output directory exists
    const outputDir = outputPath.substring(0, outputPath.lastIndexOf("/"));
    ensureDirectoryExists(outputDir);

    // Create CSV writer with ordered columns
    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: columns.map((col) => ({ id: col, title: col })),
    });

    // Write records to file
    await csvWriter.writeRecords(records);
    console.log(
      `Successfully wrote ${records.length} records to ${outputPath}`
    );
  } catch (error) {
    throw new Error(
      `Error writing CSV file ${outputPath}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
