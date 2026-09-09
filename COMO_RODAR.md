# Guia Rápido: Como Rodar o Passaporte JRC em Outro Computador / Servidor

Este pacote contém o código-fonte completo do sistema **Passaporte de Eventos JRC**, incluindo banco de dados, autenticação passwordless, scanner de QR Code dinâmico, painel administrativo e testes.

---

## 1. Pré-requisitos no Novo Ambiente

1. **Node.js**: Versão 20.0.0 ou superior (recomendado Node 20 LTS ou 22/24).
   - Verifique com: `node -v` e `npm -v`
2. **Docker e Docker Compose** (para rodar o banco PostgreSQL ou toda a aplicação em container):
   - Verifique com: `docker -v` e `docker compose version`

---

## 2. Opção A — Rodando Localmente com Node.js + Docker (Mais rápido para desenvolvimento)

### Passo 1: Configurar as Variáveis de Ambiente
Copie o arquivo de exemplo para `.env`:
- No Windows (PowerShell):
  ```powershell
  Copy-Item .env.example .env
  ```
- No Linux / macOS:
  ```bash
  cp .env.example .env
  ```

*(O `.env.example` já vem pré-configurado com portas e segredos padrão para teste local).*

### Passo 2: Instalar as Dependências
```bash
npm install
```

### Passo 3: Subir o Banco de Dados PostgreSQL
Suba apenas o serviço de banco via Docker:
```bash
docker compose up -d postgres
```
*(Ou se preferir usar uma porta de teste isolada: `docker compose -f docker-compose.test.yml up -d`)*

### Passo 4: Aplicar as Migrações do Banco
```bash
npx prisma migrate deploy
```

### Passo 5: Inicializar os Dados Fictícios e 30 Convites (Seed)
```bash
npm run seed
```
Este comando criará:
- O ciclo do programa **Passaporte JRC 2026**;
- Os 3 eventos corporativos;
- Os 30 convites (`convite-participante-01` até `convite-participante-30`);
- A conta de Administrador: `admin@jrc.com.br`;
- A conta de Atendente: `atendente@jrc.com.br`.

### Passo 6: Iniciar o Servidor Web
```bash
npm run dev
```

Acesse no navegador: **[http://localhost:3000](http://localhost:3000)**

---

## 3. Opção B — Rodando 100% via Docker Compose (Sem precisar instalar Node)

Se a outra máquina tiver apenas Docker:

```bash
# 1. Cria o .env
cp .env.example .env

# 2. Constrói e sobe todos os containers (Banco + Web)
docker compose up --build -d

# 3. Executa as migrações e o seed dentro do container
docker compose exec web npx prisma migrate deploy
docker compose exec web npm run seed
```

Acesse: **[http://localhost:3000](http://localhost:3000)**

---

## 4. Como Navegar e Testar os Perfis

| Perfil | Como Acessar | O que testar |
|---|---|---|
| **🛡️ Administrador** | Acesse `/login`, clique em `admin@jrc.com.br` e use o código exibido na tela | Painel geral em `/admin`, gestão dos 30 convites, ranking, carimbos manuais e auditoria |
| **📱 Atendente** | Acesse `/login`, clique em `atendente@jrc.com.br` e use o código na tela | Scanner de câmera em `/atendimento` ou digitação de código para carimbar presença |
| **🎟️ Participante** | Acesse `/convite/convite-participante-01` e informe seu nome/e-mail | Ativação do passaporte, emissão do passaporte virtual e botão de QR Code dinâmico |

> **Nota:** Em modo de desenvolvimento/local, qualquer código OTP gerado é exibido em uma caixinha dourada na própria tela e também impresso no terminal, facilitando o teste imediato sem necessidade de servidor SMTP.

---

## 5. Como Rodar a Suíte de Testes

```bash
npm run test:unit         # Testes unitários puros (regras de negócio e segurança)
npm run test:integration  # Testes de integração com banco PostgreSQL real
npm run typecheck         # Validação de tipagem estrita do TypeScript
npm run lint              # Verificação estática com ESLint
npm run build             # Build de produção otimizado Next.js
```
