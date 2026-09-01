const cassandra = require('cassandra-driver');
const { SCHEMA_QUERIES, MIGRACOES } = require('./schema');

/**
 * CassandraClient — Singleton de conexão com o Cassandra
 * Gerencia a conexão e inicialização do schema do banco.
 */
class CassandraClient {
  constructor() {
    this.client = null;
  }

  /**
   * Conecta ao Cassandra e inicializa o keyspace e tabelas.
   * @param {Object} options
   * @param {string[]} options.contactPoints - Hosts do Cassandra
   * @param {string} options.localDataCenter - Data center local
   * @param {string} options.keyspace - Nome do keyspace
   */
  async connect({ contactPoints = ['127.0.0.1'], localDataCenter = 'datacenter1', keyspace = 'whatsup_chat' } = {}) {
    // Primeiro conecta sem keyspace para poder criá-lo
    const initClient = new cassandra.Client({
      contactPoints,
      localDataCenter,
    });

    await initClient.connect();
    console.log('✅ [Cassandra] Conexão inicial estabelecida');

    // Cria o keyspace se não existir
    await initClient.execute(`
      CREATE KEYSPACE IF NOT EXISTS ${keyspace}
      WITH replication = { 'class': 'SimpleStrategy', 'replication_factor': 1 }
    `);
    console.log(`✅ [Cassandra] Keyspace "${keyspace}" garantido`);
    await initClient.shutdown();

    // Reconecta com o keyspace
    this.client = new cassandra.Client({
      contactPoints,
      localDataCenter,
      keyspace,
    });

    await this.client.connect();
    console.log(`✅ [Cassandra] Conectado ao keyspace "${keyspace}"`);

    // Cria as tabelas
    await this._inicializarSchema();

    return this.client;
  }

  /** Executa todas as queries de criação de tabelas */
  async _inicializarSchema() {
    for (const query of SCHEMA_QUERIES) {
      await this.client.execute(query);
    }

    // Migrações: idempotentes na prática, mas o driver não tem "ADD COLUMN
    // IF NOT EXISTS" — então cada uma roda isolada e uma falha (coluna já
    // existente de uma execução anterior) não derruba a inicialização.
    for (const query of MIGRACOES) {
      try {
        await this.client.execute(query);
      } catch (err) {
        console.warn(`⚠️  [Cassandra] Migração ignorada (provavelmente já aplicada antes): ${err.message}`);
      }
    }

    console.log('✅ [Cassandra] Schema inicializado (tabelas criadas)');
  }

  /** Retorna a instância do client */
  getClient() {
    if (!this.client) {
      throw new Error('[Cassandra] Cliente não conectado. Chame connect() primeiro.');
    }
    return this.client;
  }

  /** Encerra a conexão */
  async shutdown() {
    if (this.client) {
      await this.client.shutdown();
      console.log('🔌 [Cassandra] Conexão encerrada');
    }
  }
}

// Singleton
module.exports = new CassandraClient();
