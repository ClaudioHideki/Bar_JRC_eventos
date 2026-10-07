# Ajustes do Passaporte JRC — outubro de 2026

## Convites e WhatsApp

- A lista de WhatsApp no painel é manual. Preparar a lista não envia mensagens. Cada conversa precisa ser aberta e enviada pelo administrador.
- O reenvio para um telefone associado a participante ativo usa uma mensagem de **acesso** com o link de login. Apenas quem ainda não se cadastrou recebe mensagem de **convite**.
- A mensagem de acesso para participante cadastrado segue o modelo “Seu Passaporte Digital está pronto para receber o carimbo de hoje”, com nome, instrução para procurar o atendente, regra dos 12 carimbos e link de login. O WhatsApp recebe a formatação de negrito compatível com seu texto; a versão de e-mail mantém o destaque vermelho.
- Nomes, telefones e fotos já cadastradas são exibidos na lista, quando disponíveis. A imagem anexa à conversa deve ser escolhida manualmente no WhatsApp.
- A lista filtra números válidos e repetidos. O botão **Abrir próximo WhatsApp para envio** abre uma conversa por vez; abrir a conversa não comprova que a mensagem foi enviada.
- Se o telefone já pertence a um participante ativo, o formulário mostra o cadastro para conferência. **Confirmar dados** salva eventuais correções e prepara uma mensagem de acesso pelo WhatsApp, sem criar outro convite.
- Quando não existe provedor oficial de WhatsApp nem SMTP configurado, a página de recuperação orienta o participante a solicitar ao administrador um link temporário. A equipe gera o link na lista de participantes e o envia manualmente. Senhas nunca são enviadas.

## Roleta administrativa

- Aba `/admin/roleta`, exclusiva de administradores. Os giros não estão ligados a passaportes.
- A arte contém os prêmios de R$ 1.000, R$ 2.000, R$ 3.000, R$ 4.000 e R$ 5.000. O administrador configura peso de sorteio e limite por prêmio.
- A chance efetiva é o peso do prêmio dividido pela soma dos pesos de prêmios ainda disponíveis. O tamanho visual dos setores não reflete pesos diferentes.
- O servidor sorteia com `crypto.randomInt` dentro de transação PostgreSQL que bloqueia o programa; registra o resultado e incrementa a quantidade sorteada. O limite também é imposto por restrição no banco.
- O histórico de giros permanece registrado. A roleta não executa pagamento nem atribui o prêmio a um participante.
- A tela de giro mostra apenas a roleta, em uma área branca, e o resultado. Chances, limites e histórico ficam na aba administrativa `/admin/roleta/ajustes`.
- Em Ajustes, o administrador pode excluir um giro ou limpar todos os giros. A exclusão anula os registros, devolve cada prêmio ao limite disponível e cria uma entrada de auditoria; os registros anulados permanecem no banco para rastreabilidade.

## Implantação e dados

- A migração `20261005150000_admin_wheel` **adiciona** apenas tabelas `WheelPrize` e `WheelSpin`, índices e restrições; não apaga nem atualiza clientes, telefones, convites ou passaportes existentes.
- A migração `20261005170000_wheel_spin_void` adiciona campos de anulação à tabela de giros existente, sem apagar resultados anteriores.
- O `Dockerfile` executa `prisma migrate deploy` ao iniciar a aplicação. O Compose preserva o volume nomeado `jrc_passaporte_postgres_data`.
- Fazer backup do volume PostgreSQL antes do deploy, confirmar o banco de destino e verificar a aba da roleta após o deploy. Inicialmente os limites e pesos são zero; o administrador precisa configurá-los antes do primeiro giro.
- O favicon usa a arte transparente enviada. A página inicial e o cabeçalho administrativo consultam a logo salva no tema ativo.
- Novas logos escolhidas em Temas são padronizadas em uma imagem quadrada de 800 × 800 px antes de salvar. A entrada e o login exibem a imagem de forma responsiva; o cabeçalho administrativo amplia a marca mesmo quando a arte contém margens internas.
- As tabelas administrativas exibem controles de rolagem lateral acima dos dados quando há colunas ocultas. A coluna de ações dos convites permanece visível durante a rolagem, e o menu administrativo quebra em linhas em telas estreitas.
