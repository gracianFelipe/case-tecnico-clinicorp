import { useSessao } from "./hooks";
import { Login } from "./telas/Login";
import { Agenda } from "./telas/Agenda";
import { NaoEncontrada } from "./telas/NaoEncontrada";

export function App() {
  const { usuario, entrar, sair } = useSessao();

  if (location.pathname !== "/") return <NaoEncontrada />;

  if (usuario === undefined) return null;
  if (!usuario) return <Login aoEntrar={entrar} />;
  return <Agenda usuario={usuario} aoSair={sair} />;
}
