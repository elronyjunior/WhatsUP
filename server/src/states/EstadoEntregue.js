const EstadoMensagem = require('../interfaces/EstadoMensagem');
const EstadoLida = require('./EstadoLida');

/**
 * EstadoEntregue — Estado Concreto (Padrão State)
 *
 * O socket do destinatário recebeu o pacote (entrega ao vivo confirmada
 * pelo EstadoPresenca dele) ou ele carregou a mensagem via histórico ao
 * reconectar. Só permite avançar para Lida — nunca regride para Enviada.
 */
class EstadoEntregue extends EstadoMensagem {
  avancarPara(rotulo) {
    if (rotulo === 'LIDA') return new EstadoLida();
    return this;
  }

  get rotulo() {
    return 'ENTREGUE';
  }
}

module.exports = EstadoEntregue;
