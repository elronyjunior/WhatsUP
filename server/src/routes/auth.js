const express = require('express');

/**
 * Rotas de autenticação — Registro e Login de usuários
 * @param {import('../repositories/UsuarioRepository')} usuarioRepository
 * @returns {express.Router}
 */
function criarRotasAuth(usuarioRepository) {
  const router = express.Router();

  /**
   * POST /api/auth/registrar
   * Body: { username: string, senha: string }
   */
  router.post('/registrar', async (req, res) => {
    try {
      const { username, senha } = req.body;

      if (!username || !senha) {
        return res.status(400).json({ sucesso: false, erro: 'Username e senha são obrigatórios.' });
      }

      if (username.length < 3 || username.length > 30) {
        return res.status(400).json({ sucesso: false, erro: 'Username deve ter entre 3 e 30 caracteres.' });
      }

      if (senha.length < 4) {
        return res.status(400).json({ sucesso: false, erro: 'Senha deve ter pelo menos 4 caracteres.' });
      }

      // Valida que o username não contém caracteres especiais problemáticos
      if (!/^[a-zA-Z0-9_À-ÿ]+$/.test(username)) {
        return res.status(400).json({ sucesso: false, erro: 'Username pode conter apenas letras, números e underscore.' });
      }

      const resultado = await usuarioRepository.criarUsuario(username, senha);

      if (!resultado.sucesso) {
        return res.status(409).json(resultado);
      }

      res.status(201).json({ sucesso: true, mensagem: 'Conta criada com sucesso!' });
    } catch (err) {
      console.error('[Auth] Erro no registro:', err);
      res.status(500).json({ sucesso: false, erro: 'Erro interno do servidor.' });
    }
  });

  /**
   * POST /api/auth/login
   * Body: { username: string, senha: string }
   */
  router.post('/login', async (req, res) => {
    try {
      const { username, senha } = req.body;

      if (!username || !senha) {
        return res.status(400).json({ sucesso: false, erro: 'Username e senha são obrigatórios.' });
      }

      const resultado = await usuarioRepository.autenticar(username, senha);

      if (!resultado.sucesso) {
        return res.status(401).json(resultado);
      }

      res.json({ sucesso: true, mensagem: 'Login bem-sucedido!', username });
    } catch (err) {
      console.error('[Auth] Erro no login:', err);
      res.status(500).json({ sucesso: false, erro: 'Erro interno do servidor.' });
    }
  });

  return router;
}

module.exports = criarRotasAuth;
