/**
 * SearchIterator — Iterador Concreto (Padrão Iterator)
 *
 * Percorre só as mensagens de texto que contêm um termo de busca
 * (case-insensitive), dentro de uma conversa já carregada em memória —
 * ignora mensagens apagadas e mensagens sem texto. Você injeta o termo no
 * construtor; a cada .next() o iterador percorre a estrutura da conversa
 * silenciosamente e só retorna a próxima ocorrência, sem a UI precisar
 * conhecer como a busca foi feita.
 */
class SearchIterator extends Iterador {
  /**
   * @param {Array<Object>} mensagens - mensagens da conversa (todas, mistas)
   * @param {string} termo - termo pesquisado
   */
  constructor(mensagens, termo) {
    super();
    const t = (termo || '').trim().toLowerCase();
    this._itens = t
      ? mensagens.filter((m) => !m.apagada && typeof m.texto === 'string' && m.texto.toLowerCase().includes(t))
      : [];
    this._indice = this._itens.length - 1; // começa no resultado mais recente
  }

  hasNext() {
    return this._indice < this._itens.length - 1;
  }

  next() {
    if (this.hasNext()) this._indice++;
    return this.atual();
  }

  hasPrevious() {
    return this._indice > 0;
  }

  previous() {
    if (this.hasPrevious()) this._indice--;
    return this.atual();
  }

  /** Retorna o objeto mensagem inteiro (tem .id, .texto, .remetente, .timestamp) */
  atual() {
    return this._indice >= 0 ? this._itens[this._indice] : null;
  }

  get total() {
    return this._itens.length;
  }

  /** 1-based, pra mostrar "2 / 5" na tela */
  get posicaoAtual() {
    return this._indice + 1;
  }
}
