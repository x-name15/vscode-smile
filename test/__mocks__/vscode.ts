/**
 * @fileoverview Mock implementation of VS Code API for Vitest node environment.
 */

export class Uri {
  public scheme: string;
  public fsPath: string;

  constructor(fsPath: string, scheme = "file") {
    this.fsPath = fsPath;
    this.scheme = scheme;
  }

  public static file(path: string): Uri {
    return new Uri(path, "file");
  }

  public toString(): string {
    return `${this.scheme}://${this.fsPath}`;
  }
}

export class Range {
  constructor(
    public startLine: number,
    public startCharacter: number,
    public endLine: number,
    public endCharacter: number
  ) {}
}

export const workspace = {
  getWorkspaceFolder: (_uri: Uri) => undefined,
  getConfiguration: (_section?: string, _scope?: Uri) => ({
    get: <T>(_key: string, defaultValue?: T): T | undefined => defaultValue,
  }),
  createFileSystemWatcher: () => ({
    onDidChange: () => ({ dispose: () => {} }),
    onDidCreate: () => ({ dispose: () => {} }),
    onDidDelete: () => ({ dispose: () => {} }),
    dispose: () => {},
  }),
};
