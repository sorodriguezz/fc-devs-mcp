export type GlobalNodeState = 0 | 1 | 10 | 11;

export interface GlobalNode {
  readonly key: string;
  readonly value: string | number | null;
}

export interface GlobalExistsResult {
  readonly exists: boolean;
  readonly hasValue: boolean;
  readonly hasChildren: boolean;
  readonly state: GlobalNodeState;
}

export interface IIrisGlobalsRepository {
  get(globalName: string, subscripts?: string[]): Promise<string | number | null>;
  set(globalName: string, value: string | number, subscripts?: string[]): Promise<void>;
  kill(globalName: string, subscripts?: string[]): Promise<void>;
  exists(globalName: string, subscripts?: string[]): Promise<GlobalExistsResult>;
  list(
    globalName: string,
    subscripts?: string[],
    options?: { reversed?: boolean; startFrom?: string; maxItems?: number },
  ): Promise<GlobalNode[]>;
  increment(globalName: string, subscripts?: string[], delta?: number): Promise<number>;
}
