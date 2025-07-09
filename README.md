# CSV Merge Tool

A TypeScript-based tool for merging multiple CSV files with different schemas into a single unified CSV file.

## Features

- **Enterprise Column Extraction**: Automatically extracts enterprise information from filenames and adds as the first column
- **Configurable Column Ordering**: Uses a JSON configuration file to specify the exact order of columns in the output
- **Schema Flexibility**: Handles CSV files with different column sets - missing columns are filled with empty values
- **Timestamp Output**: Automatically generates timestamped output filenames
- **Error Handling**: Stops processing and reports errors if any file fails to process
- **Modular Architecture**: Clean separation of concerns with dedicated modules for reading, writing, and merging

## Project Structure

```
├── src/
│   ├── index.ts           # Main entry point
│   ├── types.ts           # TypeScript type definitions
│   ├── utils.ts           # Utility functions
│   ├── csv-reader.ts      # CSV reading functionality
│   ├── csv-writer.ts      # CSV writing functionality
│   └── merger.ts          # Core merging logic
├── inputs/                # Directory for input CSV files
├── output/                # Directory for merged output files
├── column-config.json     # Column ordering configuration
├── .env                   # Environment configuration
└── package.json
```

## Configuration

### Environment Variables (.env)

```bash
# CSV Merge Configuration
INPUT_DIR=inputs
OUTPUT_DIR=output
OUTPUT_FILENAME=merged_data
COLUMN_CONFIG_FILE=column-config.json
```

### Column Configuration (column-config.json)

Define the exact order of columns in the output file:

```json
{
  "columns": [
    "Org_Name",
    "Repo_Name",
    "Is_Empty",
    "Last_Push",
    "Last_Update",
    "isFork",
    "isArchived",
    "Repo_Size_mb",
    "Record_Count",
    "Collaborator_Count",
    "Protected_Branch_Count",
    "PR_Review_Count",
    "Milestone_Count",
    "Issue_Count",
    "PR_Count",
    "PR_Review_Comment_Count",
    "Commit_Comment_Count",
    "Issue_Comment_Count",
    "Issue_Event_Count",
    "Release_Count",
    "Project_Count",
    "Branch_Count",
    "Tag_Count",
    "Discussion_Count",
    "Has_Wiki",
    "Full_URL",
    "Migration_Issue",
    "Created"
  ]
}
```

## File Naming Convention

Input CSV files must follow this naming pattern:

```
{enterprise}_{organization}_{suffix}.csv
```

### Enterprise Mapping (case-insensitive)

- `ghec_` → `GHEC`
- `ghec-emu_` → `GHEC-EMU`
- `ghes_` → `GHES`

### Examples

- `ghec_dova_data.csv` → Enterprise: `GHEC`
- `ghec-emu_dva-admin_data.csv` → Enterprise: `GHEC-EMU`
- `ghes_enterprise_data.csv` → Enterprise: `GHES`

## Usage

### Installation

```bash
npm install
```

### Running the Tool

```bash
# Development mode (with file watching)
npm run dev

# Production mode
npm run build
npm start

# Direct execution
npm start
```

### Output

The tool generates a CSV file with:

- **Timestamp**: Format `YYYYMMDD_HHMMSS`
- **Enterprise Column**: Always first column
- **Ordered Columns**: As specified in `column-config.json`
- **Missing Values**: Empty strings for columns not present in source files

Example output filename: `merged_data_20250709_143045.csv`

## Error Handling

The tool will stop processing and exit with an error if:

- Input directory doesn't exist or contains no CSV files
- Any CSV file is malformed or unreadable
- Unknown enterprise prefix in filename
- Column configuration file is missing or invalid

## Example Output

```csv
Enterprise,Org_Name,Repo_Name,Is_Empty,Last_Push,Last_Update,isFork,isArchived,...
GHEC,dova,project-alpha,false,2024-01-15,2024-01-16,false,false,...
GHEC-EMU,dva-admin,secure-app,false,2024-01-20,2024-01-22,false,false,...
GHES,enterprise,legacy-system,false,2024-01-05,2024-01-08,false,true,...
```

## Dependencies

- `csv-parser`: For parsing CSV files
- `csv-writer`: For writing CSV files
- `dotenv`: For environment variable management
- `typescript`: For type safety
- `tsx`: For TypeScript execution

## Performance

The tool is optimized for:

- Files up to 11,000 records
- Processing ~6 files simultaneously
- Memory-efficient streaming for large datasets
