
# Render 100% no browser com Remotion Player + MediaRecorder

Sem worker, sem servidor, sem custo. O preview central vira um **Remotion Player** real (qualidade Remotion) e o export de MP4 acontece capturando o canvas via **MediaRecorder API** dentro do próprio browser do usuário.

## Como funciona

```text
Chat msg → edge chat-edit (Claude)
            │
            ▼
     Retorna MotionScene JSON
     (background, layers, duração, easings, assets fixados)
            │
            ▼
  Frontend: <Player component={MotionScene} inputProps={scene}>
            │  preview real, frame-perfect, 60fps
            │
            ▼
  User clica "Export MP4"
            │
            ▼
  Player render off-screen + MediaRecorder
  captura canvas → Blob → download .webm/.mp4
```

## Por que isso resolve teu problema

- **Zero infra**: não precisa Render.com, Fly, Docker, secrets de worker
- **Preview = output**: o que você vê no preview é exatamente o que sai no MP4
- **Edição instantânea**: cada msg do chat re-monta a `MotionScene` e o Player re-renderiza no mesmo segundo
- **Imagens fixadas funcionam**: vão como `assetUrls` no `inputProps` do Player
- **Qualidade Remotion**: usa `@remotion/player` (mesmo motor do server-side)

## Mudanças no código

### 1) Substituir preview central
- **Remover**: `MotionRenderer.tsx` (CSS-based) e `PreviewPlayer.tsx` atual
- **Criar**: `RemotionPlayer.tsx` usando `<Player>` do `@remotion/player` com `MotionComposition` (componente Remotion que lê `scene` props e renderiza com `interpolate`/`spring`)
- O `MotionComposition` reusa o mesmo schema de cena que o worker já consumia (`worker/src/MotionScene.tsx` vira a base) — só copia pra `src/remotion/MotionComposition.tsx`

### 2) Export MP4 no browser
- Botão "Export MP4" no header do editor
- Implementação: `playerRef.current.getContainerNode()` → captura via `canvas.captureStream(30)` → `MediaRecorder` com codec `video/webm;codecs=vp9` (qualidade alta) → Blob → `URL.createObjectURL` → `<a download>`
- **Importante sobre formato**: MediaRecorder do browser exporta `.webm` nativamente. Pra `.mp4` real precisa converter via `ffmpeg.wasm` (~25MB de download na primeira vez) ou aceitar `.webm` (menor, abre em qualquer player moderno). Default vai ser `.webm` com opção "Convert to MP4" que baixa o ffmpeg.wasm sob demanda.

### 3) Limpar infra de render server-side
- Deletar pasta `worker/` inteira (deploy tools removerão do repo)
- Deletar edge function `enqueue-render`
- Dropar tabelas `render_jobs` e `renders` (não usadas mais)
- Remover toda lógica de `triggerRender`, polling de jobs, signed URLs em `Editor.tsx`
- Manter `chat-edit` e `generate-narration` (esses são úteis)

### 4) Fluxo do chat simplificado
- Cada mensagem → `chat-edit` retorna `MotionScene` completa (não mais "actions" incrementais que precisam ser merged)
- Salva a cena em `projects.scene` (jsonb) — adicionar coluna via migration
- Player re-renderiza imediatamente quando `scene` muda
- Histórico de versões: cada `chat_messages` guarda a `scene` daquela iteração no `applied_actions` → user pode clicar numa msg antiga pra voltar

### 5) Pin de imagens (mantém)
- Continua igual visualmente
- Backend: edge function gera signed URLs dos pinned assets e injeta no prompt do Claude + retorna no `scene.assetUrls` pra Player consumir via `<Img src={assetUrls[id]}>`

## Trade-offs honestos

- **Áudio no export**: MediaRecorder captura o `<audio>` da narração se estiver tocando junto via `AudioContext.createMediaStreamDestination()`. Implementável mas adiciona complexidade — vou fazer.
- **Tempo de export**: ~real-time (vídeo de 15s leva ~15s pra exportar). Não tem como acelerar no browser.
- **Tamanho do projeto**: `@remotion/player` adiciona ~200KB ao bundle. Aceitável.
- **WebM vs MP4**: WebM por padrão (instantâneo), MP4 opcional via ffmpeg.wasm (lento na primeira vez).

## Ordem de execução
1. Migration: adicionar coluna `scene jsonb` em `projects`, dropar `render_jobs` e `renders`
2. Instalar `@remotion/player` (e `@ffmpeg/ffmpeg` lazy)
3. Criar `src/remotion/MotionComposition.tsx` portando lógica do `worker/src/MotionScene.tsx`
4. Criar `src/components/editor/RemotionPlayer.tsx` substituindo `PreviewPlayer`+`MotionRenderer`
5. Criar `src/lib/exportVideo.ts` (MediaRecorder + download)
6. Reescrever `chat-edit` pra retornar `MotionScene` completa em vez de actions incrementais
7. Simplificar `Editor.tsx`: remover queue de actions, clipsRef, triggerRender, polling de jobs
8. Deletar `worker/` e edge function `enqueue-render`
9. Testar end-to-end: prompt + logo fixada → preview → export
