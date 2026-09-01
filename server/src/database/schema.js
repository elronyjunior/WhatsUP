/**
 * Schema CQL do WhatsUP Chat
 * Define todas as tabelas necessárias no Cassandra.
 */

const SCHEMA_QUERIES = [
  // Tabela de usuários
  `CREATE TABLE IF NOT EXISTS usuarios (
    username TEXT PRIMARY KEY,
    senha_hash TEXT,
    criado_em TIMESTAMP
  )`,

  // Mensagens por conversa (ordenadas por tempo)
  `CREATE TABLE IF NOT EXISTS mensagens_por_conversa (
    conversa_id TEXT,
    msg_timestamp TIMESTAMP,
    id TEXT,
    texto TEXT,
    remetente TEXT,
    destinatarios LIST<TEXT>,
    tipo TEXT,
    grupo_id TEXT,
    status TEXT,
    PRIMARY KEY (conversa_id, msg_timestamp, id)
  ) WITH CLUSTERING ORDER BY (msg_timestamp ASC)`,

  // Grupos
  `CREATE TABLE IF NOT EXISTS grupos (
    id TEXT PRIMARY KEY,
    nome TEXT,
    membros LIST<TEXT>,
    criador TEXT,
    criado_em TIMESTAMP
  )`,

  // Índice de grupos por membro
  `CREATE TABLE IF NOT EXISTS grupos_por_membro (
    username TEXT,
    grupo_id TEXT,
    PRIMARY KEY (username, grupo_id)
  )`,
];

/**
 * Migrações incrementais — `CREATE TABLE IF NOT EXISTS` não adiciona coluna
 * nova a uma tabela que já existia antes desta versão do schema. Cada query
 * aqui é aplicada à parte e tratada como best-effort (ver CassandraClient):
 * falha esperada e silenciosa se a coluna já existir de uma execução anterior.
 */
const MIGRACOES = [
  // Padrão State (EstadoMensagem): status de entrega/leitura da mensagem.
  `ALTER TABLE mensagens_por_conversa ADD status TEXT`,
];

module.exports = { SCHEMA_QUERIES, MIGRACOES };
