/**
 * Interface Mediador — Padrão Mediator
 *
 * Centraliza a comunicação entre componentes de uma tela. Um componente
 * nunca chama outro diretamente: só avisa o mediador que "algo aconteceu"
 * (notificar(this, 'clicou')) e é o mediador quem decide como os demais
 * componentes reagem. Assim cada componente fica reaproveitável e toda a
 * regra de interação da tela mora num lugar só.
 */
class Mediador {
  /**
   * @param {ComponenteMediado} remetente - Componente que disparou o evento
   * @param {string} evento - Nome do evento (ex.: 'clicou', 'conectou')
   */
  notificar(remetente, evento) {
    throw new Error('[Mediador] notificar() deve ser implementado');
  }
}
