/**
 * RascunhoMemento — Memento (Padrão Memento)
 *
 * "Foto" imutável do que o usuário tinha digitado no campo de mensagem de uma
 * conversa: o texto e a posição do cursor/seleção. Quem guarda o memento (o
 * GerenciadorRascunhos) nunca precisa abrir ou alterar o conteúdo — só
 * entrega de volta ao CampoMensagem, que é quem sabe restaurar.
 *
 * Imutável de propósito: depois de criado, nada altera o rascunho guardado.
 * Escrever mais texto gera outro memento que substitui este.
 */
class RascunhoMemento {
  /**
   * @param {Object} estado
   * @param {string} estado.texto - Texto digitado até o momento
   * @param {number} estado.cursorInicio - Início da seleção/posição do cursor
   * @param {number} estado.cursorFim - Fim da seleção
   * @param {string} estado.salvoEm - Momento da captura (ISO 8601)
   */
  constructor({ texto, cursorInicio, cursorFim, salvoEm }) {
    this._texto = texto;
    this._cursorInicio = cursorInicio;
    this._cursorFim = cursorFim;
    this._salvoEm = salvoEm;
    Object.freeze(this);
  }

  get texto() { return this._texto; }
  get cursorInicio() { return this._cursorInicio; }
  get cursorFim() { return this._cursorFim; }
  get salvoEm() { return this._salvoEm; }

  /**
   * Trecho curto do rascunho para a lista de conversas ("Rascunho: ..."):
   * quebras de linha viram espaço e o texto é cortado com reticências.
   * @param {number} max
   * @returns {string}
   */
  previa(max = 35) {
    const linha = this._texto.replace(/\s+/g, ' ').trim();
    // Corta por caractere (ponto de código), não por unidade UTF-16: um emoji
    // na posição do corte viraria meio emoji ("�") na lista.
    const caracteres = Array.from(linha);
    return caracteres.length > max ? `${caracteres.slice(0, max).join('')}…` : linha;
  }

  /** Forma serializável — é assim que o rascunho sobrevive a recarregar a página. */
  paraObjeto() {
    return {
      texto: this._texto,
      cursorInicio: this._cursorInicio,
      cursorFim: this._cursorFim,
      salvoEm: this._salvoEm,
    };
  }

  /**
   * Reconstrói um memento a partir do que foi salvo. Devolve null se o dado
   * estiver corrompido ou vazio, em vez de deixar um rascunho inválido entrar.
   * @param {*} obj
   * @returns {?RascunhoMemento}
   */
  static deObjeto(obj) {
    if (!obj || typeof obj.texto !== 'string' || !obj.texto.trim()) return null;

    const limite = obj.texto.length;
    const posicao = (valor) => (Number.isInteger(valor) ? Math.min(Math.max(valor, 0), limite) : limite);

    return new RascunhoMemento({
      texto: obj.texto,
      cursorInicio: posicao(obj.cursorInicio),
      cursorFim: posicao(obj.cursorFim),
      salvoEm: typeof obj.salvoEm === 'string' ? obj.salvoEm : new Date().toISOString(),
    });
  }
}
