# Melhorias de UX — operação

Este pacote aplica as solicitações do documento de 24/09/2026 ao repositório `ClaudioHideki/Bar_JRC_eventos`, que o Dokploy usa com Docker Compose. A base de produção estava em `b3d8a67` antes destas mudanças.

## Antes de disponibilizar

1. Faça backup do volume PostgreSQL `jrc_passaporte_postgres_data` e confira a restauração antes de apontar o Dokploy para a versão aprovada. Mantenha o mesmo serviço Compose e o mesmo volume; não execute seed nem recrie o banco existente.
2. O `Dockerfile` já executa `npx prisma migrate deploy` antes de iniciar a aplicação. As sete migrações existentes permanecem intactas e as duas novas apenas adicionam colunas, índices e tabelas. O teste local aplicou as nove migrações em ordem num banco PostgreSQL 16 vazio.
3. Configure SMTP se quiser envio individual por e-mail e recuperação automática por e-mail. Sem SMTP, o administrador pode preparar o link de recuperação em `/admin/participantes` e abrir a conversa do WhatsApp para enviar manualmente.
4. Os campos antigos `User.phone` e `Invitation.phone` permanecem no banco. A lista e a recuperação usam esses números como alternativa aos novos campos. Números antigos inválidos são ignorados até correção manual no painel; nenhum telefone existente é alterado automaticamente.
5. No painel `/admin/temas`, carregue a logo do login e salve. A página `/login` lê a imagem do programa ativo sem novo build. O favicon BAR JRC foi obtido da pasta indicada no PDF e é distribuído como arquivo estático.

## Convites e mensagens

- Convites nominais podem guardar WhatsApp e e-mail. O servidor impede novo convite com número já cadastrado em um participante ou vinculado a convite ativo.
- A ativação exige o WhatsApp vinculado ao convite, quando informado. As rotas públicas antigas de ativação por OTP retornam `410` porque não coletavam o número e permitiam contornar a associação.
- **Preparar lista de WhatsApp** processa convites em lotes de 50 e mostra nome, número e botão para abrir cada conversa. Quando o WhatsApp já pertence a um participante ativo, mesmo que associado a outro convite, a mensagem contém somente o link de login. Convites pendentes ou expirados sem cadastro recebem um link de ativação com validade de 24 horas. Destinatários sem WhatsApp válido ou com número ligado a vários cadastros são marcados como ignorados. Uma falha individual aparece no resultado do lote.
- O botão de WhatsApp não envia mensagens automaticamente: o link `api.whatsapp.com/send` exige a confirmação de envio na conversa. Não há envio em massa por e-mail.
- Preparar um convite ainda válido cria um link adicional e estende sua validade para 24 horas. Ao renovar um convite expirado, os links anteriores são invalidados. O token bruto dos links adicionais não é armazenado no banco.
- A redação da mensagem de login segue o PDF, inclusive a menção a setembro de 2027. Outras telas ainda descrevem a campanha de 2026 e dezembro; o calendário oficial deve ser confirmado antes de alterar eventos existentes.
- Cor e negrito da referência são reproduzidos no e-mail HTML. O WhatsApp mantém sua formatação de texto nativa e não oferece cor de fonte no link de conversa.

## Avaliação e recuperação

- Após carimbo confirmado, o participante vê a avaliação do evento no passaporte, com nota inteira de 0 a 10 e comentário opcional de até 2.000 caracteres. Há uma resposta por passaporte e evento. O administrador consulta as respostas em `/admin/avaliacoes`.
- Em `/recuperar-senha`, o participante informa o WhatsApp cadastrado. Com SMTP configurado, o sistema envia ao e-mail da conta um link de uso único válido por 15 minutos. Sem SMTP, o administrador prepara esse link no painel de participantes e confirma o envio manualmente pelo WhatsApp. A página de redefinição exige nova senha de 8 a 128 caracteres e encerra as sessões antigas.
- Não se envia senha em texto claro. Não há envio automático pelo WhatsApp nem provedor externo configurado.

## Verificação

Use `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration` com o PostgreSQL de teste na porta 5433 e `npm run build`. As migrações `20260924150000_ux_passaporte` e `20260924160000_invitation_delivery_tokens` adicionam as colunas, índices e tabelas necessárias sem alterar as colunas antigas.
