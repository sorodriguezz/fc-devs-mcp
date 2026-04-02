import type { ISqlServerRepository, SqlServerExecutionResult } from "../../interfaces/ISqlServerRepository.js";

export class ExecSqlServerUseCase {
  constructor(private readonly sqlServerRepo: ISqlServerRepository) {}

  async execute(query: string, maxRows?: number): Promise<SqlServerExecutionResult> {
    return this.sqlServerRepo.executeSql(query, maxRows);
  }
}
