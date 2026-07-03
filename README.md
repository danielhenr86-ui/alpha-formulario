# Alpha Formulário — Formulário Digital (Alpha Cartas de Crédito)

Uma versão minimal e pronta para deploy de um formulário (único arquivo `index.html`) para envio de pedidos de faturamento via Make.com (webhook), com upload de documentos para Google Drive, registro em Google Sheets e notificação por WhatsApp (Z-API).

Status: README reorganizado e documentado.

---

## Estrutura do repositório
alpha-formulario/
├── index.html          ← Formulário completo (único arquivo)  
└── README.md

---

## Visão geral rápida
- O formulário é um único arquivo `index.html` que envia os dados para um webhook (Make.com).
- O cenário no Make processa arquivos, envia para Google Drive, adiciona uma linha no Google Sheets e notifica via WhatsApp.
- Ideal para deploy rápido via GitHub Pages.

---

## Quickstart — publicar no GitHub Pages
1. Crie um repositório no GitHub (se ainda não tiver): https://github.com/new  
   - Nome sugerido: `alpha-formulario` (ou ajuste conforme necessário)
2. Faça upload do `index.html` (Add file → Upload files) e commite com mensagem como "Deploy formulário Alpha".
3. Ative GitHub Pages:
   - Settings → Pages
   - Source: Deploy from a branch
   - Branch: `main` → pasta `/ (root)`
   - Save
4. A URL final estará disponível em ~2 minutos:
```
https://SEU-USUARIO.github.io/alpha-formulario/
```

---

## Configuração principal (index.html)
- Abra `index.html` e atualize a constante/variável `CONFIG.MAKE_WEBHOOK_URL` com a URL do webhook custom do Make (Módulo 1).
- Exemplo (pseudo):
```js
const CONFIG = {
  MAKE_WEBHOOK_URL: "https://hook.make.com/xxxxxx",
  // outras configurações...
};
```

---

## Testar o webhook (antes de integrar no Make)
- Se quiser testar a URL do webhook (ex.: a URL retornada pelo Make), use curl:
```bash
curl -X POST "https://hook.make.com/SEU_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp":"2025-01-15T10:30:00.000Z",
    "cliente":"João da Silva",
    "cpf_cnpj":"123.456.789-00",
    "contato":"(62) 99999-9999",
    "email":"joao@email.com",
    "banco":"237 - Bradesco",
    "documentos":{"cartao":[{"nome":"cartao.jpg","tipo":"image/jpeg","base64":"..."}]},
    "total_docs":1
  }'
```
- Observe a resposta do Make e confirme que os passos subsequentes (Drive / Sheets / WhatsApp) são executados corretamente.

---

## Cenário Make.com — resumo dos módulos
1. Módulo 1 — Webhooks (Custom webhook) — trigger `alpha-pedido-faturamento`  
   - Copie a URL gerada e cole em `CONFIG.MAKE_WEBHOOK_URL` no `index.html`.
2. Módulo 2 — Google Drive: Upload File
   - Para cada arquivo em `documentos.cartao`, `documentos.docs`, `documentos.extras`
   - Use o campo `base64` como conteúdo do arquivo
   - Pasta destino: `Alpha Consórcio/Pedidos/{{timestamp}}_{{cliente}}`
   - Salve os links gerados
3. Módulo 3 — Google Sheets: Add a Row
   - Planilha: `Alpha - Pedidos de Faturamento` → Aba `Pedidos`  
   - Colunas (ordem)
     | Coluna | Campo Make |
     |--------|-----------|
     | A - Data/Hora | `{{timestamp}}` |
     | B - Cliente | `{{cliente}}` |
     | C - CPF/CNPJ | `{{cpf_cnpj}}` |
     | D - Grupo | `{{grupo}}` |
     | E - Cota | `{{cota}}` |
     | F - Telefone | `{{contato}}` |
     | G - Email | `{{email}}` |
     | H - Endereço | `{{endereco}}` |
     | I - Banco | `{{banco}}` |
     | J - Agência | `{{agencia}}` |
     | K - Conta | `{{conta}}` |
     | L - Tipo Conta | `{{tipo_conta}}` |
     | M - Vendedor Nome | `{{vend_nome}}` |
     | N - Vendedor CPF | `{{vend_cpf}}` |
     | O - Vendedor Contato | `{{vend_contato}}` |
     | P - Cotação | `{{cotacao}}` |
     | Q - Crédito Disp. | `{{credito_disp}}` |
     | R - Solicitado | `{{solicitado}}` |
     | S - Percentual | `{{percentual}}` |
     | T - Nota Reembolso | `{{nota_reembolso}}` |
     | U - Observações | `{{observacoes}}` |
     | V - Qtd Documentos | `{{total_docs}}` |
     | W - Link Pasta Docs | Link do Google Drive (Módulo 2) |
     | X - Status | `Novo` (valor fixo) |
