
# Fix: preview vazio porque clips somem por race condition do streaming

## Diagnóstico
A AI gera motion + narração + captions corretamente (vejo no `applied_actions` do banco), mas a timeline fica com **0 clips**. Bug em `src/pages/Editor.tsx → applyAiAction`:

- O streaming entrega 3 actions em sequência rápida.
- Cada uma chama `applyAiAction` que lê `clips` via **closure do React state** (que ainda não atualizou entre as chamadas).
- Cada commit usa `[...clips, novoClip]` partindo de `clips = []` → cada action sobrescreve a anterior.
- O `persistClips` então deleta no banco tudo que sumiu → preview fica vazio no reload.

Mesmo problema acontece com `lastMotionClipRef` que é setado mas o `clips` lido pela narration ainda não inclui o motion.

## Correção

### 1) Usar fila serial de actions com state funcional
Em `src/pages/Editor.tsx`:
- Trocar `clips` lido por closure por **leitura via ref** (`clipsRef.current`) que sempre tem o último valor.
- Adicionar `clipsRef = useRef(clips)` com `useEffect(() => { clipsRef.current = clips })`.
- Toda referência a `clips` dentro de `applyAiAction` lê de `clipsRef.current`.
- Serializar as actions: `applyAiAction` vira async e enfileira via uma promise chain (`actionQueueRef`) — cada action espera a anterior terminar antes de rodar, garantindo que o ref já está atualizado.

### 2) Ajustar `AiChat.tsx`
- `onApplyAction` agora retorna `Promise<void>`. O `addAction` no streaming aguarda (`await onApplyAction(action)`) antes de chamar a próxima.

### 3) Garantia extra no `handleCommit`
- Aceitar callback `(prev) => next` além de array, igual `setState`. Aplicar em cima do estado mais fresco.

### 4) Não deletar clips desconhecidos
Em `persistClips`: hoje compara prevMap vs nextMap e deleta a diferença. Mudar pra só deletar se a action explícita removeu — usar `lastPersistedRef` baseado no que **realmente** foi commitado, não em qualquer leitura passada. Como agora as commits são serializadas, o ref vai estar correto.

### 5) Render do MP4 no momento certo
- O `triggerRender` hoje só dispara dentro do branch `generate_narration`. Se o usuário pedir só motion (sem narração), nunca renderiza.
- Adicionar fallback: depois que a fila de actions esvazia, se há motion clip novo do turno e não houve narração, dispara `triggerRender(scene, null)` automaticamente.

## Arquivos editados
- `src/pages/Editor.tsx` — clipsRef, fila serial async, fallback de render.
- `src/components/editor/AiChat.tsx` — `await onApplyAction`.

## O que NÃO entra
- Mudanças no schema da motion ou no worker Remotion (já está OK).
- UI nova — só correção de bug.
- Migração de banco.
