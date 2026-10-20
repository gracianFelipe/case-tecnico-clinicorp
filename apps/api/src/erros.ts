export class ErroHttp extends Error {
  constructor(
    public readonly statusCode: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export const naoEncontrado = (o: string) => new ErroHttp(404, `${o} não encontrado`);
export const conflitoHorario = () =>
  new ErroHttp(409, "o profissional já tem um agendamento nesse horário");

export const SQLSTATE = {
  exclusaoViolada: "23P01",
  chaveEstrangeiraViolada: "23503",
  checkViolado: "23514",
} as const;
