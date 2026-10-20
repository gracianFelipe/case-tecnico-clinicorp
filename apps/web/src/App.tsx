import { useSessao } from "./hooks";
import { Login } from "./telas/Login";
import { Agenda } from "./telas/Agenda";

export function App() {
  const { usuario, entrar, sair } = useSessao();

  if (usuario === undefined) return null;
  if (!usuario) return <Login aoEntrar={entrar} />;
  return <Agenda usuario={usuario} aoSair={sair} />;
}
