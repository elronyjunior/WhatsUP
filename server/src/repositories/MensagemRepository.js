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
      (conversa_id, msg_timestamp, id, texto, remetente, destinatarios, tipo, grupo_id, status, editada, apagada)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await this.db.execute(query, [
      conversaId,
      new Date(pacote.timestamp),
      pacote.id,
      pacote.texto,
      pacote.remetente,
      pacote.destinatarios || [],
      pacote.tipo,
      pacote.grupoId || null,
      pacote.status || 'ENVIADA',
      pacote.editada || false,
      pacote.apagada || false,
    ], { prepare: true });

    console.log(`💾 [MensagemRepository] Mensagem salva — conversa: "${conversaId}"`);
  }

  /**
   * Busca uma única mensagem pela chave primária completa — usado pelo
   * Padrão Command para confirmar quem é o dono de verdade antes de aceitar
   * um editar_mensagem/apagar_mensagem (nunca confia só no que o cliente diz).
   * @param {string} conversaId
   * @param {string} timestamp - ISO string
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async buscarMensagemPorId(conversaId, timestamp, id) {
    const query = `SELECT * FROM mensagens_por_conversa
      WHERE conversa_id = ? AND msg_timestamp = ? AND id = ?`;

    const result = await this.db.execute(query, [conversaId, new Date(timestamp), id], { prepare: true });
    if (result.rowLength === 0) return null;

    const row = result.first();
    return {
      id: row.id,
      texto: row.texto,
      remetente: row.remetente,
      destinatarios: row.destinatarios || [],
      tipo: row.tipo,
      timestamp: row.msg_timestamp.toISOString(),
      grupoId: row.grupo_id || undefined,
      status: row.status || 'ENVIADA',
      editada: row.editada || false,
      apagada: row.apagada || false,
    };
  }

  /**
   * Padrão Command (ComandoEditarMensagem): grava o novo texto e marca
   * editada=true. executar() chama isso com o texto novo; desfazer() chama
   * de novo com o texto anterior (guardado no próprio comando).
   */
  async editarMensagem(conversaId, timestamp, id, novoTexto) {
    const query = `UPDATE mensagens_por_conversa SET texto = ?, editada = true
      WHERE conversa_id = ? AND msg_timestamp = ? AND id = ?`;

    await this.db.execute(query, [novoTexto, conversaId, new Date(timestamp), id], { prepare: true });
    console.log(`✏️ [MensagemRepository] Mensagem "${id}" editada`);
  }

  /**
   * Padrão Command (ComandoApagarParaTodos / ComandoEnviarMensagem): liga ou
   * desliga a marca de "apagada para todos". O texto original nunca é
   * destruído — só fica escondido enquanto apagada=true — por isso desfazer
   * uma exclusão é só chamar isso de novo com apagada=false.
   */
  async definirApagada(conversaId, timestamp, id, apagada) {
    const query = `UPDATE mensagens_por_conversa SET apagada = ?
      WHERE conversa_id = ? AND msg_timestamp = ? AND id = ?`;

    await this.db.execute(query, [apagada, conversaId, new Date(timestamp), id], { prepare: true });
    console.log(`${apagada ? '🗑️' : '♻️'} [MensagemRepository] Mensagem "${id}" ${apagada ? 'apagada' : 'restaurada'}`);
  }

  /**
   * Atualiza o status (Padrão State: EstadoMensagem) de uma mensagem já
   * persistida — ENVIADA → ENTREGUE → LIDA. Best-effort: chamado de forma
   * assíncrona pelo ServidorCentral, sem bloquear o fluxo em tempo real.
   * @param {string} conversaId
   * @param {string} timestamp - ISO string do momento original de envio
   * @param {string} id
   * @param {string} status
   */
  async atualizarStatus(conversaId, timestamp, id, status) {
    const query = `UPDATE mensagens_por_conversa SET status = ?
      WHERE conversa_id = ? AND msg_timestamp = ? AND id = ?`;

    await this.db.execute(query, [status, conversaId, new Date(timestamp), id], { prepare: true });
    console.log(`✓ [MensagemRepository] Status atualizado — mensagem "${id}": ${status}`);
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
      // Linhas gravadas antes da migração do EstadoMensagem não têm essa
      // coluna preenchida — assume-se ENVIADA (o estado inicial de qualquer mensagem).
      status: row.status || 'ENVIADA',
      editada: row.editada || false,
      apagada: row.apagada || false,
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
