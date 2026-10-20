import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const scrypt = (senha: string, salt: Buffer, tamanho: number, opcoes: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(senha, salt, tamanho, opcoes, (erro, chave) => (erro ? reject(erro) : resolve(chave))),
  );

// parâmetros OWASP para scrypt
const N = 2 ** 17;
const R = 8;
const P = 1;
const TAMANHO = 64;
const MAXMEM = 256 * 1024 * 1024;

export async function gerarHashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(senha, salt, TAMANHO, { N, r: R, p: P, maxmem: MAXMEM });
  return ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const partes = armazenado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = partes as [string, string, string, string, string, string];
  const salt = Buffer.from(saltB64, "base64");
  const esperado = Buffer.from(hashB64, "base64");
  const calculado = await scrypt(senha, salt, esperado.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM,
  });
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}
