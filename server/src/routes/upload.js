const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const TAMANHO_MAXIMO = 8 * 1024 * 1024; // 8MB

/**
 * Rota de upload de imagens — pré-requisito do Padrão Iterator (MediaIterator):
 * sem um jeito de anexar fotos à mensagem, não existe galeria de mídia pra
 * navegar. Salva o arquivo em disco (server/uploads) e devolve só a URL —
 * o arquivo em si nunca trafega pelo Socket.IO, só a URL vai dentro do Pacote.
 * @param {string} pastaUploads - caminho absoluto da pasta onde salvar os arquivos
 * @returns {express.Router}
 */
function criarRotasUpload(pastaUploads) {
  if (!fs.existsSync(pastaUploads)) {
    fs.mkdirSync(pastaUploads, { recursive: true });
  }

  const armazenamento = multer.diskStorage({
    destination: (req, file, cb) => cb(null, pastaUploads),
    filename: (req, file, cb) => {
      const extensao = path.extname(file.originalname) || '.jpg';
      cb(null, `${crypto.randomUUID()}${extensao}`);
    },
  });

  const upload = multer({
    storage: armazenamento,
    limits: { fileSize: TAMANHO_MAXIMO },
    fileFilter: (req, file, cb) => {
      if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
        cb(new Error('Tipo de arquivo não suportado — envie apenas imagens (jpg, png, gif, webp)'));
        return;
      }
      cb(null, true);
    },
  });

  const router = express.Router();

  router.post('/imagem', (req, res) => {
    upload.single('arquivo')(req, res, (err) => {
      if (err) {
        console.error('[Upload] Erro ao processar imagem:', err.message);
        res.status(400).json({ status: 'erro', mensagem: err.message });
        return;
      }
      if (!req.file) {
        res.status(400).json({ status: 'erro', mensagem: 'Nenhum arquivo enviado' });
        return;
      }
      res.json({
        status: 'sucesso',
        url: `/uploads/${req.file.filename}`,
        nomeArquivo: req.file.originalname,
      });
    });
  });

  return router;
}

module.exports = criarRotasUpload;
