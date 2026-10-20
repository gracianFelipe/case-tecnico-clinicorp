CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE usuarios (
  id          serial PRIMARY KEY,
  email       text NOT NULL UNIQUE,
  nome        text NOT NULL,
  senha_hash  text NOT NULL,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessoes (
  id_hash     text PRIMARY KEY,
  usuario_id  integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em   timestamptz NOT NULL,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessoes_expira_em_idx ON sessoes (expira_em);

CREATE TABLE profissionais (
  id          serial PRIMARY KEY,
  nome        text NOT NULL,
  ativo       boolean NOT NULL DEFAULT true
);

CREATE TABLE agendamentos (
  id               serial PRIMARY KEY,
  profissional_id  integer NOT NULL REFERENCES profissionais(id),
  paciente         text NOT NULL,
  periodo          tstzrange NOT NULL,
  observacao       text,
  criado_por       integer NOT NULL REFERENCES usuarios(id),
  criado_em        timestamptz NOT NULL DEFAULT now(),
  atualizado_em    timestamptz NOT NULL DEFAULT now(),
  cancelado_em     timestamptz,

  -- sempre [inicio, fim): horários adjacentes não conflitam
  CONSTRAINT agendamentos_periodo_valido
    CHECK (NOT isempty(periodo) AND lower_inc(periodo) AND NOT upper_inc(periodo)),

  CONSTRAINT agendamentos_sem_sobreposicao
    EXCLUDE USING gist (profissional_id WITH =, periodo WITH &&)
    WHERE (cancelado_em IS NULL)
);

CREATE INDEX agendamentos_profissional_periodo_idx
  ON agendamentos USING gist (profissional_id, periodo)
  WHERE cancelado_em IS NULL;

CREATE TABLE agendamentos_historico (
  id              bigserial PRIMARY KEY,
  agendamento_id  integer NOT NULL REFERENCES agendamentos(id),
  acao            text NOT NULL CHECK (acao IN ('criado', 'movido', 'cancelado')),
  usuario_id      integer NOT NULL REFERENCES usuarios(id),
  periodo_antes   tstzrange,
  periodo_depois  tstzrange,
  criado_em       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agendamentos_historico_agendamento_idx
  ON agendamentos_historico (agendamento_id, criado_em);
