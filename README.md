# MetOn — Diagnóstico Financeiro

Página estática com uma Vercel Function para receber e encaminhar leads com confirmação real de entrega.

## Destino dos leads

Por padrão, o endpoint encaminha os diagnósticos para o mesmo formulário Formspree já utilizado pela Mentoria MetOn:

```text
https://formspree.io/f/maqrdbnb
```

O navegador não acessa o Formspree diretamente. A Vercel Function valida o lead, aplica as proteções básicas e só mostra sucesso quando o Formspree confirma a entrega.

Para trocar o destino futuramente por banco, CRM ou outra automação, crie a variável abaixo em **Development**, **Preview** e **Production**:

```text
LEAD_WEBHOOK_URL=https://seu-endpoint-seguro.example/leads
```

O destino personalizado deve retornar `2xx` somente depois da persistência. Se recusar ou ficar indisponível, a interface preserva os dados para nova tentativa e não mostra um falso sucesso.

Opcionalmente, proteja o webhook com um token Bearer:

```text
LEAD_WEBHOOK_BEARER_TOKEN=um-segredo-longo-e-exclusivo
```

O token fica apenas no ambiente da Vercel e nunca é enviado ao navegador.

## Payload entregue ao webhook

```json
{
  "nome": "Nome do lead",
  "contato": "email ou WhatsApp",
  "pontuacao": 75,
  "situacao": "Organizado",
  "consentimento_marketing": false,
  "origem": "diagnostico",
  "enviado_em": "2026-07-30T12:00:00.000Z",
  "request_id": "uuid"
}
```

Dados pessoais não são escritos nos logs da função. Falhas registram somente o tipo do erro e o status do destino.

## Validação

Requer Node.js 20 ou superior:

```bash
npm test
npm run check
```

## Limite conhecido

O rate limit atual é uma proteção básica por instância da função, adequada para reduzir abuso casual. Como a Vercel pode executar várias instâncias, substitua-o por um limitador distribuído com armazenamento persistente na etapa de fundação do backend (`P0-03`).
