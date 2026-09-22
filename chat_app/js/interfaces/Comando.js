/**
 * Interface Comando — Padrão Command
 *
 * Encapsula uma ação do usuário (enviar, editar, apagar para todos) como um
 * objeto que sabe tanto executar quanto desfazer a si mesmo. É isso que
 * permite um histórico de desfazer/refazer genérico — o HistoricoComandos
 * (o invocador) não precisa conhecer os detalhes de CADA ação, só chama
 * executar()/desfazer() do Comando que recebe.
 */
class Comando {
  /** Executa (ou reexecuta, no caso de um "refazer") a ação */
  executar() {
    throw new Error('[Comando] executar() deve ser implementado');
  }

  /** Reverte a ação para o estado anterior */
  desfazer() {
    throw new Error('[Comando] desfazer() deve ser implementado');
  }

  /** Rótulo curto pra mostrar em toasts/tooltips (ex.: "Editar mensagem") */
  get rotulo() {
    throw new Error('[Comando] rotulo deve ser implementado');
  }
}
