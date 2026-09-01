const EstadoPresenca = require('../interfaces/EstadoPresenca');

/**
 * EstadoAusente — Estado Concreto (Padrão State)
 *
 * O socket continua ativo (o usuário só está inativo ou marcou o status
 * manualmente), então a entrega em tempo real é idêntica ao EstadoOnline.
 * O gatilho de resposta automática (Auto-Reply Strategy) é disparado pelo
 * CelularUsuario no cliente — é ele quem decide o texto e reenvia usando
 * a EstrategiaEnvio EnvioPrivado, reaproveitando o padrão Strategy já
 * existente no projeto.
 */
class EstadoAusente extends EstadoPresenca {
  entregarMensagem(pacote, { io, socketId }) {
    if (!socketId) return false;
    io.to(socketId).emit('mensagem_recebida', pacote.toJSON ? pacote.toJSON() : pacote);
    return true;
  }

  get rotulo() {
    return 'Ausente';
  }
}

module.exports = EstadoAusente;
