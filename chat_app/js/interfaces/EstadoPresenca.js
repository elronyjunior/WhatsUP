/**
 * Interface EstadoPresenca — Padrão State (lado cliente)
 *
 * Define o contrato para reagir ao evento de recebimento de mensagem de
 * acordo com o estado de presença atual do usuário (Online, Não Perturbe
 * ou Ausente). É isso que permite ao CelularUsuario mudar de comportamento
 * em tempo de execução sem precisar de cadeias de if/else espalhadas pelo
 * código — a mesma ideia do Strategy, mas para "como reagir" em vez de
 * "como empacotar".
 */
class EstadoPresenca {
  /**
   * Reage ao recebimento de uma mensagem (som, toast, notificação nativa,
   * auto-resposta...). Cada estado concreto decide o que faz.
   * @param {Object} pacote - Pacote de mensagem recebido
   * @param {CelularUsuario} contexto - Contexto do State (o próprio CelularUsuario)
   * @param {string} [chaveConversa] - Chave local da conversa à qual a mensagem pertence
   */
  aoReceberMensagem(pacote, contexto, chaveConversa) {
    throw new Error('[EstadoPresenca] aoReceberMensagem() deve ser implementado');
  }

  /** Rótulo exibido na interface (ex.: "Online", "Ausente", "Não Perturbe") */
  get rotulo() {
    throw new Error('[EstadoPresenca] rotulo deve ser implementado');
  }

  /** Sufixo de classe CSS usado para colorir o indicador de status */
  get corCss() {
    throw new Error('[EstadoPresenca] corCss deve ser implementado');
  }
}
