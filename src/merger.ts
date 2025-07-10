import fs from "fs";
import path from "path";
import {
  CsvRecord,
  MergedRecord,
  ColumnConfig,
  ProcessingResult,
} from "./types";
import { readCsvFile, getCsvHeaders } from "./csv-reader";
import { writeCsvFile } from "./csv-writer";
import { extractEnterprise, getCsvFiles, generateTimestamp } from "./utils";

/**
 * Validate columns against configuration and generate warnings
 * @param filePath - Path to the CSV file being processed
 * @param headers - Column headers from the CSV file
 * @param columnConfig - Column configuration
 * @returns Object with filtered headers and any warnings
 */
function validateAndFilterColumns(
  filePath: string,
  headers: string[],
  columnConfig: ColumnConfig
): { filteredHeaders: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const configuredColumns = new Set(columnConfig.columns);
  const columnsToRemove = new Set(columnConfig.columnsToRemove || []);

  // Check for unexpected columns (not in config and not marked for removal)
  const unexpectedColumns = headers.filter(
    (header) => !configuredColumns.has(header) && !columnsToRemove.has(header)
  );

  if (unexpectedColumns.length > 0) {
    const warningMsg = `⚠️  File "${path.basename(
      filePath
    )}" contains unexpected columns not in configuration: [${unexpectedColumns.join(
      ", "
    )}]`;
    warnings.push(warningMsg);
    console.warn(warningMsg);
  }

  // Filter out columns marked for removal
  const filteredHeaders = headers.filter(
    (header) => !columnsToRemove.has(header)
  );

  if (columnsToRemove.size > 0) {
    const removedColumns = headers.filter((header) =>
      columnsToRemove.has(header)
    );
    if (removedColumns.length > 0) {
      console.log(
        `🗑️  Removed columns from "${path.basename(
          filePath
        )}": [${removedColumns.join(", ")}]`
      );
    }
  }

  return { filteredHeaders, warnings };
}

/**
 * Filter record to remove specified columns
 * @param record - Original CSV record
 * @param columnsToRemove - Set of column names to remove
 * @returns Filtered record without removed columns
 */
function filterRecord(
  record: CsvRecord,
  columnsToRemove: Set<string>
): CsvRecord {
  const filteredRecord: CsvRecord = {};

  for (const [key, value] of Object.entries(record)) {
    if (!columnsToRemove.has(key)) {
      filteredRecord[key] = value;
    }
  }

  return filteredRecord;
}

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

    // Validate columnsToRemove if present
    if (config.columnsToRemove && !Array.isArray(config.columnsToRemove)) {
      throw new Error(
        'Invalid column configuration: "columnsToRemove" must be an array if specified'
      );
    }

    const removeCount = config.columnsToRemove?.length || 0;
    console.log(
      `Loaded column configuration with ${config.columns.length} columns${
        removeCount > 0 ? ` and ${removeCount} columns to remove` : ""
      }`
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

    const columnsToRemove = new Set(columnConfig.columnsToRemove || []);

    // Process each file
    for (const filePath of csvFiles) {
      try {
        console.log(`Processing file: ${path.basename(filePath)}`);

        // Extract enterprise from filename
        const enterprise = extractEnterprise(path.basename(filePath));

        // Get headers first to validate columns
        const headers = await getCsvHeaders(filePath);
        const { filteredHeaders, warnings } = validateAndFilterColumns(
          filePath,
          headers,
          columnConfig
        );

        // Add any warnings to the result
        result.errors.push(...warnings);

        // Read CSV records
        const records = await readCsvFile(filePath);

        // Filter records to remove specified columns and transform to include enterprise
        const transformedRecords: MergedRecord[] = records.map((record) => {
          const filteredRecord = filterRecord(record, columnsToRemove);
          return {
            Enterprise: enterprise,
            ...filteredRecord,
          };
        });

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
      `✅ Successfully merged ${result.totalRecords} records from ${result.totalFiles} files`
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

    // Count warnings (non-error messages)
    const warnings = result.errors.filter((error) => error.includes("⚠️"));
    const actualErrors = result.errors.filter((error) => !error.includes("⚠️"));

    if (actualErrors.length > 0) {
      throw new Error(`Merge failed: ${actualErrors.join(", ")}`);
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
    if (warnings.length > 0) {
      console.log(`Warnings: ${warnings.length}`);
    }
    if (
      columnConfig.columnsToRemove &&
      columnConfig.columnsToRemove.length > 0
    ) {
      console.log(`Columns removed: ${columnConfig.columnsToRemove.length}`);
    }
    console.log("=========================\n");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`CSV merge failed: ${errorMsg}`);
    throw error;
  }
}
