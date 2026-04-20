
# Plataforma de Edição de Vídeo Motion com IA

Editor de vídeo profissional onde você sobe um vídeo, conversa com a IA num chat lateral, e ela gera/edita motion graphics, cortes inteligentes, legendas animadas, transições e até cenas inteiras estilo Remotion.

## Stack
- **Lovable Cloud** (Supabase) — auth, banco, storage de vídeos e renders
- **Lovable AI Gateway** (Gemini 3 Flash) — chat conversacional + interpretação de prompts em plano de edição estruturado (JSON)
- **Pipeline de renderização Remotion** — edge function chama renderer pra gerar o motion final
- **Tema Dark Pro** estilo CapCut/Premiere

## Layout principal (rota `/editor/:projectId`)

**Topbar (h-12):** logo, nome do projeto editável, botão Render/Export, avatar do usuário.

**3 colunas:**

1. **Sidebar esquerda (w-64, colapsável)** — Biblioteca
   - Meus projetos
   - Assets do projeto atual (vídeos enviados, imagens, áudios)
   - Botão "Upload" (drag & drop)
   - Presets de motion (lower-thirds, legendas, transições)

2. **Centro — Preview + Timeline**
   - **Preview player** grande (16:9, controles play/pause/seek/fullscreen, scrubber com thumbnails)
   - **Timeline** embaixo (h-48) com tracks: Vídeo, Overlays/Motion, Texto, Áudio, Legendas. Clipes arrastáveis, zoom, playhead sincronizado com o preview.

3. **Chat lateral direito (w-96, colapsável)** — IA
   - Histórico de mensagens (markdown renderizado)
   - Cards de "ação aplicada" (ex: *"Adicionei lower-third no segundo 0:03"* com botão Desfazer)
   - Input fixo embaixo + anexar frame/clipe + botão enviar
   - Indicador de streaming token-by-token
   - Sugestões rápidas: "Cortar silêncios", "Adicionar legendas", "Criar abertura motion"

## Telas adicionais
- **`/`** — Landing dark com hero + CTA "Entrar"
- **`/auth`** — Login/cadastro (email+senha, Google)
- **`/dashboard`** — Grid de projetos (thumbnail, nome, duração, última edição, status do render)
- **`/editor/:id`** — Editor descrito acima

## Banco de dados (Lovable Cloud)
- `profiles` — dados do usuário
- `user_roles` — papéis (tabela separada, com `has_role()`)
- `projects` — id, user_id, name, thumbnail_url, duration, status
- `assets` — id, project_id, type (video/image/audio), storage_path, metadata
- `timeline_clips` — id, project_id, track, start, end, asset_id, effects (jsonb)
- `chat_messages` — id, project_id, role, content, applied_actions (jsonb)
- `renders` — id, project_id, status, output_url, created_at

**Storage buckets:** `assets` (vídeos brutos, privado), `renders` (saídas, privado com signed URLs), `thumbnails` (público).

## Fluxo IA (edge function `chat-edit`)
1. Frontend envia mensagem + estado atual da timeline + lista de assets
2. Edge function chama Lovable AI com tool calling estruturado:
   - `add_text_overlay`, `add_lower_third`, `cut_silence`, `add_transition`, `generate_motion_scene`, `add_captions`, `trim_clip`, `reorder_clips`
3. Resposta da IA volta como (a) mensagem de texto streamada e (b) ações JSON aplicadas na timeline
4. Frontend atualiza timeline em tempo real, mostra card "ação aplicada" no chat

## Renderização (edge function `render-video`)
- Ao clicar Export, manda timeline + assets pra função
- Função monta job Remotion (template parametrizado por JSON)
- Salva MP4 em `renders` bucket, atualiza `renders.status`
- Frontend faz polling/realtime e mostra progresso + link de download

## Conectores
- **GitHub** — você conecta via aba Connectors (Lovable já sincroniza automaticamente, sem código necessário)
- **Lovable Cloud** — habilitado automaticamente ao implementar

## Pacotes novos
`react-markdown`, `react-dropzone`, `@remotion/player` (preview), `@remotion/renderer` (server-side via edge function)

## Visual
- Dark `hsl(220 13% 9%)` background, painéis `hsl(220 13% 12%)`, bordas sutis `hsl(220 13% 18%)`
- Accent roxo/azul vibrante pra ações primárias
- Tipografia Inter, mono pra timestamps
- Densidade alta tipo software pro, atalhos de teclado (Space=play, J/K/L=scrub, Ctrl+Z=undo)

## O que fica pra próximas iterações
- Renderização real do Remotion (vou stubar primeiro com preview client-side; render server-side é etapa 2)
- Colaboração multi-usuário em tempo real
- Versionamento de timeline / branches de edição
