/**
 * MediaIterator — Iterador Concreto (Padrão Iterator)
 *
 * Percorre só as mensagens que têm mídia (foto) anexada, dentro de uma
 * conversa já carregada em memória — ignora as milhares de mensagens de
 * texto comuns e as mensagens apagadas. A UI da galeria de fotos só chama
 * next()/previous(); este iterador é quem sabe filtrar e navegar pela
 * estrutura real das mensagens.
 */
class MediaIterator extends Iterador {
  /**
   * @param {Array<Object>} mensagens - mensagens da conversa (todas, mistas)
   */
  constructor(mensagens) {
    super();
    this._itens = mensagens.filter((m) => m.midia && !m.apagada);
    this._indice = this._itens.length - 1; // começa na foto mais recente, como abrir uma galeria de fotos
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

  /** Retorna o objeto mensagem inteiro (tem .midia.url, .midia.nomeArquivo, .remetente, .timestamp) */
  atual() {
    return this._itens[this._indice] || null;
  }

  get total() {
    return this._itens.length;
  }

  /** 1-based, pra mostrar "3 / 12" na tela */
  get posicaoAtual() {
    return this._indice + 1;
  }
}
