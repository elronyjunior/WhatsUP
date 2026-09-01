/**
 * EstadoNaoPerturbe — Estado Concreto (Padrão State)
 *
 * O usuário pediu explicitamente para não ser interrompido. Todos os sons
 * e pop-ups ficam suprimidos, incluindo notificação nativa do sistema
 * operacional — a única reação permitida é o badge discreto de não lidas,
 * que o app.js já incrementa de forma independente do estado de presença
 * (por isso este método não precisa fazer nada além de existir: a
 * ausência de efeitos colaterais é o próprio comportamento esperado).
 */
class EstadoNaoPerturbe extends EstadoPresenca {
  aoReceberMensagem(_pacote, _contexto, _chaveConversa) {
    // Supressão intencional — nenhum som, toast ou notificação nativa.
  }

  get rotulo() {
    return 'Não Perturbe';
  }

  get corCss() {
    return 'dnd';
  }
}
