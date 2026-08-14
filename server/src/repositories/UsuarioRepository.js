const bcrypt = require('bcrypt');

/**
 * UsuarioRepository — Acesso à tabela 'usuarios' no Cassandra
 */
class UsuarioRepository {
  /**
   * @param {import('cassandra-driver').Client} cassandraClient
   */
  constructor(cassandraClient) {
    this.db = cassandraClient;
    this.SALT_ROUNDS = 10;
  }

  /**
   * Cria um novo usuário com senha hasheada.
   * @param {string} username
   * @param {string} senha
   * @returns {Promise<{sucesso: boolean, erro?: string}>}
   */
  async criarUsuario(username, senha) {
    // Verifica se já existe
    const existente = await this.buscarPorUsername(username);
    if (existente) {
      return { sucesso: false, erro: 'Nome de usuário já está em uso.' };
    }

    const senhaHash = await bcrypt.hash(senha, this.SALT_ROUNDS);
    const query = 'INSERT INTO usuarios (username, senha_hash, criado_em) VALUES (?, ?, ?)';
    await this.db.execute(query, [username, senhaHash, new Date()], { prepare: true });

    console.log(`👤 [UsuarioRepository] Usuário criado: "${username}"`);
    return { sucesso: true };
  }

  /**
   * Autentica um usuário verificando a senha.
   * @param {string} username
   * @param {string} senha
   * @returns {Promise<{sucesso: boolean, erro?: string}>}
   */
  async autenticar(username, senha) {
    const usuario = await this.buscarPorUsername(username);
    if (!usuario) {
      return { sucesso: false, erro: 'Usuário não encontrado.' };
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta) {
      return { sucesso: false, erro: 'Senha incorreta.' };
    }

    console.log(`🔓 [UsuarioRepository] Login bem-sucedido: "${username}"`);
    return { sucesso: true };
  }

  /**
   * Busca um usuário pelo username.
   * @param {string} username
   * @returns {Promise<Object|null>}
   */
  async buscarPorUsername(username) {
    const query = 'SELECT * FROM usuarios WHERE username = ?';
    const result = await this.db.execute(query, [username], { prepare: true });
    return result.rowLength > 0 ? result.first() : null;
  }
}

module.exports = UsuarioRepository;
