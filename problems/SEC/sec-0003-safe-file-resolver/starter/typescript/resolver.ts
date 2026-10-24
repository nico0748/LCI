export class PathError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export function resolveUserFile(baseDir: string, userPath: string): string {
  throw new Error("not implemented");
}
