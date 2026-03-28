import type { IIrisRepository, SqlExecutionResult } from "../../interfaces/IIrisRepository.js";

export class ExecSQLUseCase {
  constructor(private readonly irisRepo: IIrisRepository) {}

  async execute(sql: string, maxRows?: number): Promise<SqlExecutionResult> {
    return this.irisRepo.executeSql(sql, maxRows);
  }
}
