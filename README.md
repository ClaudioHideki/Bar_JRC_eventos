# Passaporte de Eventos JRC

Sistema corporativo de emissão, gerenciamento e validação de carimbos em passaportes digitais para participantes convidados da JRC.

---

## 🚀 Visão Geral e Recursos

- **30 Participantes Exclusivos**: Controle transacional estrito de capacidade com teto máximo de 30 convites/participantes ativos.
- **Cadastro Exclusivamente por Convite (Invite-Only)**: Bloqueio total de cadastros públicos ou diretos no Better Auth; apenas links de convite válidos de uso único podem iniciar o fluxo de ativação.
- **Autenticação Passwordless OTP**: Acesso por código de 6 dígitos enviado por e-mail, com expiração de 5 minutos, limite de 3 tentativas, armazenamento explicitamente hashed e proteção contra enumeração de contas.
- **Passaporte Digital Individual**: Identificador amigável único (`JRC-2026-XXXX`), grade visual para carimbos conquistados e futuros, dados do participante e separação estrita entre apresentação visual e regras de negócio.
- **QR Code Temporário e Opaco**: Token criptográfico aleatório de uso único com validade de 5 minutos, sem dados pessoais ou identificadores internos no conteúdo do QR, e invalidação automática de desafios anteriores.
- **Área do Atendente com Scanner de Câmera**: Leitura ótica via câmera traseira com `@yudiel/react-qr-scanner`, resumo de conferência prévia, confirmação atômica de presença e proteção contra carimbos duplicados via índice parcial único no PostgreSQL.
- **Painel Administrativo Completo**: Dashboard de métricas executivas, gestão de convites (lote inicial, cópia de links, revogação), gestão de eventos (status `DRAFT`, `ACTIVE`, `ENDED`, `CANCELLED`), ranking administrativo de assiduidade, cancelamento justificado de carimbos (preservando histórico), contingência manual (`MANUAL_ADMIN`), logs de auditoria redigidos e exportação CSV com sanitização contra formula injection.
- **Rate Limiting em PostgreSQL**: Controle de taxa em banco relacional (`RateLimitBucket`) sem necessidade de Redis.
- **Pronto para Dokploy / Servidor Próprio JRC**: Dockerfile multi-stage (Node 24 Debian slim), docker-compose com PostgreSQL isolado da internet pública, health checks `/api/health/live` e `/api/health/ready`.

---

## 🛠️ Stack Tecnológica Homologada

- **Frontend / Backend**: Next.js 16 (App Router), React 18, TypeScript (Strict Mode), Tailwind CSS.
- **Banco de Dados**: PostgreSQL 16 com Prisma ORM 6.4.1.
- **Autenticação**: Better Auth 1.7.2 com plugin oficial Email OTP hashed e Prisma adapter.
- **QR Code**: Geração via `qrcode`, Leitura via câmera com `@yudiel/react-qr-scanner`.
- **Testes**: Vitest (testes unitários e integração com PostgreSQL real), Playwright (E2E).
- **Qualidade**: ESLint (Flat config) e Prettier.
- **Containerização**: Docker e Docker Compose.

---

## 📦 Inicialização Local e Comandos

### Pré-requisitos
- Node.js 20+ (recomendado Node 24 LTS)
- Docker e Docker Compose instalados e em execução

### 1. Clonar e Instalar Dependências
```bash
git clone https://github.com/weltonJRC/site-passaporte-JRC.git
cd site-passaporte-JRC
npm ci
```

### 2. Configurar Variáveis de Ambiente
Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

### 3. Subir PostgreSQL de Teste / Desenvolvimento
```bash
docker compose -f docker-compose.test.yml up -d
```

### 4. Executar Migrations e Seed de Homologação
```bash
npm run prisma:migrate
npm run prisma:seed
```

### 5. Iniciar em Modo de Desenvolvimento
```bash
npm run dev
```
Acesse a aplicação em `http://localhost:3000`.

---

## 🧪 Suíte de Testes Automatizados

### Testes Unitários
```bash
npm run test:unit
```
Valida: criptografia HMAC, normalização de e-mail, geração de tokens seguros, comparação em tempo constante, sanitização contra CSV formula injection, redação de auditoria e cálculo do teto de capacidade.

### Testes de Integração com PostgreSQL Real
```bash
npm run test:integration
```
Valida contra PostgreSQL real em container:
- Teto de capacidade de 30 convites no Programa;
- Substituição de convite revogado mantendo o teto;
- Ativação atômica de convite com OTP e emissão de passaporte;
- Bloqueio de múltiplos passaportes para o mesmo e-mail;
- Bloqueio rigoroso de cadastro direto sem convite;
- Desafio de QR Code temporário e uso único;
- Concorrência de carimbos e proteção por índice parcial único no PostgreSQL;
- Cancelamento justificado sem perda de histórico e novo carimbo subsequente;
- Rate limiting persistido em banco.

### Verificação de Tipos e Linter
```bash
npm run typecheck
npm run lint
```

### Build de Produção
```bash
npm run build
```

---

## 🔐 Primeiro Administrador (Bootstrap)

Para criar ou promover o primeiro administrador no sistema sem senhas:
```bash
npm run bootstrap:admin -- --email=seu.email@jrc.com.br
```
O comando valida que nenhum outro administrador existe, registra log de auditoria e habilita o acesso seguro via OTP.

---

## 📚 Documentação Técnica Adicional

- [Arquitetura e Fluxos do Sistema](docs/ARCHITECTURE.md)
- [Modelo de Dados e Dicionário](docs/DATABASE.md)
- [Políticas de Segurança e Criptografia](docs/SECURITY.md)
- [Guia de Deploy no Dokploy](docs/DOKPLOY.md)
- [Procedimentos de Backup e Restauração](docs/BACKUP_RESTORE.md)
- [Manual Operacional no Evento e Contingências](docs/OPERACAO_EVENTO.md)
- [Checklist de Homologação](docs/CHECKLIST_HML.md)
- [Checklist de Produção](docs/CHECKLIST_PRODUCAO.md)
- [Procedimento de Rollback](docs/ROLLBACK.md)
