export interface CsvRecord {
  [key: string]: string;
}

export interface MergedRecord extends CsvRecord {
  Enterprise: string;
}

export interface ColumnConfig {
  columns: string[];
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
