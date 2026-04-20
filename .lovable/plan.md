

# Editor Cinematográfico — Chat à Esquerda + Visual Premium

Reorganizar o layout do editor colocando o chat de IA à esquerda (lugar de destaque) e elevar a interface inteira para um nível cinematográfico, estilo DaVinci Resolve / Premiere Pro / Runway.

## 1) Inversão do layout

Nova ordem da esquerda → direita no `Editor.tsx`:

```text
┌─────────────────────────────────────────────────────────────┐
│  Topbar (logo, nome do projeto, timecode, Export)           │
├──────────┬──────────────────────────────────────┬───────────┤
│          │                                      │           │
│  AI      │       Preview (vídeo + overlays)     │  Media    │
│  Chat    │                                      │  +        │
│  (esq)   │                                      │  Presets  │
│  384px   ├──────────────────────────────────────┤  256px    │
│          │       Timeline (tracks)              │           │
└──────────┴──────────────────────────────────────┴───────────┘
```

- `AiChat` passa para a esquerda (borda direita em vez de esquerda).
- `EditorSidebar` (Media + Presets) vai para a direita.
- Preview + Timeline continuam no centro, ocupando o espaço nobre.

## 2) Sistema visual cinematográfico

Tudo via tokens (`src/index.css` + `tailwind.config.ts`), sem cores hardcoded.

**Paleta "Cinema Pro"**
- Background: preto absoluto `0 0% 0%` com gradiente radial sutil (vinheta) tipo sala de cinema.
- Painéis: `obsidian` `0 0% 4%` e `panel-elevated` `0 0% 7%`, separados por bordas finíssimas `0 0% 12%`.
- Acento primário: gradiente violeta-cyan eletric (`262 90% 65%` → `190 95% 55%`) — usado com parcimônia em CTAs, playhead, focus rings.
- Acento secundário: âmbar quente `38 95% 60%` para timestamps e estados ativos.
- Tracks: cores dessaturadas e profundas (vinho, azul-noite, verde-musgo, âmbar, magenta), com glow sutil quando ativas.

**Tipografia**
- Headings: `Inter` 700 com `tracking-[-0.02em]`.
- Timecodes / números: `JetBrains Mono` tabular, peso 500, cor âmbar.
- Labels de UI: uppercase 10–11px, `tracking-[0.12em]`, `text-muted-foreground`.

**Profundidade & textura**
- Vinheta global radial no `body` (escurece bordas, foca o centro).
- Ruído sutil (`grain`) sobre painéis para dar textura de filme.
- Separadores com gradiente vertical (transparente → border → transparente).
- Sombras internas tipo "inset glow" no topo dos painéis para parecer vidro escuro.
- Focus rings com glow violeta suave em vez de outline duro.

**Microinterações**
- Botões com transição `cubic-bezier` suave + brilho no hover.
- Playhead da timeline com leve glow + traço fino animado.
- Overlay ativo no preview com `backdrop-blur` no rodapé tipo letterbox.

## 3) Refinamento do Preview Player

- Adicionar **letterbox cinematográfico** (faixas pretas top/bottom sutis com gradiente) em torno do vídeo.
- Bordas do vídeo: `rounded-md` + `ring-1 ring-white/5` + sombra grande difusa por baixo (parece um monitor flutuando).
- Barra de transporte ganha visual mais "pro": botão play maior, circular, com glow; timecode central grande em mono âmbar; ícones secundários menores e mais escuros.
- Volume vira um slider vertical em popover (limpa a barra).

## 4) Refinamento da Timeline

- Régua mais alta com tick marks em 3 níveis (segundo / 5s / 10s).
- Header das trilhas com ícone colorido por categoria + label uppercase pequeno.
- Clipes com gradiente diagonal sutil + leve borda superior brilhante (efeito "highlight" tipo Premiere).
- Playhead vira linha âmbar com cabeça em diamante e sombra projetada.
- Hover na régua mostra preview do timecode flutuando.

## 5) Refinamento do AI Chat (agora à esquerda)

- Header com avatar circular gradient + indicador "online" verde pulsando.
- Bolhas do usuário: gradiente violeta→azul, cantos assimétricos.
- Bolhas da IA: vidro escuro com borda fina luminosa.
- Sugestões iniciais em cards com ícone à esquerda + hover lift.
- Campo de input maior, com borda que ganha glow quando focado, botão Send circular com gradient.
- Badge "Gemini 3 Flash" mais discreto, no rodapé.

## 6) Refinamento da Sidebar Direita (Media + Presets)

- Cabeçalho "PROJECT" com contador e botão "+" para upload rápido.
- Grid 2 colunas para assets (thumbnails maiores, com aspect-video, hover scale).
- Presets viram cards com mini-preview animado (ícone pulsante) e descrição.
- Dropzone full-panel quando arrastar arquivo: overlay escuro + borda tracejada animada com gradiente.

## 7) Topbar

- Altura levemente maior, blur backdrop, borda inferior com gradiente.
- Logo com glow suave.
- Timecode central em mono grande (tipo cabine de edição).
- Botão Export com gradiente + ícone download animado no hover.

## Arquivos afetados
- `src/index.css` — novos tokens (obsidian, vinheta, grain, gradientes), utilitários `bg-vignette`, `bg-grain`, `glow-primary`.
- `tailwind.config.ts` — registrar novas cores, animações (`pulse-soft`, `slide-in-left`, `glow`).
- `src/pages/Editor.tsx` — reordenar colunas (AiChat → centro → EditorSidebar), redesenhar topbar.
- `src/components/editor/AiChat.tsx` — virar borda para a direita, redesign visual completo.
- `src/components/editor/EditorSidebar.tsx` — virar borda para a esquerda, grid de assets, presets como cards.
- `src/components/editor/PreviewPlayer.tsx` — letterbox, transport pro, timecode grande.
- `src/components/editor/Timeline.tsx` — régua multinível, clipes com gradient, playhead âmbar.

## O que NÃO entra agora
- Drag & drop / split de clipes (fica para próxima iteração).
- Render real do Remotion.
- Undo/redo.

