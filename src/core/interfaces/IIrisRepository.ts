export interface IIrisRepository {
  executeSql(query: string, maxRows?: number): Promise<any[]>;
  close(): Promise<void>;
}
