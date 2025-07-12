import fs from "fs";
import path from "path";
import {
  CsvRecord,
  MergedRecord,
  ColumnConfig,
  ProcessingResult,
  DuplicateCheckResult,
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

    // Validate duplicateCheckColumns if present
    if (
      config.duplicateCheckColumns &&
      !Array.isArray(config.duplicateCheckColumns)
    ) {
      throw new Error(
        'Invalid column configuration: "duplicateCheckColumns" must be an array if specified'
      );
    }

    const removeCount = config.columnsToRemove?.length || 0;
    const duplicateCheckCount = config.duplicateCheckColumns?.length || 0;
    console.log(
      `Loaded column configuration with ${config.columns.length} columns${
        removeCount > 0 ? `, ${removeCount} columns to remove` : ""
      }${
        duplicateCheckCount > 0
          ? `, ${duplicateCheckCount} columns to check for duplicates`
          : ""
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
 * Check for duplicate values in specified columns
 * @param records - Array of merged records to check
 * @param columnsToCheck - Array of column names to check for duplicates
 * @returns Array of duplicate check results
 */
export function checkForDuplicates(
  records: MergedRecord[],
  columnsToCheck: string[]
): DuplicateCheckResult[] {
  const results: DuplicateCheckResult[] = [];

  for (const column of columnsToCheck) {
    // Check if the column exists in the records
    const columnExists = records.length > 0 && column in records[0];
    if (!columnExists) {
      console.warn(
        `⚠️  Column "${column}" not found in merged data - skipping duplicate check`
      );
      continue;
    }

    // Track value occurrences with row numbers
    const valueMap = new Map<string, { count: number; rowNumbers: number[] }>();

    records.forEach((record, index) => {
      const value = record[column] || "";
      // Skip empty values in duplicate check
      if (value.trim() === "") {
        return;
      }

      const rowNumber = index + 2; // +2 because: +1 for 1-based indexing, +1 for header row

      if (valueMap.has(value)) {
        const existing = valueMap.get(value)!;
        existing.count++;
        existing.rowNumbers.push(rowNumber);
      } else {
        valueMap.set(value, { count: 1, rowNumbers: [rowNumber] });
      }
    });

    // Find duplicates (values that appear more than once)
    const duplicateValues = Array.from(valueMap.entries())
      .filter(([_, data]) => data.count > 1)
      .map(([value, data]) => ({
        value,
        count: data.count,
        rowNumbers: data.rowNumbers,
      }))
      .sort((a, b) => b.count - a.count); // Sort by count descending

    results.push({
      column,
      duplicateValues,
    });
  }

  return results;
}

/**
 * Display duplicate check results
 * @param duplicateResults - Array of duplicate check results
 */
export function displayDuplicateResults(
  duplicateResults: DuplicateCheckResult[]
): void {
  if (duplicateResults.length === 0) {
    return;
  }

  let totalDuplicatesFound = 0;

  console.log("\n🔍 Duplicate Check Results");
  console.log("===========================");

  for (const result of duplicateResults) {
    if (result.duplicateValues.length === 0) {
      console.log(`✅ Column "${result.column}": No duplicates found`);
    } else {
      console.log(
        `❌ Column "${result.column}": ${result.duplicateValues.length} duplicate value(s) found`
      );
      totalDuplicatesFound += result.duplicateValues.length;

      result.duplicateValues.forEach((duplicate, index) => {
        const rowList =
          duplicate.rowNumbers.length > 5
            ? `${duplicate.rowNumbers.slice(0, 5).join(", ")} ... (${
                duplicate.rowNumbers.length - 5
              } more)`
            : duplicate.rowNumbers.join(", ");

        console.log(
          `  ${index + 1}. "${duplicate.value}" appears ${
            duplicate.count
          } times (rows: ${rowList})`
        );
      });
    }
    console.log("");
  }

  if (totalDuplicatesFound > 0) {
    console.log(
      `📊 Summary: ${totalDuplicatesFound} duplicate value(s) found across all checked columns`
    );
  } else {
    console.log("📊 Summary: No duplicates found in any checked columns");
  }
  console.log("===========================\n");
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

    // Perform duplicate checks if configured
    if (
      columnConfig.duplicateCheckColumns &&
      columnConfig.duplicateCheckColumns.length > 0
    ) {
      const duplicateResults = checkForDuplicates(
        orderedRecords,
        columnConfig.duplicateCheckColumns
      );
      displayDuplicateResults(duplicateResults);
    }

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
    if (
      columnConfig.duplicateCheckColumns &&
      columnConfig.duplicateCheckColumns.length > 0
    ) {
      console.log(
        `Duplicate checks performed: ${columnConfig.duplicateCheckColumns.length} columns`
      );
    }
    console.log("=========================\n");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`CSV merge failed: ${errorMsg}`);
    throw error;
  }
}
