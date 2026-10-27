/**
 * GerenciadorRascunhos — Zelador (Caretaker) do Padrão Memento
 *
 * Guarda um RascunhoMemento por conversa, sem abrir o conteúdo deles: quem
 * decide o que vai num memento é o CampoMensagem, e quem sabe ler/gravar o
 * formato é o próprio RascunhoMemento (paraObjeto/deObjeto). O gerenciador
 * só sabe "esta conversa tem um memento" — por isso trocar o que um rascunho
 * contém (ex.: guardar também um anexo) não muda nada aqui.
 *
 * Os rascunhos ficam no navegador (localStorage), separados por usuário —
 * como no WhatsApp, o rascunho é do aparelho, e dois usuários no mesmo
 * navegador não enxergam os rascunhos um do outro.
 *
 * O mesmo usuário pode ter duas abas abertas. Por isso cada gravação relê o
 * armazenamento e altera só a chave da conversa em questão (nunca regrava o
 * mapa inteiro que esta aba carregou há horas), e recarregar() deixa a aba
 * se atualizar quando outra grava (evento 'storage' do navegador).
 */
class GerenciadorRascunhos {
  /**
   * @param {string} usuario - Dono dos rascunhos (isola o armazenamento por usuário)
   * @param {Storage} [armazenamento] - getItem/setItem/removeItem; por padrão o localStorage
   */
  constructor(usuario, armazenamento = GerenciadorRascunhos._armazenamentoDoNavegador()) {
    this._armazenamento = armazenamento;
    this._chaveArmazenamento = `whatsup:rascunhos:${usuario}`;
    this._mementos = this._lerArmazenado(); // chave da conversa → RascunhoMemento
  }

  /** Chave do armazenamento (para reconhecer o evento 'storage' desta aba/usuário). */
  get chaveArmazenamento() {
    return this._chaveArmazenamento;
  }

  /**
   * Guarda o memento da conversa, substituindo o anterior. Receber null
   * (campo vazio) significa que a conversa deixou de ter rascunho.
   * @param {string} chaveConversa
   * @param {?RascunhoMemento} memento
   */
  guardar(chaveConversa, memento) {
    if (!memento) {
      this.descartar(chaveConversa);
      return;
    }
    this._mementos.set(chaveConversa, memento);
    this._gravarChave(chaveConversa, memento);
  }

  /** @returns {?RascunhoMemento} o rascunho da conversa, ou null se não houver */
  obter(chaveConversa) {
    return this._mementos.get(chaveConversa) || null;
  }

  descartar(chaveConversa) {
    this._mementos.delete(chaveConversa);
    this._gravarChave(chaveConversa, null);
  }

  possui(chaveConversa) {
    return this._mementos.has(chaveConversa);
  }

  /** Relê tudo do armazenamento — para quando outra aba do mesmo usuário gravou algo. */
  recarregar() {
    this._mementos = this._lerArmazenado();
  }

  /**
   * Aplica UMA mudança (guardar ou remover a chave) sobre o que está de fato
   * no armazenamento agora, em vez de regravar o mapa desta aba — assim uma
   * aba nunca apaga nem ressuscita os rascunhos de outra.
   */
  _gravarChave(chaveConversa, memento) {
    const armazenados = this._lerArmazenado();

    if (memento) {
      armazenados.set(chaveConversa, memento);
    } else if (!armazenados.delete(chaveConversa)) {
      return; // nada pra remover do armazenamento
    }

    this._escrever(armazenados);
  }

  _escrever(mementos) {
    try {
      if (mementos.size === 0) {
        this._armazenamento?.removeItem(this._chaveArmazenamento);
        return;
      }
      // fromEntries cria propriedade própria mesmo pra chave "__proto__"
      // (um nome de usuário válido), que `objeto[chave] = ...` perderia.
      const dados = Object.fromEntries(
        Array.from(mementos, ([chave, memento]) => [chave, memento.paraObjeto()])
      );
      this._armazenamento?.setItem(this._chaveArmazenamento, JSON.stringify(dados));
    } catch (err) {
      // Sem armazenamento disponível (modo privado, cota cheia): o rascunho
      // continua valendo enquanto a página estiver aberta, só não sobrevive ao reload.
      console.warn('[GerenciadorRascunhos] Não foi possível salvar os rascunhos:', err.message);
    }
  }

  /** Lê e valida o que está salvo. Dado ilegível ou inválido é ignorado, nunca lança. */
  _lerArmazenado() {
    const lidos = new Map();
    try {
      const bruto = this._armazenamento?.getItem(this._chaveArmazenamento);
      if (!bruto) return lidos;

      const dados = JSON.parse(bruto);
      if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return lidos;

      Object.entries(dados).forEach(([chave, obj]) => {
        const memento = RascunhoMemento.deObjeto(obj);
        if (memento) lidos.set(chave, memento);
      });
    } catch (err) {
      console.warn('[GerenciadorRascunhos] Rascunhos salvos ilegíveis, ignorando:', err.message);
    }
    return lidos;
  }

  /** localStorage pode lançar erro só de ser acessado (cookies/dados de site bloqueados). */
  static _armazenamentoDoNavegador() {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }
}
