import type { IIrisRepository } from "../../interfaces/IIrisRepository.js";

export class ExecSQLUseCase {
  constructor(private readonly irisRepo: IIrisRepository) {}

  async execute(sql: string) {
    // const forbidden = ["delete", "drop", "truncate", "update"];
    // if (forbidden.some((word) => sql.toLowerCase().includes(word))) {
    //   throw new Error("Operación no permitida. Solo consultas de lectura.");
    // }

    return await this.irisRepo.executeSql(sql);
  }
}
