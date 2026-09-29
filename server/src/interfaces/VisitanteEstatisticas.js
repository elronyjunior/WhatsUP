/**
 * Interface VisitanteEstatisticas — Padrão Visitor (análise de conversa)
 *
 * Cada "visitante" concreto sabe calcular UMA estatística (total de
 * mensagens, ranking por remetente, horário de pico, etc.) percorrendo as
 * mensagens de uma conversa uma a uma. O AnalisadorConversa (a estrutura
 * visitável) não precisa conhecer a lógica de nenhuma estatística — só
 * chama visitar(mensagem) pra cada mensagem e, no final, lê o resultado.
 * Assim, adicionar uma estatística nova é criar um visitante novo, sem
 * tocar em quem já existe (aberto pra extensão, fechado pra modificação).
 */
class VisitanteEstatisticas {
  /**
   * Chamado uma vez para cada mensagem da conversa, na ordem em que o
   * AnalisadorConversa percorre a lista.
   * @param {Object} mensagem - mensagem já carregada da conversa
   */
  visitar(mensagem) {
    throw new Error('[VisitanteEstatisticas] visitar() deve ser implementado pela subclasse');
  }

  /** Resultado acumulado até agora (formato definido por cada visitante concreto) */
  get resultado() {
    throw new Error('[VisitanteEstatisticas] resultado deve ser implementado pela subclasse');
  }
}

module.exports = VisitanteEstatisticas;
