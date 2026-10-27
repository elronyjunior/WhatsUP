/**
 * CampoMensagem — Originador (Padrão Memento)
 *
 * Envolve o <textarea> onde o usuário escreve e é o único que sabe criar um
 * RascunhoMemento a partir do estado atual (texto + cursor) e restaurar um
 * memento de volta no campo. O resto do app só pede "me dê um memento" ou
 * "restaure este" — não precisa saber o que vai dentro.
 */
class CampoMensagem {
  /**
   * @param {HTMLTextAreaElement} elemento - O campo de digitação
   */
  constructor(elemento) {
    this._elemento = elemento;
  }

  /**
   * Captura o estado atual do campo. Devolve null quando não há nada que
   * valha guardar (vazio ou só espaços) — igual ao WhatsApp, que não mantém
   * "rascunho em branco".
   * @returns {?RascunhoMemento}
   */
  criarMemento() {
    const texto = this._elemento.value;
    if (!texto.trim()) return null;

    return new RascunhoMemento({
      texto,
      cursorInicio: this._elemento.selectionStart,
      cursorFim: this._elemento.selectionEnd,
      salvoEm: new Date().toISOString(),
    });
  }

  /**
   * Devolve ao campo o estado guardado no memento. Sem memento (conversa
   * que nunca teve rascunho), deixa o campo vazio.
   * @param {?RascunhoMemento} memento
   */
  restaurar(memento) {
    this._elemento.value = memento ? memento.texto : '';
    this.ajustarAltura();

    if (memento) {
      this._elemento.setSelectionRange(memento.cursorInicio, memento.cursorFim);
    }
  }

  /** Esvazia o campo (depois de enviar a mensagem). */
  limpar() {
    this.restaurar(null);
  }

  /**
   * O campo cresce com o texto (até 120px), como a caixa de mensagem do WhatsApp.
   *
   * Campo vazio fica na altura natural ('auto'): medir aqui contaria o
   * placeholder, que em celular estreito quebra em 2 linhas e inflaria o
   * campo vazio de 50px para 72px.
   * Com o campo escondido (celular, enquanto a lista de conversas está na
   * tela) scrollHeight vale 0 — nesse caso também mantém 'auto' em vez de
   * colapsar o campo; quem abre a conversa chama de novo quando ele já está
   * visível.
   */
  ajustarAltura() {
    this._elemento.style.height = 'auto';
    if (!this._elemento.value) return;

    const alturaDoConteudo = this._elemento.scrollHeight;
    if (alturaDoConteudo > 0) {
      this._elemento.style.height = Math.min(alturaDoConteudo, 120) + 'px';
    }
  }
}
