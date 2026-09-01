/**
 * EstadoOnline — Estado Concreto (Padrão State)
 *
 * Usuário com a aplicação aberta, em foco, ou com atividade recente.
 * O balão da mensagem já é renderizado pelo app.js independentemente do
 * estado (isso é só a UI reagindo ao Observer). O que este estado decide
 * são os gatilhos secundários: som de notificação e, se a janela estiver
 * minimizada/em outra aba, notificação nativa do sistema operacional —
 * caso contrário, um toast dentro da própria aplicação.
 */
class EstadoOnline extends EstadoPresenca {
  aoReceberMensagem(pacote, contexto, chaveConversa) {
    const ganchos = contexto.ganchosUI;
    if (!ganchos) return;

    ganchos.tocarSom?.();

    if (ganchos.janelaOculta?.()) {
      ganchos.notificarNativo?.(pacote, chaveConversa);
    } else {
      ganchos.exibirToast?.(pacote, chaveConversa);
    }
  }

  get rotulo() {
    return 'Online';
  }

  get corCss() {
    return 'online';
  }
}
