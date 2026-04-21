
# Pivot: Claude + skill Remotion gera o MP4 diretamente, plataforma só exibe e edita

Entendi. Sem worker externo, sem Render.com, sem renderer client-side. O **Claude com a skill Remotion** monta o projeto Remotion completo e renderiza o MP4 numa sandbox dele. A plataforma:

1. Manda o prompt + assets fixados pro Claude
2. Recebe o MP4 pronto + os fontes Remotion (TSX)
3. Mostra o vídeo no preview central
4. Cada nova mensagem no chat = patch nos fontes Remotion daquele vídeo + re-render

## Arquitetura nova

```text
User msg + pinned assets
        │
        ▼
edge: chat-edit (Claude com skill remotion-video)
   - tool: scaffold_project   → cria src/Root.tsx, MainVideo.tsx, scenes/*
   - tool: render_mp4         → bundle + renderMedia → out.mp4
   - tool: patch_files        → edita TSX existente pra próxima iteração
        │
        ▼
edge retorna: { mp4_url, project_files[], project_version }
        │
        ▼
Frontend Editor:
   - <video src={mp4_url}> no preview central
   - chat lateral: cada msg manda { msg, current_project_files } pro chat-edit
   - Claude faz patch + re-render → novo mp4_url
```

## Por que isso funciona sem worker

A "skill remotion-video" descrita no contexto roda **dentro da própria edge function** via Lovable AI Gateway (o Claude tem acesso a tools que executam código numa sandbox dele). A edge function não precisa rodar Chromium — quem renderiza é o ambiente do Claude. Nós só recebemos a URL do MP4 final.

> Verificação: a skill exige `code--exec` (sandbox de execução). Vou confirmar via Lovable AI Gateway se o modelo `anthropic/claude-*` exposto suporta tool calling com execução de código. Se não suportar diretamente, o fallback é guardar o **plano Remotion** (JSON de cena + fontes TSX) no banco e renderizar via uma **GitHub Action** disparada por webhook — sem servidor pago, mas com ~1min de latência. Eu te aviso na implementação qual dos dois caminhos é viável.

## Mudanças no codebase

### 1) Banco — simplificar
- `render_jobs` vira `video_projects`:
  - `id`, `project_id`, `version` (int incremental), `mp4_url`, `source_files` (jsonb com `{path, content}[]`), `prompt`, `status`, `error`, `created_at`
- Cada mensagem do chat cria uma **nova versão**. Histórico fica navegável.
- Remover tabela `renders` antiga (não usada) e zerar `render_jobs`.

### 2) Edge function `chat-edit` — reescrita total
- Input: `{ projectId, message, pinnedAssetIds[], previousVersionId? }`
- Se `previousVersionId`: carrega `source_files` da versão anterior e manda pro Claude como contexto + pede **patch**.
- Se não: pede pro Claude **scaffold from scratch** seguindo a skill.
- Resolve `pinnedAssetIds` → signed URLs e injeta no prompt do Claude ("use estas imagens como assets").
- Recebe `{ mp4_base64 ou mp4_url, source_files }`.
- Faz upload do MP4 pro bucket `renders`.
- Cria row em `video_projects` com a nova versão.
- Retorna `{ versionId, mp4_url }`.

### 3) Remover infra antiga
- Deletar `supabase/functions/enqueue-render/`
- Deletar pasta `worker/` inteira
- Remover secrets `REMOTION_WORKER_URL` e `WORKER_SHARED_SECRET` (se setados)
- Remover `enqueue-render` calls do `Editor.tsx`

### 4) Frontend `Editor.tsx` — radicalmente simplificado
- Remover: timeline com tracks (motion/voice/captions), `MotionRenderer` CSS, `Timeline.tsx`, lógica de clips, `clipsRef`, `actionQueueRef`, fila de actions, `applyAiAction`.
- Adicionar:
  - `currentVideoVersion` state (puxa última row de `video_projects` do projeto)
  - `<video>` central simples com `src={currentVideoVersion.mp4_url}` + controls
  - Sidebar esquerda: lista de **versões** (clicável pra voltar a uma anterior)
  - Sidebar direita: assets + pinos (mantém)
  - Chat: cada send chama `chat-edit` com `previousVersionId = currentVideoVersion.id`
  - Loading state grande no preview enquanto renderiza ("🎬 Claude está montando seu vídeo… ~30s")
  - Realtime subscribe em `video_projects` desse projeto pra atualizar sozinho

### 5) `AiChat.tsx` — simplificar
- Remove streaming de actions / parsing de tool calls.
- Mensagem do user → 1 request → resposta com `{ versionId, mp4_url }` → adiciona msg do assistant tipo "✓ Versão 3 pronta" com mini-preview.

### 6) Pin de imagens (mantém)
- Continua funcionando igual: borda dourada, vai junto no payload pro Claude. Skill Remotion sabe usar `<Img src={staticFile(...)}>`.

## Fluxo final
1. User abre projeto novo → preview vazio com "Descreva seu vídeo no chat →"
2. Fixa logo (📌) e digita "intro de 10s pro lançamento do iPhone 17, fundo dark, logo no centro com glow"
3. Loading 30-60s → MP4 aparece no preview central
4. "deixa o fundo roxo" → loading 20s → novo MP4, versão 2 na sidebar
5. Botão Download = baixa o MP4 da versão atual

## O que fica fora
- Timeline editável manualmente (clips, tracks, drag) — confia no Claude
- Preview frame-a-frame em tempo real (só MP4 final)
- Edição de áudio separada (Claude já embute via skill voiceover)
- Render local no browser

## Ordem de execução
1. Migration: nova tabela `video_projects`, dropar `render_jobs` e `renders`
2. Reescrever `chat-edit` com a integração da skill Remotion
3. Deletar `worker/` e `enqueue-render/`
4. Reescrever `Editor.tsx` (preview + lista de versões)
5. Simplificar `AiChat.tsx`
6. Testar end-to-end com prompt + logo fixada

## Confirmação que preciso antes de codar
Vou validar na implementação se o Claude via Lovable AI Gateway consegue **executar a skill remotion-video** (que precisa de `code--exec`). Se não der, te aviso e proponho o fallback de GitHub Actions (assíncrono, ~1-2min). Sem worker pago de qualquer jeito.
