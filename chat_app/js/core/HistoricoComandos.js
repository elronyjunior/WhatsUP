/**
 * HistoricoComandos — Invocador do Padrão Command
 *
 * Mantém duas pilhas (desfazer/refazer) de comandos. Não conhece
 * ComandoEditarMensagem nem ComandoApagarParaTodos especificamente — só
 * chama executar()/desfazer() do Comando que recebe, por isso um novo tipo
 * de ação desfazível no futuro não exige nenhuma mudança aqui.
 *
 * executar() é para ações que o próprio HistoricoComandos deve disparar
 * (ex.: o usuário clicou em "Editar"). registrar() é para ações que já
 * aconteceram por fora (ex.: o envio normal de uma mensagem, que já saiu
 * pelo fluxo de Observer/Strategy antes de virar um ComandoEnviarMensagem)
 * — só entra na pilha de desfazer, sem repetir a ação.
 */
class HistoricoComandos {
  constructor() {
    this._pilhaDesfazer = [];
    this._pilhaRefazer = [];
  }

  /** Executa um novo comando agora e o registra no histórico */
  executar(comando) {
    comando.executar();
    this._registrar(comando);
  }

  /** Registra um comando cuja ação já aconteceu por fora, sem reexecutá-la */
  registrar(comando) {
    this._registrar(comando);
  }

  _registrar(comando) {
    this._pilhaDesfazer.push(comando);
    this._pilhaRefazer = []; // uma ação nova invalida qualquer "refazer" pendente
  }

  /** Desfaz o último comando executado/registrado, se houver. Retorna o comando ou null. */
  desfazer() {
    const comando = this._pilhaDesfazer.pop();
    if (!comando) return null;
    comando.desfazer();
    this._pilhaRefazer.push(comando);
    return comando;
  }

  /** Reexecuta o último comando desfeito, se houver. Retorna o comando ou null. */
  refazer() {
    const comando = this._pilhaRefazer.pop();
    if (!comando) return null;
    comando.executar();
    this._pilhaDesfazer.push(comando);
    return comando;
  }

  get podeDesfazer() {
    return this._pilhaDesfazer.length > 0;
  }

  get podeRefazer() {
    return this._pilhaRefazer.length > 0;
  }
}
