const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const cassandraClient = require('./src/database/CassandraClient');
const UsuarioRepository = require('./src/repositories/UsuarioRepository');
const MensagemRepository = require('./src/repositories/MensagemRepository');
const GrupoRepository = require('./src/repositories/GrupoRepository');
const criarRotasAuth = require('./src/routes/auth');
const ServidorCentral = require('./src/ServidorCentral');

const app = express();
const httpServer = http.createServer(app);

// Configuração do Socket.IO com CORS aberto para desenvolvimento
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Serve os arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../chat_app')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../chat_app/index.html'));
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ServidorCentral online',
    padrao: 'Observer + Strategy',
    banco: 'Cassandra',
    timestamp: new Date().toISOString(),
  });
});

// ─── Inicialização assíncrona ─────────────────────────────────────────────────
async function iniciar() {
  try {
    // Conecta ao Cassandra
    const db = await cassandraClient.connect();

    // Inicializa repositórios
    const usuarioRepo = new UsuarioRepository(db);
    const mensagemRepo = new MensagemRepository(db);
    const grupoRepo = new GrupoRepository(db);

    // Registra rotas de autenticação
    app.use('/api/auth', criarRotasAuth(usuarioRepo));

    // Inicializa o ServidorCentral (Padrão Observer) com repositórios
    const servidorCentral = new ServidorCentral(io, { mensagemRepo, grupoRepo });

    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║        SERVIDOR CENTRAL — ONLINE         ║');
      console.log('║  Padrões: Observer + Strategy            ║');
      console.log('║  Banco: Apache Cassandra                 ║');
      console.log(`║  http://localhost:${PORT}                   ║`);
      console.log('╚══════════════════════════════════════════╝\n');
    });
  } catch (err) {
    console.error('❌ [Servidor] Falha ao iniciar:', err.message);
    process.exit(1);
  }
}

iniciar();
