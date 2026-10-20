import { sql } from "./db.js";
import { migrar } from "./migrar.js";

const novas = await migrar(sql);
console.log(novas.length ? `aplicadas: ${novas.join(", ")}` : "nada a aplicar");
await sql.end();
