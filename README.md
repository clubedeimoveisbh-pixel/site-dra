# Site Marina Trabalhista — Direito do Trabalho & IA

Site profissional estático para servidora pública / assistente de juiz do trabalho e criadora de conteúdo jurídico.

## Estrutura

```
site-dra/
  index.html              — Página inicial (hero, artigos recentes, CTAs)
  quem-sou-eu.html        — Página sobre / biografia
  publicacoes.html        — Publicações em periódicos e obras coletivas
  artigos.html            — Blog com filtro por categoria
  artigo-template.html    — Template de artigo completo
  ferramentas.html        — Calculadoras jurídicas + tabela de reflexos
  modelos.html            — Download de modelos de petições
  cursos.html             — Cursos disponíveis e em breve
  css/style.css           — Estilos globais (CSS puro, variáveis CSS)
  js/nav.js               — Injeção de nav/footer, scroll, hamburger, fade-up
  js/calculadoras.js      — Lógica das calculadoras (prescrição + aviso prévio)
  netlify.toml            — Config de deploy (Netlify)
```

## Paleta

| Token | Valor |
|-------|-------|
| `--navy-deep` | `#0a1628` |
| `--navy-mid` | `#1a2f5e` |
| `--gold` | `#C8A75B` |
| `--gold-bright` | `#d4af37` |

## Tipografia

- Títulos: **Playfair Display** (Google Fonts)
- Corpo: **Inter** (Google Fonts)
- Citações / subtítulos elegantes: **Cormorant Garamond**

## Ferramentas Implementadas

1. **Calculadora de Prescrição** — Lei 14.010/2020 (141 dias de suspensão pandêmica)
2. **Calculadora de Aviso Prévio** — Lei 12.506/2011 (proporcional: 30 + 3/ano, máx. 90 dias)
3. **Tabela de Reflexos** — Verbas salariais vs. indenizatórias com fundamento legal

## Deploy

O site é estático (HTML/CSS/JS puro) e pode ser hospedado em qualquer CDN.

### Netlify
```bash
netlify deploy --prod
```

### GitHub Pages
Ativar Pages no repositório, apontar para branch `master`, pasta raiz `/`.

## Desenvolvimento local

```bash
# Qualquer servidor HTTP estático funciona:
npx serve .
# ou
python -m http.server 8080
```
