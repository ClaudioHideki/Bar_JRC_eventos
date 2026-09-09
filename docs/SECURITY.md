# Segurança e Compliance — Passaporte de Eventos JRC

## 1. Princípios de Segurança

O sistema foi arquitetado com base no princípio de menor privilégio, defesa em profundidade e zero-trust para entradas de usuários.

---

## 2. Autenticação e Gestão de Sessões

- **Zero Senhas em Banco**: Utiliza autenticação passwordless via **Email OTP** com o framework **Better Auth 1.7.2**.
- **OTPs Criptograficamente Seguros**: 6 dígitos gerados por CSPRNG (`crypto.randomInt`).
- **Hashes SHA-256 de Códigos Efêmeros**: Códigos OTP nunca são salvos em texto claro no banco de dados.
- **Janela de Expiração**: 5 minutos.
- **Limite de Tentativas**: Bloqueio após 3 tentativas incorretas.
- **Cookies de Sessão**: `HttpOnly`, `SameSite=Lax`, `Secure` (em produção), prefixados e validados pelo Better Auth.

---

## 3. Modelo de Acesso Estritamente por Convite

1. **Bloqueio de Cadastro Público**: Qualquer tentativa de criar conta fora do fluxo com token de convite válido é interceptada no hook de banco do Better Auth (`before:create:user`) e abortada com erro de segurança.
2. **Tokens de Convite**: Gerados com 32 bytes de entropia CSPRNG e assinados via HMAC-SHA-256 usando o segredo `INVITATION_TOKEN_SECRET`.
3. **Consumo Único**: O convite transiciona de `PENDING` para `USED` de forma atômica no banco com conferência do limite de capacidade (30 participantes).

---

## 4. Proteção contra IDOR (Insecure Direct Object Reference)

- **Passaporte**: Participantes só podem ler o passaporte vinculado à sua própria `session.user.id`. Consultas em `/api/passport` e na página `/passaporte` realizam filtro mandatório por `userId: session.user.id`.
- **Desafios QR**: O QR Code transporta apenas um token efêmero aleatório assinado (`challengeToken`), sem expor o `passportId` ou `userId`.

---

## 5. Sanitização contra Injeção de Fórmulas em CSV (Anti-DDE)

Na exportação administrativa de relatórios em formato CSV, todos os campos de texto passam por sanitização contra execução arbitrária de código no Microsoft Excel / LibreOffice:
- Se a célula começar com `=`, `+`, `-`, `@`, `\t` ou `\r`, ela é prefixada com apóstrofo (`'`).
- Aspas duplas são escapadas (`""`) e o valor é encapsulado entre aspas.

---

## 6. Trilha de Auditoria e Redação de Dados Sensíveis

Todas as ações administrativas ou críticas registram um registro em `AuditLog`:
- **Ações Auditadas**: Criação/revogação de convites, emissão de carimbos presenciais, cancelamento justificado de carimbo, emissão manual de carimbo por contingência, logins.
- **Redação Automática**: Tokens, senhas, códigos OTP e chaves de sessão são filtrados antes da escrita no banco (`redactSafeMetadata`).

---

## 7. Rate Limiting Multi-Camada

A tabela `RateLimitBucket` atua como limitador sem dependência de Redis:
- **Requisição de OTP**: Máximo 3 por minuto por IP/e-mail.
- **Verificação de OTP**: Máximo 5 por minuto.
- **Geração de QR Code**: Máximo 10 por minuto por participante.
- **Tentativas de Carimbo**: Máximo 30 por minuto por atendente.
