/**
 * MensagemRepository — Acesso à tabela 'mensagens_por_conversa' no Cassandra
 */
class MensagemRepository {
  /**
   * @param {import('cassandra-driver').Client} cassandraClient
   */
  constructor(cassandraClient) {
    this.db = cassandraClient;
  }

  /**
   * Salva uma mensagem no banco vinculada à conversa.
   * @param {Object} pacote - Dados da mensagem
   * @param {string} conversaId - ID canônico da conversa
   */
  async salvarMensagem(pacote, conversaId) {
    const query = `INSERT INTO mensagens_por_conversa 
      (conversa_id, msg_timestamp, id, texto, remetente, destinatarios, tipo, grupo_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    await this.db.execute(query, [
      conversaId,
      new Date(pacote.timestamp),
      pacote.id,
      pacote.texto,
      pacote.remetente,
      pacote.destinatarios || [],
      pacote.tipo,
      pacote.grupoId || null,
    ], { prepare: true });

    console.log(`💾 [MensagemRepository] Mensagem salva — conversa: "${conversaId}"`);
  }

  /**
   * Busca mensagens de uma conversa (últimas N mensagens).
   * @param {string} conversaId
   * @param {number} limite
   * @returns {Promise<Object[]>}
   */
  async buscarMensagens(conversaId, limite = 50) {
    const query = `SELECT * FROM mensagens_por_conversa 
      WHERE conversa_id = ? 
      ORDER BY msg_timestamp ASC 
      LIMIT ?`;

    const result = await this.db.execute(query, [conversaId, limite], { prepare: true });

    return result.rows.map((row) => ({
      id: row.id,
      texto: row.texto,
      remetente: row.remetente,
      destinatarios: row.destinatarios || [],
      tipo: row.tipo,
      timestamp: row.msg_timestamp.toISOString(),
      grupoId: row.grupo_id || undefined,
    }));
  }

  /**
   * Gera um ID canônico para a conversa.
   * Para mensagens privadas, ordena os nomes para que a conversa seja a mesma
   * independente de quem enviou.
   *
   * @param {'PUBLICO'|'PRIVADO'|'GRUPO'} tipo
   * @param {string} remetente
   * @param {string[]} destinatarios
   * @param {string} [grupoId]
   * @returns {string}
   */
  gerarConversaId(tipo, remetente, destinatarios = [], grupoId = null) {
    if (tipo === 'PUBLICO') {
      return 'geral';
    }
    if (tipo === 'GRUPO' && grupoId) {
      return grupoId;
    }
    // PRIVADO: ordena os participantes para chave canônica
    const participantes = [remetente, ...destinatarios].sort();
    return `priv_${participantes.join('_')}`;
  }
}

module.exports = MensagemRepository;
