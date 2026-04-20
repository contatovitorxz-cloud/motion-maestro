
# Corrigir o bloqueio de login do usuário atual

## Objetivo
Liberar o acesso para o email `comercial.vitor12@gmail.com` e evitar que a tela de login continue travando com “Email not confirmed”.

## Diagnóstico confirmado
O backend está recusando o login com erro `email_not_confirmed` no endpoint de autenticação. Isso indica que essa conta específica foi criada antes da confirmação automática ser ativada. A configuração nova ajuda apenas contas criadas depois disso; ela não corrige usuários antigos já pendentes.

## Plano de implementação

### 1) Desbloquear a conta existente
Executar uma ação administrativa no backend para que o email atual volte a ser utilizável. Há dois caminhos seguros:
- remover o usuário antigo não confirmado para permitir novo cadastro com o mesmo email; ou
- marcar administrativamente o email como confirmado, se a ferramenta disponível permitir.

Preferência de execução:
- primeiro tentar confirmar o usuário existente;
- se isso não for possível no ambiente gerenciado, remover o usuário pendente e recriá-lo com o mesmo email.

### 2) Melhorar a tela de autenticação
Atualizar `/auth` para tratar esse caso com clareza:
- trocar a mensagem técnica por algo em português e mais útil;
- mostrar estado específico para “email não confirmado”;
- adicionar ação visível de “reenviar confirmação”;
- manter redirecionamento automático para `/dashboard` quando a sessão existir.

### 3) Adicionar recuperação de acesso
Implementar o fluxo completo de recuperação:
- link “Esqueci minha senha” na tela de login;
- envio de redefinição de senha;
- nova rota pública `/reset-password`;
- formulário para definir nova senha após abrir o link.

Isso evita novos bloqueios e melhora a entrada do usuário.

### 4) Revisar o fluxo de cadastro
Ajustar o signup para que novos usuários tenham um comportamento coerente com a configuração atual:
- se confirmação automática estiver ligada, o app deve orientar para entrar direto;
- se em algum momento a confirmação voltar a ser exigida, o app já terá o botão de reenviar email.

### 5) Validar ponta a ponta
Testar estes cenários:
- login com `comercial.vitor12@gmail.com`;
- cadastro de um novo usuário;
- logout e novo login;
- recuperação de senha;
- tentativa com credenciais inválidas.

## Resultado esperado
- o email atual consegue entrar normalmente;
- a tela de auth deixa de falhar de forma “silenciosa”;
- o app passa a ter fluxos completos de login, reenvio de confirmação e reset de senha.

## Detalhes técnicos
- Arquivos prováveis: `src/pages/Auth.tsx`, `src/App.tsx`, nova página `src/pages/ResetPassword.tsx`, possivelmente `src/hooks/useAuth.ts`.
- Não é necessário alterar o cliente gerado de backend.
- A causa raiz não está no formulário em si; está no estado da conta já criada no backend.
