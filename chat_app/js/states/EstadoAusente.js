/**
 * EstadoAusente — Estado Concreto (Padrão State)
 *
 * Usuário conectado, mas sem interação recente (ou que marcou o status
 * manualmente). A reação visual/sonora reaproveita a mesma regra do
 * EstadoOnline — o comentário da especificação deixa essa escolha em
 * aberto ("pode seguir a mesma regra do Online"). Além disso, dispara uma
 * resposta automática (Auto-Reply Strategy) para mensagens privadas,
 * reaproveitando a EstrategiaEnvio EnvioPrivado já existente no projeto —
 * uma única vez por remetente, para não responder em loop enquanto o
 * período Ausente durar.
 */
class EstadoAusente extends EstadoPresenca {
  constructor() {
    super();
    /** @type {Set<string>} remetentes que já receberam a auto-resposta nesta sessão Ausente */
    this._jaRespondido = new Set();
  }

  aoReceberMensagem(pacote, contexto, chaveConversa) {
    const ganchos = contexto.ganchosUI;
    if (ganchos) {
      ganchos.tocarSom?.();
      if (ganchos.janelaOculta?.()) {
        ganchos.notificarNativo?.(pacote, chaveConversa);
      } else {
        ganchos.exibirToast?.(pacote, chaveConversa);
      }
    }

    this._responderAutomaticamente(pacote, contexto);
  }

  /** Ação Ativa (Auto-Reply Strategy) — só para privado, uma vez por remetente */
  _responderAutomaticamente(pacote, contexto) {
    if (pacote.tipo !== 'PRIVADO') return;
    if (this._jaRespondido.has(pacote.remetente)) return;
    this._jaRespondido.add(pacote.remetente);

    contexto.mudarEstrategia(new EnvioPrivado(contexto.nome));
    contexto.escreverMensagem(
      'Estou longe do teclado no momento, mas vejo sua mensagem assim que retornar.',
      [pacote.remetente]
    );
  }

  get rotulo() {
    return 'Ausente';
  }

  get corCss() {
    return 'ausente';
  }
}
