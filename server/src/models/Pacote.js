/**
 * Gera um UUID v4.
 *
 * crypto.randomUUID() exige contexto seguro (HTTPS).
 * Como o projeto pode estar sendo executado via HTTP na AWS,
 * usamos crypto.getRandomValues() como fallback.
 */
function gerarUUID() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // UUID versão 4
  bytes[6] = (bytes[6] & 0x0f) | 0x40;

  // Variante RFC 4122
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(
    bytes,
    byte => byte.toString(16).padStart(2, '0')
  );

  return (
    hex.slice(0, 4).join('') + '-' +
    hex.slice(4, 6).join('') + '-' +
    hex.slice(6, 8).join('') + '-' +
    hex.slice(8, 10).join('') + '-' +
    hex.slice(10, 16).join('')
  );
}

/**
 * Modelo Pacote — Objeto de dados transportado
 * entre CelularUsuario e ServidorCentral
 */
class Pacote {
  constructor({
    texto,
    remetente,
    destinatarios = [],
    tipo = 'PUBLICO',
    status = 'ENVIADA'
  }) {
    this.id = gerarUUID();
    this.texto = texto;
    this.remetente = remetente;
    this.destinatarios = destinatarios;
    this.tipo = tipo;
    this.timestamp = new Date().toISOString();
    // Padrão State (EstadoMensagem) — só é relevante para mensagens PRIVADO;
    // avança ENVIADA → ENTREGUE → LIDA conforme ServidorCentral._avancarEstadoMensagem().
    this.status = status;
  }

  toJSON() {
    return {
      id: this.id,
      texto: this.texto,
      remetente: this.remetente,
      destinatarios: this.destinatarios,
      tipo: this.tipo,
      timestamp: this.timestamp,
      status: this.status,
    };
  }
}

module.exports = Pacote;