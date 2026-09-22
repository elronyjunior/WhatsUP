/**
 * ComandoEditarMensagem — Comando Concreto (Padrão Command)
 *
 * Encapsula a edição do texto de uma mensagem própria. Guarda o texto
 * anterior no próprio comando — é isso que permite desfazer() sem precisar
 * perguntar nada de novo ao servidor: já sabemos pra que texto voltar.
 */
class ComandoEditarMensagem extends Comando {
  /**
   * @param {Object} pacote - a mensagem sendo editada (referência local)
   * @param {string} chaveConversa
   * @param {string} novoTexto
   * @param {(pacote: Object, chaveConversa: string, texto: string) => void} enviarEdicao
   */
  constructor(pacote, chaveConversa, novoTexto, enviarEdicao) {
    super();
    this._pacote = pacote;
    this._chaveConversa = chaveConversa;
    this._textoAnterior = pacote.texto;
    this._textoNovo = novoTexto;
    this._enviarEdicao = enviarEdicao;
  }

  executar() {
    this._enviarEdicao(this._pacote, this._chaveConversa, this._textoNovo);
  }

  desfazer() {
    this._enviarEdicao(this._pacote, this._chaveConversa, this._textoAnterior);
  }

  get rotulo() {
    return 'Editar mensagem';
  }
}
