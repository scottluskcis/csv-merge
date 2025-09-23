import fs from "fs";
import path from "path";
import {
  CsvRecord,
  MergedRecord,
  ColumnConfig,
  ProcessingResult,
  JoinConfig,
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

    // Validate joinConfig if present
    if (config.joinConfig) {
      if (!config.joinConfig.joinKey || !config.joinConfig.newColumn) {
        throw new Error(
          'Invalid join configuration: "joinKey" and "newColumn" are required when joinConfig is specified'
        );
      }
    }

    const removeCount = config.columnsToRemove?.length || 0;
    const joinInfo = config.joinConfig ? ` with join on "${config.joinConfig.joinKey}"` : "";
    console.log(
      `Loaded column configuration with ${config.columns.length} columns${
        removeCount > 0 ? ` and ${removeCount} columns to remove` : ""
      }${joinInfo}`
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
 * Join two CSV files with lookup functionality
 * @param inputDir - Directory containing CSV files
 * @param columnConfig - Column configuration with join settings
 * @returns Processing result with joined records
 */
export async function joinCsvFiles(
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
    if (!columnConfig.joinConfig) {
      throw new Error("Join configuration is required for join operation");
    }

    // Get all CSV files
    const csvFiles = getCsvFiles(inputDir);
    result.totalFiles = csvFiles.length;

    if (csvFiles.length !== 2) {
      throw new Error(`Join operation requires exactly 2 CSV files, found ${csvFiles.length}`);
    }

    console.log(`Found ${csvFiles.length} CSV files for join operation`);

    // Sort files to ensure consistent ordering: primary file should be the one with more columns (FILE 1)
    // The teams file should be the smaller lookup file (FILE 2)
    const file1Headers = await getCsvHeaders(csvFiles[0]);
    const file2Headers = await getCsvHeaders(csvFiles[1]);
    
    let primaryFilePath: string;
    let lookupFilePath: string;
    
    // Determine which file is the primary based on column count (FILE 1 has more columns)
    if (file1Headers.length >= file2Headers.length) {
      primaryFilePath = csvFiles[0];
      lookupFilePath = csvFiles[1];
    } else {
      primaryFilePath = csvFiles[1];
      lookupFilePath = csvFiles[0];
    }

    const { joinKey, newColumn } = columnConfig.joinConfig;

    console.log(`Processing primary file: ${path.basename(primaryFilePath)}`);
    console.log(`Processing lookup file: ${path.basename(lookupFilePath)}`);

    // Read both files
    const primaryRecords = await readCsvFile(primaryFilePath);
    const lookupRecords = await readCsvFile(lookupFilePath);

    // Extract enterprise from primary filename
    const enterprise = extractEnterprise(path.basename(primaryFilePath));

    // Create lookup set from the second file for fast matching
    const lookupSet = new Set<string>();
    lookupRecords.forEach((record) => {
      const lookupValue = record[joinKey];
      if (lookupValue) {
        lookupSet.add(lookupValue);
      }
    });

    console.log(`Created lookup set with ${lookupSet.size} unique ${joinKey} values`);

    // Process primary records and add the new column
    const joinedRecords: MergedRecord[] = primaryRecords.map((record) => {
      const lookupValue = record[joinKey];
      const isMatch = lookupValue && lookupSet.has(lookupValue);
      
      return {
        Enterprise: enterprise,
        ...record,
        [newColumn]: isMatch ? "TRUE" : "FALSE",
      };
    });

    result.records = joinedRecords;
    result.totalRecords = joinedRecords.length;
    result.success = true;

    console.log(
      `✅ Successfully joined ${result.totalRecords} records with ${lookupSet.size} lookup values`
    );
  } catch (error) {
    result.success = false;
    const errorMsg =
      error instanceof Error
        ? error.message
        : "Unknown error during join process";
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

    let result: ProcessingResult;

    // Check if this is a join operation or traditional merge
    if (columnConfig.joinConfig) {
      console.log("Detected join configuration - performing join operation");
      result = await joinCsvFiles(inputDir, columnConfig);
    } else {
      console.log("Performing traditional merge operation");
      result = await mergeCsvFiles(inputDir, columnConfig);
    }

    if (!result.success) {
      throw new Error(`${columnConfig.joinConfig ? 'Join' : 'Merge'} failed: ${result.errors.join(", ")}`);
    }

    // Count warnings (non-error messages)
    const warnings = result.errors.filter((error) => error.includes("⚠️"));
    const actualErrors = result.errors.filter((error) => !error.includes("⚠️"));

    if (actualErrors.length > 0) {
      throw new Error(`${columnConfig.joinConfig ? 'Join' : 'Merge'} failed: ${actualErrors.join(", ")}`);
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

    console.log(`\n=== CSV ${columnConfig.joinConfig ? 'Join' : 'Merge'} Summary ===`);
    console.log(`Files processed: ${result.totalFiles}`);
    console.log(`Total records: ${result.totalRecords}`);
    console.log(`Output file: ${outputPath}`);
    console.log(`Columns: ${orderedColumns.length}`);
    if (columnConfig.joinConfig) {
      console.log(`Join key: ${columnConfig.joinConfig.joinKey}`);
      console.log(`New column: ${columnConfig.joinConfig.newColumn}`);
    }
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
    console.error(`CSV operation failed: ${errorMsg}`);
    throw error;
  }
}
