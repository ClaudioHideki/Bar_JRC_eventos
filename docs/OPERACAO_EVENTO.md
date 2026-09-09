# Guia de Operação no Dia do Evento — Passaporte de Eventos JRC

## 1. Visão Geral para a Equipe de Campo

Este manual orienta recepcionistas, atendentes de estandes e coordenadores do evento na validação de presenças e carimbos dos 30 participantes.

---

## 2. Instruções para o Atendente (Recepcionista)

### 2.1. Acesso à Tela de Leitura
1. Acesse o endereço do sistema no smartphone ou tablet: `https://passaporte.seudominio.com.br/atendimento`.
2. Efetue login com o seu e-mail de atendente previamente cadastrado (receberá código OTP de 6 dígitos no e-mail).
3. Selecione no menu superior o **Evento** no qual você está operando (ex: *Palestra Magna JRC 2026* ou *Workshop Inovação*).

### 2.2. Leitura do QR Code do Convidado
1. Peça para o participante abrir seu passaporte no celular em `https://passaporte.seudominio.com.br/passaporte` e clicar em **"Apresentar QR Code"**.
2. Aponte a câmera do scanner da tela `/atendimento` para o QR Code do convidado.
3. A tela exibirá instantaneamente a confirmação com o nome do convidado.
4. Clique no botão **"Confirmar Carimbo"**.
5. O sistema exibirá mensagem verde de sucesso: **"Presença Carimbada com Sucesso!"**.

---

## 3. Contingências e Resolução de Problemas

### 3.1. QR Code Expirou ou Não Abre
- **Causa**: O QR Code do participante tem validade de 5 minutos por segurança. Se ele deixou a tela aberta muito tempo, o código expirará.
- **Ação**: Oriente o participante a fechar o modal e clicar novamente em **"Apresentar QR Code"** para gerar um código novo em tempo real.

### 3.2. Câmera do Dispositivo não Funciona
- **Causa**: Permissão de câmera bloqueada no navegador ou incompatibilidade de hardware.
- **Ação**: Na tela de atendimento, use a aba **"Digitação Manual"**. Peça para o participante ditar o código numérico/token efêmero que aparece logo abaixo do QR Code dele.

### 3.3. Convidado Sem Bateria ou Sem Conexão 4G
- **Ação do Coordenador (ADMIN)**: O administrador do evento pode acessar `/admin/carimbos`, clicar em **"Emissão Manual por Contingência"**, selecionar o participante, o evento e preencher a justificativa obrigatória (ex: *Aparelho do participante descarregou na entrada da palestra*).

### 3.4. Mensagem "Carimbo Já Registrado"
- **Significado**: O participante já recebeu o carimbo deste evento específico anteriormente. O sistema rejeita duplicidade automaticamente para manter a integridade da premiação/ranking.
