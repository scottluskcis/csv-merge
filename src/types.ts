export interface CsvRecord {
  [key: string]: string;
}

export interface MergedRecord extends CsvRecord {
  Enterprise: string;
  [key: string]: string; // Allow additional string properties
}

export interface ColumnConfig {
  columns: string[];
  columnsToRemove?: string[];
  duplicateCheckColumns?: string[];
}

export interface EnterpriseMapping {
  [key: string]: string;
}

export interface ProcessingResult {
  success: boolean;
  records: MergedRecord[];
  totalFiles: number;
  totalRecords: number;
  errors: string[];
}

export interface DuplicateCheckResult {
  column: string;
  duplicateValues: {
    value: string;
    count: number;
    rowNumbers: number[];
  }[];
}
