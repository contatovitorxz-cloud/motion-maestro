
# AI gera o plano da motion mas não renderiza vídeo

Olhei a screenshot e o estado atual: o chat aceita comando, a edge `chat-edit` retorna a "cena" descrita, e até narração roda. Mas não existe nenhum pipeline que pegue essa cena descrita pela AI e **transforme em vídeo na track MOTION**. Hoje a track MOTION fica vazia porque ninguém escreve clip nela. Não tem renderer.

## Diagnóstico rápido

```text
User → AiChat → chat-edit (Claude) → tool_call: generate_motion_scene
                                          │
                                          ▼
                                    [retorna JSON com descrição]
                                          │
                                          ▼
                                    ❌ NADA acontece com isso
                                          
Timeline.MOTION track ──── permanece vazia
PreviewPlayer ──────────── não tem o que renderizar
```

A skill `remotion-video` que você tem é para renderizar **MP4 offline via CLI no sandbox** — não roda no browser do app. Pra "criar motion" no editor em tempo real precisamos de um renderer **client-side** (canvas/CSS) que leia a descrição da AI.

## Plano: motion real e visível, sem Remotion

### 1) Definir um schema de "MotionScene" leve
Em vez do Claude descrever em texto livre, ele retorna JSON estruturado que o front sabe renderizar:

```ts
type MotionScene = {
  durationMs: number;          // 3000–8000
  background: { type: 'gradient'|'solid'|'image', value: string|{from,to,angle}, imageAssetId? };
  layers: Array<{
    id: string;
    kind: 'text'|'shape'|'image';
    content?: string;          // texto
    assetId?: string;          // se kind=image
    shape?: 'circle'|'rect'|'blob';
    x: number; y: number;      // 0–100 (% do canvas)
    scale: number; rotation: number; opacity: number;
    color?: string; fontSize?: number; fontWeight?: number;
    animation: {
      in:  { type: 'fade'|'slideUp'|'slideDown'|'slideLeft'|'slideRight'|'scaleIn'|'blurIn', durationMs: number, delayMs: number };
      out: { type: 'fade'|'slideUp'|'scaleOut'|'blurOut', durationMs: number };
      loop?: { type: 'float'|'pulse'|'spin', amplitude: number };
    };
  }>;
  palette: string[];           // hex, vinda das pinned images
};
```

### 2) Edge function `chat-edit` retorna esse JSON
- Atualizar a tool `generate_motion_scene` para exigir esse schema (Zod-like na descrição da tool).
- Sistema prompt instrui: "Você é diretor de motion. Use a paleta das pinned images. Componha 2–5 layers. Duração 4–6s default."
- Se há pinned images, o Claude (vision) extrai 3–5 cores e devolve em `palette`, e pode referenciar `assetId` de uma pinned image como background ou layer.

### 3) Componente novo: `MotionRenderer.tsx` (client-side)
- Recebe `scene: MotionScene` + `currentTimeMs` + `assets`.
- Renderiza num `<div>` 16:9 absoluto:
  - Background: gradient CSS / cor / `<img>` de asset.
  - Cada layer vira um `<div>` ou `<img>` posicionado com `transform: translate(x%, y%) scale() rotate()`.
  - Animações calculadas **frame-based** a partir de `currentTimeMs`:
    - in: progress = clamp((t - delay)/dur, 0, 1) → easing (cubic-bezier inline via JS)
    - out: progress = clamp((t - (duration - outDur))/outDur, 0, 1)
    - loop: `Math.sin(t/period) * amplitude`
- Sem CSS transitions, sem Framer — só math + style inline. Determinístico, segue o playhead.

### 4) Integrar no fluxo do editor
- Quando `chat-edit` retorna scene JSON:
  - `Editor.tsx` cria um clip novo na track **MOTION** com `{ type: 'motion', start, duration: scene.durationMs/1000, payload: scene }`.
  - Clip aparece visualmente no Timeline (já tem cor da track).
- `PreviewPlayer.tsx`:
  - Quando o playhead está dentro de um clip motion, renderiza `<MotionRenderer scene={clip.payload} currentTimeMs={...} assets={...} />` por cima do vídeo (ou no lugar dele se não há vídeo).

### 5) Mensagem de feedback
- Toast: "🎬 Motion gerada — 4.5s adicionados à timeline"
- Card no chat mostra preview estático do primeiro frame (mini thumbnail) + botão "Regenerar variação".

### 6) Persistência
- Clips de motion já vão pra coluna `clips` (jsonb) do projeto. `payload` cabe no JSON.
- Sem migration nova.

## Detalhes técnicos

- **Tipo do clip**: estender `Clip` em `Editor.tsx` para aceitar `track: 'motion'` e campo opcional `motionScene?: MotionScene`.
- **Timeline.tsx**: já tem track MOTION pintada — só precisa renderizar o block do clip motion (label "✨ AI Motion").
- **PreviewPlayer.tsx**: adicionar overlay de MotionRenderer condicional ao playhead estar dentro de um motion clip.
- **chat-edit/index.ts**: trocar a tool `generate_motion_scene` para retornar schema estrito; system prompt atualizado para emitir JSON válido. Vision continua usando pinned images pra paleta.
- **Easings**: utilitário `src/lib/easing.ts` com `easeOutCubic`, `easeInOutCubic`, `easeOutBack`.
- **Performance**: render só dos layers visíveis na janela de tempo do clip. Sem re-render por frame se nada mudou (memo por currentTimeMs arredondado a 16ms).

## Arquivos
- **Novo**: `src/components/editor/MotionRenderer.tsx` — renderer client-side puro.
- **Novo**: `src/lib/motionScene.ts` — tipos `MotionScene` + validação leve.
- **Novo**: `src/lib/easing.ts` — funções de easing.
- **Editado**: `supabase/functions/chat-edit/index.ts` — tool schema estrita + prompt de "diretor de motion JSON".
- **Editado**: `src/pages/Editor.tsx` — ao receber scene, criar clip na track motion + tipo Clip estendido.
- **Editado**: `src/components/editor/AiChat.tsx` — quando resposta traz motionScene, dispara callback `onMotionGenerated(scene)`.
- **Editado**: `src/components/editor/PreviewPlayer.tsx` — overlay MotionRenderer quando playhead em clip motion.
- **Editado**: `src/components/editor/Timeline.tsx` — render visual do clip motion (label + ícone).

## O que NÃO entra agora
- Export pra MP4 (precisa de Remotion server-side, fica pra Fase 9).
- Edição manual de keyframes.
- Áudio sincronizado dentro da motion (ainda usa as tracks separadas).
- Mais de 1 motion clip ativo ao mesmo tempo (uma por trecho).
