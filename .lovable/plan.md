

# Editor estilo CapCut — Paridade completa de recursos

Você quer transformar o editor atual num editor de vídeo completo, com tudo que o CapCut tem. Isso é grande — vou organizar em fases para entregar valor a cada passo, mantendo o visual cinematográfico que já construímos.

## O que o CapCut tem (mapa de recursos)

```text
┌─ MEDIA ──────────┐  ┌─ PREVIEW ─────────┐  ┌─ INSPECTOR ──┐
│ Upload           │  │ Player + overlays │  │ Transform    │
│ Stock library    │  │ Aspect 9:16/16:9 │  │ Speed        │
│ Stickers/Texto   │  │ Snap to grid     │  │ Volume       │
│ Efeitos          │  │ Safe zones       │  │ Animações    │
│ Filtros          │  └───────────────────┘  │ Filtros      │
│ Transições       │                         │ Máscaras     │
│ Áudio/Música     │  ┌─ TIMELINE ─────────┐  │ Chroma key   │
│ Captions         │  │ Multi-track        │  └──────────────┘
└──────────────────┘  │ Split / Trim       │
                      │ Drag/drop          │
                      │ Transições         │
                      │ Keyframes          │
                      │ Snap magnético     │
                      └────────────────────┘
```

## Plano por fases

Cada fase é entregável e testável sozinha. Você aprova esta visão geral; eu executo a Fase 1 imediatamente e então paramos para você testar antes de seguir.

---

### Fase 1 — Edição básica funcional (drag, split, trim, delete)
Objetivo: poder editar de verdade.
- Arrastar clipes na timeline para reordenar e mover entre tracks.
- Split: cortar o clipe na posição do playhead com tecla **S** ou botão tesoura.
- Trim: arrastar bordas esquerda/direita do clipe para encurtar/estender.
- Delete: tecla **Delete** ou botão lixeira remove clipe selecionado.
- Seleção visual (clique seleciona, borda âmbar destacada).
- Snap magnético: clipes "grudam" em outros clipes e no playhead.
- Atalhos: Espaço (play/pause), J/K/L (rewind/pause/forward), Setas (frame a frame).
- Undo/Redo (Ctrl+Z / Ctrl+Shift+Z).

### Fase 2 — Inspector de clipe (propriedades por clipe)
Painel flutuante à direita do preview quando um clipe está selecionado.
- **Transform**: posição X/Y, escala, rotação, opacidade.
- **Speed**: 0.25x a 4x com curva (linear/ease).
- **Volume** (clipes de áudio/vídeo): 0–200% + fade in/out.
- **Reverse**: inverter clipe.
- **Crop**: recortar área visível.

### Fase 3 — Texto, stickers e overlays
Aba "Text" e "Stickers" na sidebar direita.
- Adicionar texto com presets (Title, Lower-third, Caption, Subtitle).
- Editor de texto: fonte, tamanho, cor, contorno, sombra, alinhamento.
- Animações de entrada/saída (fade, slide, typewriter, bounce).
- Biblioteca de stickers (emoji + shapes).
- Texto vira clipe na track de "Text".

### Fase 4 — Transições, efeitos e filtros
Sidebar com 3 abas novas: Transitions, Effects, Filters.
- **Transições** entre clipes: fade, dissolve, slide, zoom, glitch (arrastar entre 2 clipes).
- **Efeitos**: blur, glow, shake, vignette, glitch, chromatic aberration.
- **Filtros de cor**: cinematic, B&W, vintage, vivid, cool, warm — preview no thumbnail.
- Controles de intensidade (0–100%).

### Fase 5 — Áudio profissional
- Track dedicada de áudio com waveform visual.
- Biblioteca de música/SFX (livre de copyright via API).
- Volume por clipe + fade in/out + ducking automático.
- Gravação de voiceover direto no editor (mic do navegador).
- Detecção de batidas (beat sync) para cortes automáticos.

### Fase 6 — Captions automáticas (legendas via IA)
- Botão "Auto-captions" gera legendas do áudio do vídeo.
- Editor de legenda por linha (texto, timing, estilo).
- Estilos prontos: TikTok bold, Karaoke, Minimal, Subtitle.
- Tradução automática (PT/EN/ES).

### Fase 7 — Keyframes e animação
- Adicionar keyframes em qualquer propriedade do Inspector (posição, escala, opacidade…).
- Editor de curvas (linear, ease, bezier custom).
- Visualização dos keyframes na timeline embaixo do clipe.

### Fase 8 — Templates e presets de projeto
- Galeria de templates prontos (Reels, TikTok, YouTube intro, Vlog).
- Aplicar template = popular timeline com placeholders.
- Salvar projeto atual como template pessoal.

### Fase 9 — Export real
- Render via Remotion (já está no stack) com qualidade 720p/1080p/4K.
- Formatos: MP4, MOV, GIF.
- Aspectos: 9:16, 16:9, 1:1, 4:5.
- Progresso em tempo real + download.

### Fase 10 — Recursos avançados (parecer mágico)
- **Remoção de fundo (background removal)** com IA.
- **Chroma key** (greenscreen) manual.
- **Object tracking**: texto/sticker segue um objeto no vídeo.
- **AI cut**: corta partes silenciosas automaticamente.
- **Smart resize**: reenquadra entre 9:16 ↔ 16:9 mantendo o foco.

---

## Stack técnico que vou usar
- **Estado**: Zustand para timeline (clipes, tracks, playhead, seleção, histórico).
- **Drag/resize**: @dnd-kit + handlers nativos para trim.
- **Render preview**: Remotion Player (já instalado).
- **Render final**: Remotion Lambda ou Edge Function com `@remotion/renderer`.
- **Áudio**: Web Audio API + waveform com `wavesurfer.js`.
- **Captions IA**: Lovable AI Gateway (Gemini) com prompt de transcrição via áudio.
- **Background removal / Chroma**: edge function chamando modelo ou WebGPU local.
- **Persistência**: tabela `projects` no backend já existente — salvar JSON do estado da timeline.

## Como vamos proceder
Aprovando este plano, eu começo **só pela Fase 1** (edição básica funcional). Quando estiver pronto, você testa, e me diz "vai pra fase 2" — assim você nunca recebe um pacote enorme sem poder validar.

Se preferir outra ordem (ex: começar pelo Inspector ou por Captions), me diga antes de aprovar.

