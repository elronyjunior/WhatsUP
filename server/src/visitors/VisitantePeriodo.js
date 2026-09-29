const VisitanteEstatisticas = require('../interfaces/VisitanteEstatisticas');

/**
 * VisitantePeriodo — Padrão Visitor
 *
 * Rastreia a mensagem mais antiga e a mais recente vistas até agora, pra
 * mostrar "conversando desde ..." no "Ver dados" do chat.
 */
class VisitantePeriodo extends VisitanteEstatisticas {
  constructor() {
    super();
    this._primeiraMensagemEm = null;
    this._ultimaMensagemEm = null;
  }

  visitar(mensagem) {
    const timestamp = mensagem.timestamp;

    if (this._primeiraMensagemEm === null || new Date(timestamp) < new Date(this._primeiraMensagemEm)) {
      this._primeiraMensagemEm = timestamp;
    }

    if (this._ultimaMensagemEm === null || new Date(timestamp) > new Date(this._ultimaMensagemEm)) {
      this._ultimaMensagemEm = timestamp;
    }
  }

  get resultado() {
    return {
      primeiraMensagemEm: this._primeiraMensagemEm,
      ultimaMensagemEm: this._ultimaMensagemEm,
    };
  }
}

module.exports = VisitantePeriodo;
