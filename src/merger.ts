import fs from "fs";
import path from "path";
import {
  CsvRecord,
  MergedRecord,
  ColumnConfig,
  ProcessingResult,
} from "./types";
import { readCsvFile } from "./csv-reader";
import { writeCsvFile } from "./csv-writer";
import { extractEnterprise, getCsvFiles, generateTimestamp } from "./utils";

/**
 * Load column configuration from JSON file
 * @param configPath - Path to column configuration file
 * @returns Column configuration object
 */
export function loadColumnConfig(configPath: string): ColumnConfig {
  try {
    if (!fs.existsSync(configPath)) {
      throw new Error(
        `Column configuration file does not exist: ${configPath}`
      );
    }

    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent) as ColumnConfig;

    if (!config.columns || !Array.isArray(config.columns)) {
      throw new Error(
        'Invalid column configuration: "columns" array is required'
      );
    }

    console.log(
      `Loaded column configuration with ${config.columns.length} columns`
    );
    return config;
  } catch (error) {
    throw new Error(
      `Error loading column configuration: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Merge multiple CSV files into a single dataset
 * @param inputDir - Directory containing CSV files
 * @param columnConfig - Column configuration
 * @returns Processing result with merged records
 */
export async function mergeCsvFiles(
  inputDir: string,
  columnConfig: ColumnConfig
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    success: false,
    records: [],
    totalFiles: 0,
    totalRecords: 0,
    errors: [],
  };

  try {
    // Get all CSV files
    const csvFiles = getCsvFiles(inputDir);
    result.totalFiles = csvFiles.length;

    console.log(`Found ${csvFiles.length} CSV files to process`);

    // Process each file
    for (const filePath of csvFiles) {
      try {
        console.log(`Processing file: ${path.basename(filePath)}`);

        // Extract enterprise from filename
        const enterprise = extractEnterprise(path.basename(filePath));

        // Read CSV records
        const records = await readCsvFile(filePath);

        // Transform records to include enterprise column
        const transformedRecords: MergedRecord[] = records.map((record) => ({
          Enterprise: enterprise,
          ...record,
        }));

        result.records.push(...transformedRecords);
        result.totalRecords += records.length;

        console.log(
          `Added ${records.length} records from ${path.basename(
            filePath
          )} (Enterprise: ${enterprise})`
        );
      } catch (fileError) {
        const errorMsg = `Error processing file ${path.basename(filePath)}: ${
          fileError instanceof Error ? fileError.message : "Unknown error"
        }`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
        throw new Error(errorMsg); // Stop processing on any file error
      }
    }

    result.success = true;
    console.log(
      `Successfully merged ${result.totalRecords} records from ${result.totalFiles} files`
    );
  } catch (error) {
    result.success = false;
    const errorMsg =
      error instanceof Error
        ? error.message
        : "Unknown error during merge process";
    if (!result.errors.includes(errorMsg)) {
      result.errors.push(errorMsg);
    }
  }

  return result;
}

/**
 * Order records according to column configuration
 * @param records - Merged records
 * @param columnConfig - Column configuration
 * @returns Records with consistent column ordering
 */
export function orderRecords(
  records: MergedRecord[],
  columnConfig: ColumnConfig
): MergedRecord[] {
  // Create ordered column list with Enterprise first
  const orderedColumns = ["Enterprise", ...columnConfig.columns];

  return records.map((record) => {
    const orderedRecord: MergedRecord = { Enterprise: "" };

    // Add columns in specified order
    for (const column of orderedColumns) {
      orderedRecord[column] = record[column] || "";
    }

    return orderedRecord;
  });
}

/**
 * Process CSV merge operation
 * @param inputDir - Input directory path
 * @param outputDir - Output directory path
 * @param outputFilename - Base output filename
 * @param columnConfigPath - Path to column configuration file
 */
export async function processCsvMerge(
  inputDir: string,
  outputDir: string,
  outputFilename: string,
  columnConfigPath: string
): Promise<void> {
  try {
    console.log("Starting CSV merge process...");
    console.log(`Input directory: ${inputDir}`);
    console.log(`Output directory: ${outputDir}`);
    console.log(`Column config: ${columnConfigPath}`);

    // Load column configuration
    const columnConfig = loadColumnConfig(columnConfigPath);

    // Merge CSV files
    const result = await mergeCsvFiles(inputDir, columnConfig);

    if (!result.success) {
      throw new Error(`Merge failed: ${result.errors.join(", ")}`);
    }

    // Order records according to configuration
    const orderedRecords = orderRecords(result.records, columnConfig);

    // Generate output filename with timestamp
    const timestamp = generateTimestamp();
    const outputPath = path.join(
      outputDir,
      `${outputFilename}_${timestamp}.csv`
    );

    // Create ordered column list for CSV writer
    const orderedColumns = ["Enterprise", ...columnConfig.columns];

    // Write merged data to output file
    await writeCsvFile(orderedRecords, outputPath, orderedColumns);

    console.log("\n=== CSV Merge Summary ===");
    console.log(`Files processed: ${result.totalFiles}`);
    console.log(`Total records: ${result.totalRecords}`);
    console.log(`Output file: ${outputPath}`);
    console.log(`Columns: ${orderedColumns.length}`);
    console.log("=========================\n");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`CSV merge failed: ${errorMsg}`);
    throw error;
  }
}
