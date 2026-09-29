/**
 * AnalisadorConversa — a "estrutura visitável" do Padrão Visitor
 *
 * Guarda a lista de mensagens de UMA conversa (já carregada — quem cria esta
 * classe já buscou no repositório) e aplica qualquer VisitanteEstatisticas
 * concreto sobre elas, sem que o visitante precise saber como a lista é
 * armazenada internamente. Adicionar uma estatística nova é só criar um
 * visitante novo (ver server/src/visitors/) e chamar aplicar() com ele.
 */
class AnalisadorConversa {
  /**
   * @param {Object[]} mensagens - mensagens da conversa, já carregadas
   */
  constructor(mensagens) {
    this._mensagens = mensagens;
  }

  /**
   * Percorre todas as mensagens da conversa chamando visitante.visitar()
   * para cada uma, e devolve o resultado acumulado do visitante ao final.
   * @param {import('../interfaces/VisitanteEstatisticas')} visitante
   * @returns {*} o resultado do visitante (formato definido por ele)
   */
  aplicar(visitante) {
    this._mensagens.forEach((mensagem) => visitante.visitar(mensagem));
    return visitante.resultado;
  }
}

module.exports = AnalisadorConversa;
