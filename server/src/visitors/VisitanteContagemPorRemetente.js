const VisitanteEstatisticas = require('../interfaces/VisitanteEstatisticas');

/**
 * VisitanteContagemPorRemetente — Padrão Visitor
 *
 * Conta quantas mensagens cada remetente enviou na conversa — a base do
 * ranking "quem mais mandou mensagem" exibido no "Ver dados" do grupo/chat.
 * O resultado já sai pronto como array ordenado (maior 'total' primeiro),
 * pra UI do cliente só iterar e desenhar a lista, sem precisar ordenar nada.
 */
class VisitanteContagemPorRemetente extends VisitanteEstatisticas {
  constructor() {
    super();
    this._contagemPorRemetente = new Map();
  }

  visitar(mensagem) {
    const nome = mensagem.remetente;
    const totalAtual = this._contagemPorRemetente.get(nome) || 0;
    this._contagemPorRemetente.set(nome, totalAtual + 1);
  }

  get resultado() {
    return Array.from(this._contagemPorRemetente.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);
  }
}

module.exports = VisitanteContagemPorRemetente;
