const VisitanteEstatisticas = require('../interfaces/VisitanteEstatisticas');

/**
 * VisitanteContagemTotal — Padrão Visitor
 *
 * Conta simplesmente o total de mensagens da conversa (o número que aparece
 * no topo do "Ver dados" do chat, como no WhatsApp).
 */
class VisitanteContagemTotal extends VisitanteEstatisticas {
  constructor() {
    super();
    this._total = 0;
  }

  visitar(mensagem) {
    this._total += 1;
  }

  get resultado() {
    return this._total;
  }
}

module.exports = VisitanteContagemTotal;
