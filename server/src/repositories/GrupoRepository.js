/**
 * GrupoRepository — Acesso às tabelas 'grupos' e 'grupos_por_membro' no Cassandra
 */
class GrupoRepository {
  /**
   * @param {import('cassandra-driver').Client} cassandraClient
   */
  constructor(cassandraClient) {
    this.db = cassandraClient;
  }

  /**
   * Cria um grupo e indexa por cada membro.
   * @param {Object} grupo - { id, nome, membros, criador, criadoEm }
   */
  async criarGrupo(grupo) {
    // Insere o grupo
    const queryGrupo = 'INSERT INTO grupos (id, nome, membros, criador, criado_em) VALUES (?, ?, ?, ?, ?)';
    await this.db.execute(queryGrupo, [
      grupo.id,
      grupo.nome,
      grupo.membros,
      grupo.criador,
      new Date(grupo.criadoEm),
    ], { prepare: true });

    // Indexa por cada membro
    const queryMembro = 'INSERT INTO grupos_por_membro (username, grupo_id) VALUES (?, ?)';
    for (const membro of grupo.membros) {
      await this.db.execute(queryMembro, [membro, grupo.id], { prepare: true });
    }

    console.log(`💾 [GrupoRepository] Grupo salvo: "${grupo.nome}" (${grupo.id})`);
  }

  /**
   * Busca todos os grupos de um usuário.
   * @param {string} username
   * @returns {Promise<Object[]>}
   */
  async buscarGruposDoUsuario(username) {
    // Primeiro busca os IDs dos grupos do usuário
    const queryIds = 'SELECT grupo_id FROM grupos_por_membro WHERE username = ?';
    const resultIds = await this.db.execute(queryIds, [username], { prepare: true });

    if (resultIds.rowLength === 0) return [];

    // Busca os detalhes de cada grupo
    const gruposResult = [];
    for (const row of resultIds.rows) {
      const grupo = await this.buscarGrupo(row.grupo_id);
      if (grupo) gruposResult.push(grupo);
    }

    return gruposResult;
  }

  /**
   * Busca um grupo pelo ID.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async buscarGrupo(id) {
    const query = 'SELECT * FROM grupos WHERE id = ?';
    const result = await this.db.execute(query, [id], { prepare: true });

    if (result.rowLength === 0) return null;

    const row = result.first();
    return {
      id: row.id,
      nome: row.nome,
      membros: row.membros || [],
      criador: row.criador,
      criadoEm: row.criado_em.toISOString(),
    };
  }
}

module.exports = GrupoRepository;
