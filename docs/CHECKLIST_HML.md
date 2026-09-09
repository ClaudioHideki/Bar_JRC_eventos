# Checklist de Homologação (Staging) — Passaporte de Eventos JRC

Execute este checklist em ambiente de homologação antes de liberar para produção.

---

## 1. Infraestrutura e Banco de Dados
- [ ] Container PostgreSQL 16 ativo e respondendo na porta configurada.
- [ ] Migrações do Prisma aplicadas com sucesso (`npx prisma migrate deploy`).
- [ ] Índice parcial `Stamp_confirmed_passport_event_key` verificado no banco.
- [ ] Endpoint `/api/health/ready` retornando `200 OK` com `database: "healthy"`.

## 2. Fluxo de Convites e Cadastro (Invite-Only)
- [ ] Criar lote de convites no painel `/admin/convites` (ou via seed).
- [ ] Tentar acessar `/cadastro` direto e confirmar que não existe cadastro público.
- [ ] Abrir link de convite válido `/convite/[token]` e verificar exibição do convite.
- [ ] Solicitar OTP de ativação e conferir recebimento no e-mail.
- [ ] Digitar OTP incorreto 3 vezes e verificar bloqueio temporário por rate limiting.
- [ ] Digitar OTP correto e verificar login automático imediato redirecionando para `/passaporte`.
- [ ] Tentar reutilizar o mesmo link de convite e confirmar mensagem de "Convite já utilizado".
- [ ] Validar limite de 30 convites (tentativa do 31º participante deve ser rejeitada).

## 3. Experiência do Participante
- [ ] Passaporte exibe o progresso de carimbos (0 de N eventos).
- [ ] Botão "Apresentar QR Code" abre modal com QR Code e cronômetro de 5 minutos.
- [ ] Aguardar 5 minutos e verificar expiração visual do QR Code.
- [ ] Gerar novo QR Code e confirmar atualização do token.

## 4. Experiência do Atendente (Scanner de Presença)
- [ ] Atendente faz login via OTP em `/login`.
- [ ] Acessa `/atendimento` e seleciona o evento ativo.
- [ ] Concede permissão de câmera e lê o QR Code do participante.
- [ ] Clica em "Confirmar Carimbo" e verifica retorno verde de sucesso.
- [ ] Tenta ler o mesmo QR Code novamente e recebe alerta "Carimbo Já Registrado".
- [ ] Testa a contingência manual de digitação de código na tela de atendimento.

## 5. Painel de Marketing / Administrador
- [ ] Admin acessa `/admin` e visualiza métricas de convites, presença e taxa de conversão.
- [ ] Tabela `/admin/participantes` exibe a lista atualizada com pontuação correta.
- [ ] Tabela `/admin/ranking` exibe o ranking em tempo real.
- [ ] Testar cancelamento justificado de carimbo em `/admin/carimbos` e verificar estorno de pontos.
- [ ] Testar concessão manual de carimbo por contingência em `/admin/carimbos`.
- [ ] Baixar exportação CSV e abrir no Excel/Planilhas para confirmar ausência de caracteres corrompidos e sanitização contra fórmulas.
- [ ] Verificar que todas as ações acima geraram entradas em `/admin/auditoria`.
