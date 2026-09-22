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
    editada BOOLEAN,
    apagada BOOLEAN,
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

  // Índice de conversas privadas por usuário — sem isso, uma conversa com
  // alguém que está offline no momento do login não aparece na barra lateral
  // (só usuários conectados chegam via 'lista_usuarios'), mesmo com o
  // histórico intacto em mensagens_por_conversa.
  `CREATE TABLE IF NOT EXISTS conversas_privadas_por_usuario (
    username TEXT,
    conversa_id TEXT,
    outro_usuario TEXT,
    PRIMARY KEY (username, conversa_id)
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
  // Padrão Command: editar mensagem / apagar para todos (com undo/redo).
  `ALTER TABLE mensagens_por_conversa ADD editada BOOLEAN`,
  `ALTER TABLE mensagens_por_conversa ADD apagada BOOLEAN`,
];

module.exports = { SCHEMA_QUERIES, MIGRACOES };
