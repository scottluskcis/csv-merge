# GitHub Copilot Instructions for CSV Merge Tool

## Project Overview

This is a TypeScript-based CSV merging tool that combines multiple CSV files with potentially different schemas into a single unified output file. The tool extracts enterprise information from filenames and maintains configurable column ordering.

## Project Structure & Architecture

### File Organization

```
src/
├── index.ts           # Main entry point and orchestration
├── types.ts           # TypeScript type definitions
├── utils.ts           # Utility functions (enterprise extraction, file handling)
├── csv-reader.ts      # CSV file reading functionality
├── csv-writer.ts      # CSV file writing functionality
└── merger.ts          # Core merging logic and processing
```

### Naming Conventions

- **TypeScript files**: Use dash-separated names (e.g., `csv-reader.ts`, `csv-writer.ts`)
- **Functions**: Use camelCase
- **Types/Interfaces**: Use PascalCase
- **Constants**: Use UPPER_SNAKE_CASE

## Key Features & Requirements

### Enterprise Column Logic

- **Always first column** in output CSV
- Extracted from filename prefix (case-insensitive)
- Mappings:
  - `ghec_` → `GHEC`
  - `ghec-emu_` → `GHEC-EMU`
  - `ghes_` → `GHES`

### File Naming Pattern

Input files must follow: `{enterprise}_{organization}_{suffix}.csv`
Examples:

- `ghec_dova_data.csv`
- `ghec-emu_dva-admin_data.csv`
- `ghes_enterprise_data.csv`

### Column Handling

- **Configurable ordering** via `column-config.json`
- **Missing columns** filled with empty strings
- **Enterprise column** always appears first, followed by configured order
- All unique columns from all files are included in output

### Output Format

- **Timestamped filenames**: `{OUTPUT_FILENAME}_{YYYYMMDD_HHMMSS}.csv`
- Example: `merged_data_20250709_143045.csv`

## Configuration

### Environment Variables (.env)

```bash
INPUT_DIR=inputs                    # Input directory path
OUTPUT_DIR=output                   # Output directory path
OUTPUT_FILENAME=merged_data         # Base output filename
COLUMN_CONFIG_FILE=column-config.json  # Column configuration file
```

### Column Configuration (column-config.json)

JSON file with array of column names in desired output order:

```json
{
  "columns": [
    "Org_Name",
    "Repo_Name",
    "Is_Empty"
    // ... more columns in desired order
  ]
}
```

## Error Handling Philosophy

- **Fail fast**: Stop processing immediately on any error
- **Detailed logging**: Console output for each step and error
- **Graceful validation**: Check file existence, permissions, and format before processing
- **Clear error messages**: Include context about which file or operation failed

## Dependencies & Libraries

### Core Dependencies

- `csv-parser`: For reading CSV files
- `csv-writer`: For writing CSV files with proper formatting
- `dotenv`: Environment variable management

### Development Dependencies

- `typescript`: Type safety and compilation
- `tsx`: TypeScript execution for development
- `@types/node`: Node.js type definitions

## Code Patterns & Best Practices

### Module Structure

Each module should export specific functionality:

- `csv-reader.ts`: `readCsvFile()`, `getCsvHeaders()`
- `csv-writer.ts`: `writeCsvFile()`
- `merger.ts`: `mergeCsvFiles()`, `processCsvMerge()`, `orderRecords()`
- `utils.ts`: `extractEnterprise()`, `generateTimestamp()`, `getCsvFiles()`

### Error Handling Pattern

```typescript
try {
  // Operation
  console.log("Success message with details");
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : "Unknown error";
  console.error(`Context: ${errorMsg}`);
  throw new Error(`Specific context: ${errorMsg}`);
}
```

### Type Safety

- Use strict TypeScript configuration
- Define interfaces for all data structures
- Use proper typing for CSV records and merged data

## Performance Considerations

### File Processing

- **Stream-based reading** for large files (up to 11,000 records)
- **Memory-efficient** processing of multiple files (~6 files typical)
- **Sequential processing** to maintain order and error handling

### Scalability

- Configurable batch sizes if needed
- Directory scanning for dynamic file discovery
- Extensible for additional enterprise types

## Testing & Validation

### Sample Data Structure

Test files should include:

- Different column sets between files
- Various enterprise prefixes
- Different record counts
- Edge cases (empty files, missing columns)

### Validation Points

- File existence and readability
- Enterprise prefix recognition
- Column configuration validity
- Output file creation and format

## Future Enhancement Guidelines

### When Adding Features

1. **Maintain modular structure** - add new functionality in appropriate modules
2. **Update types** - add new interfaces/types in `types.ts`
3. **Follow error handling patterns** - consistent error reporting
4. **Update configuration** - extend environment variables or config files as needed
5. **Document changes** - update README.md and this file

### Common Extension Points

- **New enterprise types**: Add to `ENTERPRISE_MAPPING` in `utils.ts`
- **Additional validation**: Extend validation functions
- **Output formats**: Create new writer modules
- **Data transformation**: Add processing steps in merger logic

## Command Reference

### Development Commands

```bash
npm run dev          # Watch mode development
npm run build        # Compile TypeScript
npm start           # Run compiled version
npm run start:prod  # Production execution
```

### File Operations

- Input files: Place in `inputs/` directory
- Output files: Generated in `output/` directory
- Configuration: Modify `column-config.json` for column ordering

## Troubleshooting Common Issues

### File Processing Errors

- Check file permissions and format
- Verify enterprise prefix in filename
- Validate CSV structure and headers

### Configuration Issues

- Ensure `column-config.json` exists and is valid JSON
- Check environment variable values
- Verify input/output directory paths

### Output Problems

- Check output directory permissions
- Verify timestamp generation
- Validate column ordering configuration

---

## Notes for GitHub Copilot

When working on this project:

1. **Always check current file contents** before making edits
2. **Follow the established patterns** for error handling and logging
3. **Maintain type safety** throughout all changes
4. **Use the existing module structure** rather than creating new files unless necessary
5. **Test changes** with the provided sample data
6. **Update documentation** when adding new features or changing behavior
