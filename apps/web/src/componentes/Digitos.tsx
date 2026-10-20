export function Digitos({ valor }: { valor: string }) {
  return (
    <span className="inline-flex h-[1.25em] overflow-hidden align-bottom leading-[1.25em] tabular-nums">
      {valor.split("").map((ch, i) => (
        <span key={i} className="digito">
          <span style={{ transform: `translateY(-${Number(ch) * 1.25}em)` }}>
            {Array.from({ length: 10 }, (_, n) => <i key={n}>{n}</i>)}
          </span>
        </span>
      ))}
    </span>
  );
}
