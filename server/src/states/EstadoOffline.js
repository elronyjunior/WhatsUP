const EstadoPresenca = require('../interfaces/EstadoPresenca');

/**
 * EstadoOffline — Estado Concreto (Padrão State)
 *
 * Não há conexão de soquete ativa — o servidor retém o estado de que este
 * cliente não pode receber dados em tempo real. A mensagem não é enviada
 * para a rede; ela já foi (ou será) persistida no Cassandra pelo chamador
 * de ServidorCentral, que funciona como fila/buffer natural de pendências.
 *
 * Aqui apenas registramos a pendência e acionamos o fallback: em produção
 * isso dispararia um Push (Firebase Cloud Messaging) imediato e, se a
 * mensagem seguir sem confirmação de entrega, um e-mail-resumo depois de
 * um tempo. Este protótipo não tem credenciais reais de FCM/SMTP, então
 * os dois gatilhos são apenas simulados (via log) em agendarFallbackOffline.
 */
class EstadoOffline extends EstadoPresenca {
  entregarMensagem(pacote, { nomeDestino, agendarFallbackOffline }) {
    agendarFallbackOffline?.(pacote.toJSON ? pacote.toJSON() : pacote, nomeDestino);
    return false;
  }

  get rotulo() {
    return 'Offline';
  }
}

module.exports = EstadoOffline;
