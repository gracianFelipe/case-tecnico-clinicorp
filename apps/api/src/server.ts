import { config, emProducao } from "./config.js";
import { sql } from "./db.js";
import { migrar } from "./migrar.js";
import { construirApp } from "./app.js";

await migrar(sql);

const app = await construirApp({
  sql,
  cookieSeguro: emProducao,
  fuso: config.fuso,
  webDir: config.webDir,
  proxies: config.proxies,
});

try {
  await app.listen({ port: config.port, host: config.host });
} catch (erro) {
  app.log.error(erro);
  process.exit(1);
}

for (const sinal of ["SIGTERM", "SIGINT"] as const) {
  process.on(sinal, async () => {
    app.log.info({ sinal }, "encerrando");
    await app.close();
    await sql.end();
    process.exit(0);
  });
}
