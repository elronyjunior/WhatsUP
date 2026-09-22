/**
 * ComandoApagarParaTodos — Comando Concreto (Padrão Command)
 *
 * Criado quando o usuário clica em "Apagar para todos" (🗑️) numa mensagem
 * própria — pode ser qualquer mensagem antiga, não só a última enviada.
 *
 * Repare que a direção é invertida em relação a ComandoEnviarMensagem: ali
 * o "existir" é a ação natural e apagar é o desfazer; aqui APAGAR É a ação
 * em si (executar), e restaurar é o desfazer. Mesma operação de fundo no
 * servidor (ligar/desligar a marca "apagada"), dois comandos diferentes
 * porque o sentido de ida/volta muda conforme quem inicia a ação.
 */
class ComandoApagarParaTodos extends Comando {
  /**
   * @param {Object} pacote
   * @param {string} chaveConversa
   * @param {(pacote: Object, chaveConversa: string, apagada: boolean) => void} enviarApagar
   */
  constructor(pacote, chaveConversa, enviarApagar) {
    super();
    this._pacote = pacote;
    this._chaveConversa = chaveConversa;
    this._enviarApagar = enviarApagar;
  }

  executar() {
    this._enviarApagar(this._pacote, this._chaveConversa, true);
  }

  desfazer() {
    this._enviarApagar(this._pacote, this._chaveConversa, false);
  }

  get rotulo() {
    return 'Apagar para todos';
  }
}
