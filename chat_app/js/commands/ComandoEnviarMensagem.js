/**
 * ComandoEnviarMensagem (SendMessageCommand) — Comando Concreto (Padrão Command)
 *
 * Criado automaticamente assim que uma mensagem PRÓPRIA termina de ser
 * enviada e confirmada pelo servidor — o envio em si já aconteceu pelo
 * fluxo normal (Observer + Strategy); este comando só é REGISTRADO no
 * histórico (HistoricoComandos.registrar), nunca executado na criação.
 *
 * Guarda o ID que o servidor atribuiu à mensagem — é só isso que o
 * desfazer() precisa pra pedir a exclusão dela no banco, sem precisar
 * perguntar mais nada. Dá pro usuário um "desfazer envio" rápido (Ctrl+Z
 * logo após mandar uma mensagem = apaga ela pra todo mundo).
 */
class ComandoEnviarMensagem extends Comando {
  /**
   * @param {Object} pacote - a mensagem recém-enviada (referência local, já com .id)
   * @param {string} chaveConversa - conversa local à qual a mensagem pertence
   * @param {(pacote: Object, chaveConversa: string, apagada: boolean) => void} enviarApagar
   */
  constructor(pacote, chaveConversa, enviarApagar) {
    super();
    this._pacote = pacote;
    this._chaveConversa = chaveConversa;
    this._enviarApagar = enviarApagar;
  }

  /** Refazer (redo) depois de um desfazer: a mensagem existia, restaura */
  executar() {
    this._enviarApagar(this._pacote, this._chaveConversa, false);
  }

  /** Desfazer o envio = apagar a mensagem para todos */
  desfazer() {
    this._enviarApagar(this._pacote, this._chaveConversa, true);
  }

  get rotulo() {
    return 'Enviar mensagem';
  }
}
