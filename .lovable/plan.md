

# Refatorar Editor pra UX do mockup, com IA real por trás

A plataforma fica com a **mesma cara e fluxo do teu mockup** (3 colunas: chat à esquerda, preview central + controles + timeline embaixo), mas os comandos passam pelo Claude (chat-edit) em vez de regex local. Mantém auth, projetos no banco e o Remotion Player pro preview.

## Layout final

```text
┌─────────────────────────────────────────────────────────────────┐
│ [logo] Motion · meu-projeto              [Importar] [Exportar]  │ topbar 48px
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│   AI Chat    │              PREVIEW 16:9                        │
│   (msgs +    │           (Remotion <Player>)                    │
│   sugestões  │                                                  │
│   + input)   ├──────────────────────────────────────────────────┤
│              │  ⏮ ▶ ⏭   00:03 / 00:15   🔊 ⛶                   │ controles 48px
│              ├──────────────────────────────────────────────────┤
│              │ 00:00  00:05  00:10  00:15  ← régua              │
│              │ Vídeo  ▓▓▓▓▓▓▓░░░░░░                             │
│              │ Texto    ▓▓▓░  ▓▓▓                               │ timeline 220px
│              │ Áudio  ▓▓▓▓▓▓▓▓▓▓▓                               │
│   320px      │ Efeitos      ▓                                   │
└──────────────┴──────────────────────────────────────────────────┘
```

## Comportamento

- **Chat (esquerda)**: identifico ao mockup — header "Assistente IA · online", lista de mensagens, **4 sugestões clicáveis** ("Cortar do 10 ao 15", "Legendar tudo", "Adicionar música", "Adicionar efeitos"), input compacto com botão âmbar.
- **Cada msg → chat-edit (Claude)**: continua streaming actions (`add_captions`, `cut_silence`, `generate_motion_scene`, `add_text_overlay`, `add_transition`, `generate_narration`). Sem regex local — IA que decide.
- **Sugestões clicáveis** disparam `send(text)` igual ao mockup.
- **Preview central**: Remotion `<Player>` da motion mais recente do turno (se existir). Se não houver motion ainda, mostra placeholder com ícone Play e "PREVIEW" estilo mockup.
- **Legenda visível no preview** quando o playhead está dentro de um caption clip — overlay amarelo (#FFB627) com text-shadow preto, igual mockup.
- **Controles**: ⏮ Play/Pause ⏭ + tempo + volume + fullscreen. Espaço = play/pause (já existe).
- **Timeline** (refeita visualmente): régua superior com timecodes, playhead amarelo com losango no topo, 4 tracks coloridas:
  - Vídeo (cinza)
  - Texto (âmbar #FFB627 translúcido)
  - Áudio (azul #4CC9F0 translúcido, com waveform de barras)
  - Efeitos (laranja #FF6B1A translúcido)
  Tracks só aparecem quando têm clips (igual mockup). Quando timeline vazia: "Peça pro assistente adicionar legendas, áudio ou efeitos".
- **Topbar** simplificada: logo + nome editável + botões Importar/Exportar à direita.

## O que muda no código

### Mantém
- `useAuth`, rotas, `projects`/`assets`/`timeline_clips`/`chat_messages` no banco
- `chat-edit` e `generate-narration` edge functions
- `RemotionPlayer` + `MotionComposition` (preview)
- `exportVideo.ts` (export .webm via MediaRecorder)
- Upload de assets, pinned references (continua funcional, só some da UI principal — fica num drawer "Importar")

### Reescreve
- **`src/pages/Editor.tsx`**: layout 3 colunas estilo mockup. Remove `EditorSidebar` e `AudioInspector` da tela principal. Mantém toda a lógica de `runAiAction`, `clipsRef`, fila serial, persistência.
- **`src/components/editor/Timeline.tsx`**: visual novo (tracks coloridas, régua estilo mockup, playhead amarelo). Mesma API (`clips`, `currentTime`, `onSeek`, `onCommit`, `selectedClipId`).
- **`src/components/editor/AiChat.tsx`**: largura 320px, header simples "Assistente IA · online", 4 sugestões pt-BR, input compacto. Remove voice picker da tela principal (vai pro drawer de Importar). Mantém streaming de actions.
- **`src/components/editor/PreviewPlayer.tsx`**: adiciona overlay de caption quando há `add_captions` clip ativo no playhead. Placeholder estilo mockup quando vazio.
- **Novo `src/components/editor/TopBar.tsx`**: logo + nome editável + Importar/Exportar.
- **Novo `src/components/editor/ImportDrawer.tsx`**: sheet lateral com upload + lista de assets + pinned + voice picker.

### Remove da UI (código fica, só some da tela)
- `EditorSidebar` (vira drawer)
- `EmptyProjectHero` (placeholder vai dentro do preview)
- `AudioInspector` (só aparece quando seleciona clip de áudio, num popover)

## Sugestões pt-BR mapeadas pra IA

As 4 sugestões do mockup viram prompts pro Claude:
- "Cortar do 10 ao 15" → Claude chama `cut_silence` ou cria split
- "Legendar tudo" → `add_captions`
- "Adicionar música" → busca asset de áudio existente ou pede upload
- "Adicionar efeitos" → `add_transition` em pontos de corte

Sem regex local. Claude interpreta.

## Paleta (puxa do mockup)

- bg principal: `#0a0a0a`
- bg preview: `#050505`
- accent âmbar: `#FFB627` (playhead, captions, botão send, primary)
- accent roxo: `#7B2CBF` (gradients)
- audio azul: `#4CC9F0`
- effects laranja: `#FF6B1A`
- bordas: `rgba(255,255,255,0.06)` a `0.10`

Vou aplicar via tokens em `index.css`/`tailwind.config.ts` — sem hex direto nos componentes, exceto onde já está estilizado inline.

## Ordem de execução

1. Atualizar tokens de cor (índex.css + tailwind.config) com paleta do mockup
2. Criar `TopBar.tsx` e `ImportDrawer.tsx`
3. Reescrever `Timeline.tsx` (visual novo, mesma API)
4. Ajustar `AiChat.tsx` (320px, sugestões pt-BR, header simples)
5. Ajustar `PreviewPlayer.tsx` (caption overlay + placeholder)
6. Reescrever layout do `Editor.tsx` (3 colunas)
7. Testar: prompt "legendar tudo" → caption clip aparece amarelo na track Texto + overlay no preview

## Fora do escopo

- Não mexe em banco (schema fica)
- Não mexe em edge functions
- Não remove pinned assets nem voice picker — só movem pro drawer
- Não troca Remotion por outro renderer

