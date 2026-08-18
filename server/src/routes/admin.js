const express = require('express');

/**
 * Rotas Admin — Visualização e gerenciamento do banco de dados
 * @param {import('../database/CassandraClient')} cassandraClient
 * @returns {express.Router}
 */
function criarRotasAdmin(cassandraClient) {
  const router = express.Router();

  /**
   * GET /api/admin/database
   * Retorna a estrutura completa do banco de dados com dados
   */
  router.get('/database', async (req, res) => {
    try {
      const client = cassandraClient.getClient();
      const database = {};

      // Tabelas conhecidas do projeto
      const tabelas = ['usuarios', 'mensagens', 'grupos', 'grupo_membros'];

      for (const tabela of tabelas) {
        try {
          // Busca os dados da tabela
          const resultado = await client.execute(`SELECT * FROM ${tabela} LIMIT 1000`);
          
          // Extrai as colunas do resultado
          const colunas = resultado.columns.map(col => ({
            nome: col.name,
            tipo: col.type.toString(),
          }));

          database[tabela] = {
            colunas,
            linhas: resultado.rows,
            totalLinhas: resultado.rows.length,
          };
        } catch (err) {
          database[tabela] = {
            erro: err.message,
          };
        }
      }

      res.json({
        status: 'sucesso',
        banco: 'whatsup_chat',
        timestamp: new Date().toISOString(),
        database,
      });
    } catch (err) {
      console.error('[Admin] Erro ao buscar banco de dados:', err);
      res.status(500).json({
        status: 'erro',
        mensagem: 'Erro ao consultar banco de dados',
        erro: err.message,
      });
    }
  });

  /**
   * GET /api/admin/database/:tabela
   * Retorna os dados de uma tabela específica
   */
  router.get('/database/:tabela', async (req, res) => {
    try {
      const { tabela } = req.params;
      const { limite = 50 } = req.query;

      // Validação básica de segurança
      if (!/^[a-z_]+$/.test(tabela)) {
        return res.status(400).json({
          status: 'erro',
          mensagem: 'Nome de tabela inválido',
        });
      }

      const client = cassandraClient.getClient();
      const resultado = await client.execute(
        `SELECT * FROM ${tabela} LIMIT ?`,
        [parseInt(limite, 10)],
        { prepare: true }
      );

      const colunas = resultado.columns.map(col => ({
        nome: col.name,
        tipo: col.type.toString(),
      }));

      res.json({
        status: 'sucesso',
        tabela,
        colunas,
        linhas: resultado.rows,
        totalLinhas: resultado.rows.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Admin] Erro ao buscar tabela:', err);
      res.status(500).json({
        status: 'erro',
        mensagem: 'Erro ao consultar tabela',
        erro: err.message,
      });
    }
  });

  /**
   * GET /api/admin/database/:tabela/schema
   * Retorna apenas o schema (colunas) de uma tabela
   */
  router.get('/database/:tabela/schema', async (req, res) => {
    try {
      const { tabela } = req.params;

      // Validação básica de segurança
      if (!/^[a-z_]+$/.test(tabela)) {
        return res.status(400).json({
          status: 'erro',
          mensagem: 'Nome de tabela inválido',
        });
      }

      const client = cassandraClient.getClient();
      const resultado = await client.execute(
        `SELECT * FROM ${tabela} LIMIT 1`
      );

      const colunas = resultado.columns.map(col => ({
        nome: col.name,
        tipo: col.type.toString(),
      }));

      res.json({
        status: 'sucesso',
        tabela,
        colunas,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Admin] Erro ao buscar schema:', err);
      res.status(500).json({
        status: 'erro',
        mensagem: 'Erro ao consultar schema',
        erro: err.message,
      });
    }
  });

  /**
   * GET /api/admin/database/:tabela/count
   * Retorna a contagem de linhas de uma tabela
   */
  router.get('/database/:tabela/count', async (req, res) => {
    try {
      const { tabela } = req.params;

      // Validação básica de segurança
      if (!/^[a-z_]+$/.test(tabela)) {
        return res.status(400).json({
          status: 'erro',
          mensagem: 'Nome de tabela inválido',
        });
      }

      const client = cassandraClient.getClient();
      const resultado = await client.execute(`SELECT COUNT(*) as total FROM ${tabela}`);

      res.json({
        status: 'sucesso',
        tabela,
        total: resultado.rows[0]?.total || 0,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Admin] Erro ao contar linhas:', err);
      res.status(500).json({
        status: 'erro',
        mensagem: 'Erro ao contar linhas',
        erro: err.message,
      });
    }
  });

  return router;
}

module.exports = criarRotasAdmin;
