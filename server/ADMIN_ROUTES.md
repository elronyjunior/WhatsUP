# 🔑 Rotas Admin - Visualização do Banco de Dados

## Endpoints Disponíveis

### 1️⃣ Banco Completo
**GET** `/api/admin/database`

Retorna **toda a estrutura** do banco com dados de todas as tabelas.

**Resposta:**
```json
{
  "status": "sucesso",
  "banco": "whatsup_chat",
  "timestamp": "2026-08-18T10:30:45.123Z",
  "database": {
    "usuarios": {
      "colunas": [
        { "nome": "username", "tipo": "text" },
        { "nome": "senha_hash", "tipo": "text" }
      ],
      "linhas": [...],
      "totalLinhas": 5
    },
    "mensagens": {
      "colunas": [...],
      "linhas": [...],
      "totalLinhas": 42
    },
    "grupos": {...},
    "grupo_membros": {...}
  }
}
```

### 2️⃣ Tabela Específica com Dados
**GET** `/api/admin/database/:tabela?limite=50`

Retorna os dados de uma tabela específica.

**Exemplos:**
```bash
# Listar todos os usuários (máx 50)
GET http://localhost:3000/api/admin/database/usuarios

# Listar últimas 100 mensagens
GET http://localhost:3000/api/admin/database/mensagens?limite=100

# Listar grupos (máx 50)
GET http://localhost:3000/api/admin/database/grupos
```

**Resposta:**
```json
{
  "status": "sucesso",
  "tabela": "usuarios",
  "colunas": [
    { "nome": "username", "tipo": "text" },
    { "nome": "senha_hash", "tipo": "text" },
    { "nome": "criado_em", "tipo": "timestamp" }
  ],
  "linhas": [
    { "username": "João", "senha_hash": "...", "criado_em": "2026-08-18..." },
    { "username": "Maria", "senha_hash": "...", "criado_em": "2026-08-18..." }
  ],
  "totalLinhas": 2,
  "timestamp": "2026-08-18T10:30:45.123Z"
}
```

### 3️⃣ Schema Apenas (Colunas)
**GET** `/api/admin/database/:tabela/schema`

Retorna **apenas as colunas** sem dados.

**Exemplo:**
```bash
GET http://localhost:3000/api/admin/database/mensagens/schema
```

**Resposta:**
```json
{
  "status": "sucesso",
  "tabela": "mensagens",
  "colunas": [
    { "nome": "conversa_id", "tipo": "text" },
    { "nome": "timestamp", "tipo": "timestamp" },
    { "nome": "remetente", "tipo": "text" },
    { "nome": "texto", "tipo": "text" },
    { "nome": "tipo", "tipo": "text" }
  ],
  "timestamp": "2026-08-18T10:30:45.123Z"
}
```

### 4️⃣ Contar Linhas
**GET** `/api/admin/database/:tabela/count`

Retorna a contagem total de linhas de uma tabela.

**Exemplo:**
```bash
GET http://localhost:3000/api/admin/database/mensagens/count
```

**Resposta:**
```json
{
  "status": "sucesso",
  "tabela": "mensagens",
  "total": 1847,
  "timestamp": "2026-08-18T10:30:45.123Z"
}
```

---

## 📊 Exemplos de Uso no Terminal

### Com CURL

```bash
# Ver banco inteiro
curl http://localhost:3000/api/admin/database

# Ver usuários
curl http://localhost:3000/api/admin/database/usuarios

# Ver últimas 20 mensagens
curl "http://localhost:3000/api/admin/database/mensagens_por_conversa?limite=20"

# Ver schema de grupos
curl http://localhost:3000/api/admin/database/grupos/schema

# Contar mensagens
curl http://localhost:3000/api/admin/database/mensagens_por_conversa/count
```

### Com PowerShell

```powershell
# Ver banco inteiro
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/database" | ConvertTo-Json -Depth 10

# Ver usuários
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/database/usuarios"

# Ver últimas 50 mensagens
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/database/mensagens_por_conversa?limite=50"
```

### Com Node.js/Fetch

```javascript
// Fetch do banco inteiro
const response = await fetch('http://localhost:3000/api/admin/database');
const data = await response.json();
console.log(JSON.stringify(data, null, 2));

// Fetch de uma tabela
const usuarios = await fetch('http://localhost:3000/api/admin/database/usuarios').then(r => r.json());
console.log(usuarios.linhas);
```

---

## 🔍 Tabelas Disponíveis

| Tabela | Descrição |
|--------|-----------|
| `usuarios` | Usuários registrados no sistema |
| `mensagens_por_conversa` | Todas as mensagens (geral, privado, grupo) |
| `grupos` | Grupos de chat criados |
| `grupos_por_membro` | Índice de grupos por membro |

---

## 🚀 Uso Rápido

Para **visualizar tudo em JSON formatado**:

```bash
curl http://localhost:3000/api/admin/database | python -m json.tool
```

Para **salvar em arquivo**:

```bash
curl http://localhost:3000/api/admin/database > banco_backup.json
```

---

## ⚙️ Segurança

⚠️ **IMPORTANTE**: Estas rotas admin estão **públicas para desenvolvimento**.

Em **produção**, adicione autenticação:

```javascript
// Adicione middleware de autenticação
app.use('/api/admin', autenticarAdmin, criarRotasAdmin(cassandraClient));
```

---

## 🔗 Integração

As rotas foram integradas em `server.js`:

```javascript
const criarRotasAdmin = require('./src/routes/admin');

// ... dentro de iniciar()
app.use('/api/admin', criarRotasAdmin(cassandraClient));
```
