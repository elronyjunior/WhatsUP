const VisitanteEstatisticas = require('../interfaces/VisitanteEstatisticas');

/**
 * VisitanteHorarioPico — Padrão Visitor
 *
 * Descobre em qual hora do dia (0 a 23, UTC) a conversa tem mais atividade —
 * o gráfico de barras "Horário mais ativo" do "Ver dados" do chat.
 */
class VisitanteHorarioPico extends VisitanteEstatisticas {
  constructor() {
    super();
    this._distribuicaoPorHora = new Array(24).fill(0);
  }

  visitar(mensagem) {
    const hora = new Date(mensagem.timestamp).getUTCHours();
    this._distribuicaoPorHora[hora] += 1;
  }

  get resultado() {
    const maiorContagem = Math.max(...this._distribuicaoPorHora);
    const horaPico = maiorContagem > 0 ? this._distribuicaoPorHora.indexOf(maiorContagem) : null;

    return {
      horaPico,
      distribuicao: this._distribuicaoPorHora,
    };
  }
}

module.exports = VisitanteHorarioPico;
