const VisitanteEstatisticas = require('../interfaces/VisitanteEstatisticas');

/**
 * VisitanteContagemMidia — Padrão Visitor
 *
 * Conta quantas mensagens da conversa têm mídia anexada (mensagem.midia é um
 * objeto { url, nomeArquivo } quando existe, ou null quando é só texto) —
 * alimenta o card "Arquivos de mídia" do "Ver dados" do chat.
 */
class VisitanteContagemMidia extends VisitanteEstatisticas {
  constructor() {
    super();
    this._totalComMidia = 0;
  }

  visitar(mensagem) {
    if (mensagem.midia) {
      this._totalComMidia += 1;
    }
  }

  get resultado() {
    return this._totalComMidia;
  }
}

module.exports = VisitanteContagemMidia;
