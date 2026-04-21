

# Geração automática: você digita, o vídeo é criado

Hoje você digita no chat e o Claude pergunta detalhes ou só faz uma parte (só narração, ou só texto). Você quer um modo direto: **digitou → vídeo pronto na timeline**, com cena de motion + narração + legenda + trilha, tudo de uma vez, sem perguntas.

## Como vai funcionar

```text
Você digita: "lançamento do iPhone 17"
        │
        ▼
Claude (modo Auto) ──► chama em paralelo, sempre:
   1. generate_motion_scene  (cena visual baseada no tema)
   2. generate_narration     (roteiro escrito por ele + voz selecionada)
   3. add_captions           (legenda kinetic sincronizada)
        │
        ▼
Timeline em ~5s:
[Vídeo  ── Motion Scene ──]
[Áudio  ── Narração MP3 ──]
[Texto  ── Captions ──────]
```

## O que vou construir

### 1) Modo "Auto-criar" no chat (toggle)
- Pill no topo do `AiChat`: **⚡ Auto-criar vídeo** (ligado por padrão).
- Quando ligado: cada mensagem sua é tratada como **briefing completo**, não como conversa.
- Quando desligado: comportamento atual (Claude conversa, pergunta, edita pontual).
- Estado salvo em `localStorage` (`motiona:autoMode`).

### 2) System prompt "Auto Director" 
Quando o modo Auto está ligado, o frontend envia um system prompt diferente para o `chat-edit`:

> "Você é um diretor de vídeo automático. Para CADA mensagem do usuário, sem perguntar nada, você DEVE chamar nesta ordem, em paralelo: `generate_motion_scene` (cena visual baseada no tema), `generate_narration` (você escreve um roteiro de 2-4 frases cinematográficas sobre o tema, na mesma língua do usuário) e `add_captions` (estilo kinetic). Não faça perguntas. Não peça confirmação. Apenas execute. Mostre no chat: o roteiro escrito, a descrição visual da cena, e 'Pronto — confira a timeline'."

- O frontend escolhe qual system prompt mandar baseado no toggle, sem mudar a edge function.

### 3) Auto-alinhamento das durações
Hoje cada tool define sua própria duração. No modo Auto vou alinhar:
- `generate_narration` retorna `duration` real do MP3.
- Após receber a narração, o frontend **estica/encolhe** o clipe da motion scene para ter a mesma duração da narração (assim o visual acompanha a fala).
- Captions já cobrem o vídeo todo, então herdam a duração automaticamente.
- Tudo entra como **um único commit** no histórico, então um Ctrl+Z desfaz o vídeo inteiro.

### 4) Feedback visual no chat
Enquanto gera, mostra no chat uma timeline visual de progresso:
```
🎬 Criando seu vídeo
  ✅ Roteiro escrito
  ⏳ Gerando voz (Sarah)…
  ✅ Cena de motion criada
  ⏳ Sincronizando legendas…
```
Cada item vira ✅ conforme as tool calls completam. Implementado com state local no `AiChat` que escuta os eventos de tool dispatch.

### 5) Botão "Refazer" e "Variação"
Logo abaixo da mensagem "Pronto", dois botões:
- **🔄 Refazer** — limpa a timeline e roda tudo de novo com o mesmo prompt (Claude pode variar roteiro/visual).
- **✨ Variação** — mantém o vídeo atual e gera uma alternativa em paralelo na timeline (offset de 2s pra você comparar). 

### 6) Sugestões rápidas no input
Quando o chat está vazio + modo Auto ligado, mostrar 3 chips clicáveis acima do input:
- "Lançamento de produto"
- "Tutorial rápido de 30s"  
- "Vídeo motivacional"

Clicar preenche o input e envia direto.

## Detalhes técnicos
- **Sem migration** — usa as 3 tools que já existem (`generate_motion_scene`, `generate_narration`, `add_captions`).
- **Edge function `chat-edit`**: nenhuma mudança de código; só recebe um `mode: "auto"` no contexto e o frontend troca o system prompt antes de mandar (na verdade, vou passar `context.autoMode = true` e a edge function aplica o prompt correto).
- **Paralelismo**: Claude já pode chamar várias tools no mesmo turn (Anthropic suporta nativamente). Vamos enfatizar isso no prompt.
- **Sincronia de duração**: novo helper em `Editor.tsx` (`syncClipDurations`) chamado quando todas as 3 tools voltam.
- **Custo**: cada mensagem dispara ElevenLabs + Claude (motion + captions). Vamos avisar no toggle: "⚡ Cada mensagem gera um vídeo completo — usa créditos ElevenLabs".

## Arquivos afetados
- **Editado**: `src/components/editor/AiChat.tsx` — toggle Auto, system prompt switching, painel de progresso, chips de sugestão, botões Refazer/Variação.
- **Editado**: `supabase/functions/chat-edit/index.ts` — receber `context.autoMode`, aplicar system prompt "Auto Director" condicionalmente.
- **Editado**: `src/pages/Editor.tsx` — `syncClipDurations` helper, agrupar tool dispatches em um único commit no histórico.

## O que NÃO entra agora
- Render real do MP4 (Fase 9 separada).
- Templates pré-definidos (intro/outro/lower-third) — viraria outra feature.
- Geração de vídeo real por IA tipo Sora/Runway — só motion graphics + áudio + texto.

