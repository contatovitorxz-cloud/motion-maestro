

# Conectar Claude (Anthropic) como inteligência do editor

Você quer trocar a IA atual (Lovable AI / Gemini) por Claude da Anthropic, usando sua própria chave de API. Antes de você me mandar a chave, vou organizar como isso vai ser configurado para ela ser usada de forma segura.

## Como vai funcionar

```text
┌─────────────┐    chama     ┌──────────────────┐   chama   ┌──────────────┐
│  AiChat.tsx │ ───────────▶ │ edge: chat-edit  │ ────────▶ │  Anthropic   │
│  (browser)  │              │  (servidor)      │           │  Claude API  │
└─────────────┘              └──────────────────┘           └──────────────┘
                                       │
                                Lê ANTHROPIC_API_KEY
                                de Lovable Cloud (secret)
```

A chave **nunca** vai para o navegador. Fica guardada como secret no backend e só a edge function consegue ler.

## O que vai mudar

### 1) Armazenar a chave de forma segura
- Vou pedir a chave via prompt seguro de secret (`ANTHROPIC_API_KEY`).
- Você cola a chave no campo seguro — ela não fica em código, não fica em log, e não é visível no projeto depois.
- Não me envie a chave por mensagem no chat — quando eu apresentar o prompt de secret, cole lá.

### 2) Reescrever a edge function `supabase/functions/chat-edit/index.ts`
- Trocar a chamada do Lovable AI Gateway pela API oficial da Anthropic (`https://api.anthropic.com/v1/messages`).
- Usar header `x-api-key: ANTHROPIC_API_KEY` e `anthropic-version: 2023-06-01`.
- Adaptar o formato de mensagens (Anthropic separa `system` em campo próprio, não na lista de messages).
- Adaptar o formato de **tools** (Anthropic usa `input_schema` em vez de `parameters`, e `tool_use` blocks no streaming em vez de `tool_calls`).
- Manter streaming via SSE (Anthropic suporta `stream: true` nativamente).
- Manter as mesmas tools que já existem: `add_text_overlay`, `add_lower_third`, `add_captions`, `cut_silence`, `add_transition`, `generate_motion_scene`.

### 3) Adaptar o parser do streaming no `AiChat.tsx`
- Anthropic envia eventos diferentes do OpenAI/Gemini:
  - `content_block_start` → início de texto ou tool
  - `content_block_delta` → tokens parciais
  - `content_block_stop` → fim do bloco
  - `message_stop` → fim total
- Vou ajustar o parser para extrair tokens e tool calls nesse formato e disparar as ações na timeline igual antes (sem mudar a UI).

### 4) Escolha do modelo
Vou usar **`claude-sonnet-4-5`** como padrão (melhor custo-benefício para chat com tool calling agora). Se quiser outro (ex: `claude-opus-4-5` para tarefas mais complexas), me avisa antes de aprovar.

### 5) Tratamento de erros
- 401 (chave inválida) → mensagem clara: "Chave Anthropic inválida, verifique em Settings".
- 429 (rate limit) → toast amigável.
- 529 (overloaded) → retry sugerido.

## O que NÃO muda
- A UI do chat fica idêntica (badge "Gemini 3 Flash" será trocado para "Claude Sonnet 4.5").
- As tools e suas ações na timeline (Phase 1 do CapCut) continuam funcionando do mesmo jeito.
- Lovable AI continua disponível no projeto, só não é mais usado pelo chat.

## Arquivos afetados
- `supabase/functions/chat-edit/index.ts` — reescrita para usar Claude.
- `src/components/editor/AiChat.tsx` — parser SSE adaptado e badge atualizado.
- Novo secret `ANTHROPIC_API_KEY` no Lovable Cloud.

## Próximo passo
Aprovando este plano, no início da execução eu vou abrir o prompt de secret pedindo `ANTHROPIC_API_KEY`. Você cola a chave lá (não no chat), eu termino a implementação e a gente testa.

