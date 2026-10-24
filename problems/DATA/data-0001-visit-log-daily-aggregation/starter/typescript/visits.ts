export interface Row {
  date: string;
  department: string;
  visits: number;
  patients: number;
}

export interface RowError {
  line: number;
  reason: string;
}

// 受付ログ CSV を日本時間の日付×診療科で集計する
export function aggregateVisits(csvText: string): { rows: Row[]; errors: RowError[] } {
  throw new Error("not implemented");
}
