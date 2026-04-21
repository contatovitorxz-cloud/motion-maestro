

# Deixar tudo funcionando — correções finais para o editor

Vou consertar o preview que sumiu, o play/pause travado, as ações da IA que recarregam tudo, a duração fixa de 30s, a sobreposição de clipes e o glow remanescente. Resultado: editor 100% utilizável.

## Bugs que vou corrigir

1. **Preview sumiu da tela** — falta `min-h-0` no flex do meio e altura mínima no monitor; a timeline está "comendo" a viewport.
2. **Espaço duplicado** — `Editor.tsx` e `PreviewPlayer.tsx` registram o mesmo listener, cancelando o efeito.
3. **`isPlaying` não controla o vídeo** — estado existe mas nada chama `video.play()/pause()` quando muda.
4. **IA recarrega tudo** — `applyAiAction` faz INSERT + `loadProject()` full refetch (perde undo, pisca tela).
5. **Upload com duração fixa de 10s** — não respeita duração real do vídeo.
6. **Timeline travada em 30s** — `duration || 30` corta vídeos longos.
7. **Sem feedback visual da IA** — clipe novo aparece sem destaque/scroll.
8. **Sobreposição livre** — drag/trim deixa clipes empilharem na mesma track.
9. **Glow remanescente** — `shadow-elegant` ainda no logo, Export, avatar do chat e dot de asset ativo.

## Plano de correções

### A) Layout do preview
- `Editor.tsx`: `min-w-0 min-h-0` no container central.
- `PreviewPlayer.tsx`: `min-h-[280px]` no monitor + `min-h-0` no `flex-1`.
- Fallback "No video" sempre visível mesmo sem asset.

### B) Play/pause real
- Remover keydown duplicado de Espaço em `PreviewPlayer.tsx`.
- `useEffect` em `PreviewPlayer` reagindo a `isPlaying` → chama `video.play()` ou `video.pause()`.
- Pausar antes de seek manual no playhead.

### C) Ações da IA via histórico
- Reescrever `applyAiAction` em `Editor.tsx`: monta novo array em memória → `handleCommit(next)`.
- IA passa a fazer parte do undo/redo, sem flash, sem perda de seleção.

### D) Upload inteligente
- Após upload de vídeo: criar `<video>` temporário → aguardar `loadedmetadata` → ler duração real.
- Inserir clipe com `end_time = duração real`.
- Se primeiro vídeo do projeto, atualizar `projects.duration` no banco.

### E) Duração dinâmica
- Carregar `project.duration` no `loadProject`.
- Timeline usa `Math.max(project.duration, últimoClipeEnd, 30)`.
- Trim/move que estende além do limite atualiza `projects.duration` (debounced).

### F) Feedback visual da IA
- Após aplicar ação que cria clipe: `setSelectedClipId(novoId)` + scroll horizontal na timeline até ele.
- Toast discreto via sonner: `toast("AI added: lower-third")`.

### G) Anti-sobreposição
- No `onMove` do drag em `Timeline.tsx`: detectar colisão com outros clipes da track destino.
- Se colidir: borda vermelha temporária no clipe arrastado.
- No `onUp`: se ainda colidir, reverter para posição original.

### H) Limpar glow
- `Editor.tsx`: remover `shadow-elegant` da logo Sparkles e botão Export.
- `AiChat.tsx`: remover `shadow-elegant` do avatar AI Director e botão Send.
- `EditorSidebar.tsx`: remover `shadow-[0_0_8px_hsl(var(--primary))]` do dot de asset ativo.

## Arquivos afetados
- `src/pages/Editor.tsx` — layout, `applyAiAction` reescrito, upload inteligente, duração dinâmica, sem glow.
- `src/components/editor/PreviewPlayer.tsx` — min-heights, sync `isPlaying`↔vídeo, remover keydown duplicado.
- `src/components/editor/Timeline.tsx` — anti-sobreposição no drag/trim.
- `src/components/editor/AiChat.tsx` — remover `shadow-elegant`.
- `src/components/editor/EditorSidebar.tsx` — remover glow do dot.

## O que NÃO entra agora
- Render MP4 real (Fase 9).
- Inspector de clipe (Fase 2).
- Captions automáticas por IA (Fase 6).

Após isso: você upa um vídeo, vê o player no centro, arrasta sem sobrepor, dá Espaço e toca, fala com Claude e ele edita ao vivo.