4. Módulo 4 — Z-API / WhatsApp (notificação)
   - Exemplo endpoint:
     `https://api.z-api.io/instances/{{SUA_INSTANCIA}}/token/{{SEU_TOKEN}}/send-text`  
   - Body de exemplo (JSON):
```json
{
  "phone": "5562994738787",
  "message": "🏎️ *ALPHA — NOVO PEDIDO DE FATURAMENTO*\n\n👤 *Cliente:* {{cliente}}\n📋 *CPF/CNPJ:* {{cpf_cnpj}}\n📞 *Contato:* {{contato}}\n\n🏦 *Banco:* {{banco}}\n🔢 *Ag/Conta:* {{agencia}}/{{conta}}\n\n🔗 *Docs:* {{link_docs}}\n\nStatus: *Novo*"
}
```
5. Módulo 5 (Opcional) — Gmail: Send an Email
   - Enviar confirmação para o email do cliente (se preenchido)

---

## Payload esperado no webhook
Exemplo do objeto JSON que o formulário envia:
```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "cliente": "João da Silva",
  "cpf_cnpj": "123.456.789-00",
  "grupo": "00123",
  "cota": "0042",
  "contato": "(62) 99999-9999",
  "email": "joao@email.com",
  "endereco": "Rua X, 123 - Goiânia - GO",
  "banco": "237 - Bradesco",
  "agencia": "0240",
  "conta": "133938-9",
  "tipo_conta": "Corrente",
  "titular": "proprio",
  "omega_cnpj": "50.697.530/0001-09",
  "vend_nome": "Vendedor Silva",
  "vend_cpf": "987.654.321-00",
  "cotacao": "R$ 50.000,00",
  "credito_disp": "R$ 45.000,00",
  "solicitado": "R$ 42.000,00",
  "percentual": "19%",
  "nota_reembolso": "NF-001",
  "observacoes": "...",
  "documentos": {
    "cartao": [{ "nome": "cartao.jpg", "tipo": "image/jpeg", "base64": "..." }],
    "docs": [],
    "extras": []
  },
  "total_docs": 1
}
```

---

## Boas práticas e observações
- Verifique limites de tamanho de payload/base64 no Make e Google Drive (arquivos muito grandes podem falhar).
- Garanta permissões corretas para a conta Google usada no Drive/Sheets.
- Use nomes de pasta com timestamp e cliente para facilitar auditoria.
- Se receber erros CORS no frontend: abra o console devtools para depurar (normalmente não esperado em POSTs diretos para Make).

---

## Checklist final
- [ ] `index.html` publicado no GitHub Pages
- [ ] URL do GitHub Pages testada no browser
- [ ] Webhook Make.com criado e copiado para `CONFIG.MAKE_WEBHOOK_URL`
- [ ] Google Sheets criado com as colunas corretas
- [ ] Z-API configurado com número +5562994738787
- [ ] Teste de ponta a ponta com dados fictícios

---

## Sugestões extras (opcionais)
- Adicionar um arquivo `LICENSE` (ex.: MIT) se quiser abrir o código.
- Adicionar `CONTRIBUTING.md` com instruções para colaboradores.
- Criar um `README` em inglês (README.en.md) se pretender colaboradores internacionais.
- Se preferir deploy automatizado, adicionar um workflow GitHub Actions para publicar em `gh-pages` branch.

---

## Contato
Para dúvidas ou se quiser que eu atualize o README diretamente no repositório, responda aqui e eu faço o commit para você.
