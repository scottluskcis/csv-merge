import dotenv from "dotenv";
import path from "path";
import { processCsvMerge } from "./merger";

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Get configuration from environment variables
    const inputDir = process.env.INPUT_DIR || "inputs";
    const outputDir = process.env.OUTPUT_DIR || "output";
    const outputFilename = process.env.OUTPUT_FILENAME || "merged_data";
    const columnConfigFile =
      process.env.COLUMN_CONFIG_FILE || "column-config.json";

    // Resolve paths relative to project root
    const projectRoot = path.dirname(__dirname);
    const inputPath = path.resolve(projectRoot, inputDir);
    const outputPath = path.resolve(projectRoot, outputDir);
    const columnConfigPath = path.resolve(projectRoot, columnConfigFile);

    console.log("📊 CSV Merge Tool");
    console.log("==================");
    console.log(`Input directory: ${inputPath}`);
    console.log(`Output directory: ${outputPath}`);
    console.log(`Column config: ${columnConfigPath}`);
    console.log("");

    // Process CSV merge
    await processCsvMerge(
      inputPath,
      outputPath,
      outputFilename,
      columnConfigPath
    );

    console.log("✅ CSV merge completed successfully!");
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}

// Run the main function
main();
