export interface PatientRecord {
  id: string;
  name_kana: string;
  birth_date: string;
  phone: string | null;
}

export interface DedupeResult {
  merge: string[][];
  review: string[][];
  invalid: string[];
}

// 同一人物候補を merge / review / invalid に分ける
export function findDuplicates(records: PatientRecord[]): DedupeResult {
  throw new Error("not implemented");
}
