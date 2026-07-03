# Alpha Cartas de Crédito — Formulário Digital

## Estrutura do repositório
```
alpha-consorcio/
├── index.html          ← Formulário completo (único arquivo)
└── README.md
```

## Deploy no GitHub Pages (passo a passo)

### 1. Criar repositório no GitHub
1. Acesse https://github.com/new
2. Nome do repositório: `alpha-consorcio`
3. Marque como **Public**
4. Clique em **Create repository**

### 2. Fazer upload do arquivo
1. Na página do repositório, clique em **Add file → Upload files**
2. Arraste o `index.html`
3. Commit: "Deploy formulário Alpha"

### 3. Ativar GitHub Pages
1. Settings → Pages
2. Source: **Deploy from a branch**
3. Branch: **main** → pasta **/ (root)**
4. Save

### 4. URL final (disponível em ~2 minutos)
```
https://SEU-USUARIO.github.io/alpha-consorcio/
```

---

## Configuração Make.com (cenário completo)

### Módulos do cenário (em ordem):

#### Módulo 1 — Webhooks (trigger)
- Tipo: **Custom webhook**
- Nome: `alpha-pedido-faturamento`
- Copie a URL gerada → cole em `CONFIG.MAKE_WEBHOOK_URL` no index.html

#### Módulo 2 — Google Drive: Upload File (documentos)
- Para cada arquivo em `documentos.cartao`, `documentos.docs`, `documentos.extras`
- Use o campo `base64` como conteúdo do arquivo
- Pasta destino: criar `Alpha Consórcio/Pedidos/{{timestamp}}_{{cliente}}`
- Salvar os links gerados para usar na planilha

#### Módulo 3 — Google Sheets: Add a Row
Planilha: `Alpha - Pedidos de Faturamento`
Aba: `Pedidos`

Colunas (ordem):
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

#### Módulo 4 — Z-API / WhatsApp (notificação)
- Use Z-API (https://z-api.io) — plano gratuito disponível
- Método: POST
- URL: `https://api.z-api.io/instances/{{SUA_INSTANCIA}}/token/{{SEU_TOKEN}}/send-text`
- Body:
```json
{
  "phone": "5562994738787",
  "message": "🏎️ *ALPHA — NOVO PEDIDO DE FATURAMENTO*\n\n👤 *Cliente:* {{cliente}}\n📋 *CPF/CNPJ:* {{cpf_cnpj}}\n📞 *Contato:* {{contato}}\n\n🏦 *Banco:* {{banco}}\n🔢 *Ag/Conta:* {{agencia}} / {{conta}}\n\n🤝 *Vendedor:* {{vend_nome}}\n💰 *Solicitado:* {{solicitado}}\n📊 *Percentual:* 19%\n\n📎 *Documentos:* {{total_docs}} arquivo(s)\n🕐 *Data:* {{timestamp}}\n\n_Acesse a planilha para ver todos os detalhes._"
}
```

#### Módulo 5 (Opcional) — Gmail: Send an Email
Enviar confirmação para o email do cliente (se preenchido)

---

## Alternativa: n8n (self-hosted, 100% gratuito)
Se preferir sem limitação de operações, use n8n:
- Deploy grátis: https://railway.app (plano free)
- Mesmo fluxo: Webhook → Google Sheets → WhatsApp
- Documentação: https://docs.n8n.io

---

## Variáveis que chegam no webhook
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

## Checklist final
- [ ] index.html publicado no GitHub Pages
- [ ] URL do GitHub Pages testada no browser
- [ ] Webhook Make.com criado e copiado para CONFIG.MAKE_WEBHOOK_URL
- [ ] Google Sheets criado com as colunas corretas
- [ ] Z-API configurado com número +5562994738787
- [ ] Teste de ponta a ponta com dados fictícios
