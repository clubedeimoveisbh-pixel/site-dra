const express = require('express');
const path    = require('path');
const https   = require('https');
const app     = express();
const PORT    = process.env.PORT || 3000;

app.use(express.json());

// ── DataJud proxy config ──────────────────────────────────────────────────────
const DATAJUD_KEY  = process.env.DATAJUD_API_KEY || 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';
const DATAJUD_URL  = 'https://api-publica.datajud.cnj.jus.br';
const INDEX_NAME   = 'api_publica_trt3';
const VARA_NOME    = process.env.VARA_NOME   || '';  // ex: "17ª VARA DO TRABALHO DE BELO HORIZONTE"
const VARA_CODIGO  = process.env.VARA_CODIGO || '';  // numérico (opcional, tem precedência)
const DASH_PASS    = process.env.DASHBOARD_PASSWORD || 'pje';

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_STATS = {
  acervo: 847,
  distribuidos_mes: 23,
  concluidos_mes: 31,
  taxa_acordo: 34,
  tempo_medio_dias: 420,
  ultima_atualizacao: new Date().toISOString(),
  mock: true,
};

const MOCK_CLASSES = [
  { nome: 'Reclamação Trabalhista',            total: 567 },
  { nome: 'Execução de Título Extrajudicial',  total: 152 },
  { nome: 'Mandado de Segurança',              total: 89  },
  { nome: 'Ação Civil Pública',                total: 39  },
];

const MOCK_ASSUNTOS = [
  { nome: 'Horas Extras',                      total: 312 },
  { nome: 'FGTS',                              total: 289 },
  { nome: 'Verbas Rescisórias',                total: 241 },
  { nome: 'Equiparação Salarial',              total: 178 },
  { nome: 'Adicional de Insalubridade',        total: 143 },
  { nome: 'Assédio Moral',                     total: 117 },
  { nome: 'Acidente do Trabalho',              total: 96  },
  { nome: 'Intervalo Intrajornada',            total: 88  },
  { nome: 'Vale Transporte',                   total: 74  },
  { nome: 'Estabilidade Provisória',           total: 61  },
];

// 12 months of mock distribution data (most recent last)
const now = new Date();
const MOCK_POR_MES = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
  return {
    mes: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
    total: Math.round(18 + Math.random() * 18),
  };
});

const MOCK_TEMPOS = [
  { faixa: 'Menos de 6 meses',  total: 87  },
  { faixa: '6 a 12 meses',      total: 134 },
  { faixa: '12 a 24 meses',     total: 203 },
  { faixa: 'Mais de 24 meses',  total: 423 },
];

const MOCK_VARAS_COMPARATIVO = {
  vara_principal: '17ª VARA DO TRABALHO DE BELO HORIZONTE',
  ranking_bh: { posicao: 42, total_varas: 67, percentil: 37 },
  varas: [
    { nome: '14ª VARA DO TRABALHO DE BELO HORIZONTE', acervo: 1203, ultimos_12m: 287, top_classe: 'Reclamação Trabalhista' },
    { nome: '15ª VARA DO TRABALHO DE BELO HORIZONTE', acervo: 985,  ultimos_12m: 241, top_classe: 'Reclamação Trabalhista' },
    { nome: '16ª VARA DO TRABALHO DE BELO HORIZONTE', acervo: 1074, ultimos_12m: 263, top_classe: 'Execução de Título Extrajudicial' },
    { nome: '17ª VARA DO TRABALHO DE BELO HORIZONTE', acervo: 847,  ultimos_12m: 198, top_classe: 'Reclamação Trabalhista' },
    { nome: '18ª VARA DO TRABALHO DE BELO HORIZONTE', acervo: 921,  ultimos_12m: 219, top_classe: 'Reclamação Trabalhista' },
    { nome: '19ª VARA DO TRABALHO DE BELO HORIZONTE', acervo: 1138, ultimos_12m: 274, top_classe: 'Mandado de Segurança' },
    { nome: '20ª VARA DO TRABALHO DE BELO HORIZONTE', acervo: 762,  ultimos_12m: 183, top_classe: 'Reclamação Trabalhista' },
  ],
  mock: true,
};

const MOCK_PROCESSOS = Array.from({ length: 20 }, (_, i) => {
  const classes = MOCK_CLASSES.map(c => c.nome);
  const fases   = ['Conhecimento', 'Instrução', 'Sentença', 'Recurso', 'Execução'];
  const status  = ['Ativo', 'Suspenso', 'Arquivado', 'Concluso'];
  const baseYear = 2022 + Math.floor(i / 7);
  const num  = String(i + 1).padStart(4, '0');
  return {
    numero:        `${num}${String(baseYear).slice(2)}0006300${String(34 + i).padStart(4,'0')}`,
    classe:        classes[i % classes.length],
    ajuizamento:   new Date(baseYear, i % 12, (i % 28) + 1).toLocaleDateString('pt-BR'),
    fase:          fases[i % fases.length],
    status:        status[i % status.length],
  };
});

// ── Cache em memória ──────────────────────────────────────────────────────────
const _cache = new Map();
function cacheGet(key) {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) { _cache.delete(key); return null; }
  return hit.data;
}
function cacheSet(key, data, ttlMs = 30 * 60 * 1000) {
  _cache.set(key, { data, expires: Date.now() + ttlMs });
}

// ── Helper: proxy POST to DataJud ─────────────────────────────────────────────
function datajudPost(indexPath, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url     = new URL(DATAJUD_URL + indexPath);
    const opts    = {
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers:  {
        'Authorization':  `APIKey ${DATAJUD_KEY}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.setTimeout(28000, () => { req.destroy(); reject(new Error('DataJud timeout')); });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Build filter based on available config or query param
function buildFilter(varaNomeParam) {
  if (VARA_CODIGO) return { term: { 'orgaoJulgador.codigo': Number(VARA_CODIGO) } };
  const nome = varaNomeParam || VARA_NOME;
  if (nome) return { term: { 'orgaoJulgador.nome.keyword': nome } };
  return { match_all: {} };
}

function hasConfig() { return !!DATAJUD_KEY; }

function buildPeriodFilter(req) {
  const mes = req.query.mes;
  const ano = req.query.ano;
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [y, m] = mes.split('-').map(Number);
    const next = new Date(y, m, 1);
    return { range: { dataAjuizamento: {
      gte: `${y}-${String(m).padStart(2,'0')}-01`,
      lt:  `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-01`,
    } } };
  }
  if (ano && /^\d{4}$/.test(ano)) {
    return { range: { dataAjuizamento: { gte: `${ano}-01-01`, lt: `${Number(ano)+1}-01-01` } } };
  }
  return null;
}

function buildQuery(req) {
  const vara   = varaQuery(req);
  if (!vara) return null;
  const period = buildPeriodFilter(req);
  const filters = [vara, period].filter(Boolean);
  return { bool: { filter: filters } };
}

// ── Auth middleware for dashboard ─────────────────────────────────────────────
function dashAuth(req, res, next) {
  const pw = req.query.pw || req.headers['x-dashboard-password'] || '';
  if (pw === DASH_PASS) return next();
  res.status(401).send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Acesso Restrito</title>
      <style>
        body { font-family: system-ui, sans-serif; background: #0a1628; color: #fff;
               display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .box { background: #1a2f5e; border: 1px solid rgba(200,167,91,.3); border-radius: 12px;
               padding: 2.5rem 3rem; text-align: center; max-width: 360px; }
        h2  { color: #C8A75B; font-size: 1.3rem; margin-bottom: .5rem; }
        p   { color: rgba(255,255,255,.6); font-size: .9rem; margin-bottom: 1.5rem; }
        form { display: flex; flex-direction: column; gap: .75rem; }
        input[type=password] { padding: .7rem 1rem; border-radius: 6px; border: 1.5px solid rgba(200,167,91,.3);
                               background: #0a1628; color: #fff; font-size: 1rem; outline: none; }
        input[type=password]:focus { border-color: #C8A75B; }
        button { padding: .75rem; background: linear-gradient(135deg,#C8A75B,#d4af37); color: #0a1628;
                 font-weight: 700; border: none; border-radius: 6px; cursor: pointer; font-size: .9rem; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>Dashboard PJe</h2>
        <p>Acesso restrito. Insira a senha para continuar.</p>
        <form method="GET" action="/pje-dashboard">
          <input type="password" name="pw" placeholder="Senha" autofocus>
          <button type="submit">Entrar</button>
        </form>
      </div>
    </body>
    </html>
  `);
}

const IDX   = `/${INDEX_NAME}/_search`;
const IDX_COUNT = `/${INDEX_NAME}/_count`;

// Retorna query ElasticSearch por vara — usa ?vara= do query param
function varaQuery(req) {
  const vara = req.query.vara || VARA_NOME;
  if (!vara) return null;
  return { term: { 'orgaoJulgador.nome.keyword': vara } };
}

// ── API: lista todas as varas do TRT-3 ───────────────────────────────────────
app.get('/api/pje/varas', async (req, res) => {
  try {
    const body = { size: 0, aggs: { varas: { terms: { field: 'orgaoJulgador.nome.keyword', size: 300, order: { _key: 'asc' } } } } };
    const r = await datajudPost(IDX, body);
    if (r.status !== 200) throw new Error(`DataJud ${r.status}`);
    res.json({ varas: (r.body.aggregations?.varas?.buckets ?? []).map(b => ({ nome: b.key, total: b.doc_count })) });
  } catch (e) { console.error('[pje/varas]', e.message); res.status(502).json({ error: e.message }); }
});

// ── API: stats ────────────────────────────────────────────────────────────────
app.get('/api/pje/stats', async (req, res) => {
  const q = buildQuery(req);
  if (!q) return res.json({ ...MOCK_STATS, ultima_atualizacao: new Date().toISOString() });
  const hasPeriod = !!(req.query.mes || req.query.ano);
  try {
    // _count retorna total exato sem limitação de 10k
    const [rCount, rAggs] = await Promise.all([
      datajudPost(IDX_COUNT, { query: q }),
      hasPeriod ? Promise.resolve(null) : datajudPost(IDX, {
        query: q, size: 0,
        aggs: { dist_mes: { filter: { range: { dataAjuizamento: { gte: new Date().toISOString().slice(0,7) } } } } },
      }),
    ]);
    if (rCount.status !== 200) throw new Error(`DataJud ${rCount.status}`);
    const total = rCount.body.count ?? 0;
    res.json({
      acervo:            hasPeriod ? null  : total,
      ajuizados_periodo: hasPeriod ? total : null,
      distribuidos_mes:  hasPeriod ? null  : (rAggs?.body?.aggregations?.dist_mes?.doc_count ?? 0),
      periodo_filtrado:  hasPeriod,
      concluidos_mes: null, taxa_acordo: null,
      ultima_atualizacao: new Date().toISOString(), mock: false,
    });
  } catch (e) { console.error('[pje/stats]', e.message); res.status(502).json({ error: e.message }); }
});

// ── API: classes ──────────────────────────────────────────────────────────────
app.get('/api/pje/classes', async (req, res) => {
  const q = buildQuery(req);
  if (!q) return res.json({ classes: MOCK_CLASSES, mock: true });
  try {
    const body = { query: q, size: 0, aggs: { por_classe: { terms: { field: 'classe.nome.keyword', size: 20 } } } };
    const r = await datajudPost(IDX, body);
    if (r.status !== 200) throw new Error(`DataJud ${r.status}`);
    res.json({ classes: (r.body.aggregations?.por_classe?.buckets ?? []).map(b => ({ nome: b.key, total: b.doc_count })), mock: false });
  } catch (e) { console.error('[pje/classes]', e.message); res.status(502).json({ error: e.message }); }
});

// ── API: volume mensal ────────────────────────────────────────────────────────
app.get('/api/pje/volume-mensal', async (req, res) => {
  const q = buildQuery(req);
  if (!q) return res.json({ por_mes: MOCK_POR_MES, mock: true });
  try {
    const body = { query: q, size: 0, aggs: { por_mes: { date_histogram: { field: 'dataAjuizamento', calendar_interval: 'month', format: 'MM/yyyy' } } } };
    const r = await datajudPost(IDX, body);
    if (r.status !== 200) throw new Error(`DataJud ${r.status}`);
    const yearNow = new Date().getFullYear();
    const valid = (r.body.aggregations?.por_mes?.buckets ?? [])
      .filter(b => b.doc_count > 0)
      .filter(b => { const y = new Date(b.key).getFullYear(); return y >= 2000 && y <= yearNow + 1; });
    res.json({ por_mes: valid.slice(-36).map(b => ({ mes: b.key_as_string, total: b.doc_count })), mock: false });
  } catch (e) { console.error('[pje/volume-mensal]', e.message); res.status(502).json({ error: e.message }); }
});

// ── API: assuntos ─────────────────────────────────────────────────────────────
app.get('/api/pje/assuntos', async (req, res) => {
  const q = buildQuery(req);
  if (!q) return res.json({ assuntos: MOCK_ASSUNTOS, mock: true });
  try {
    const body = { query: q, size: 0, aggs: { por_assunto: { terms: { field: 'assuntos.nome.keyword', size: 15 } } } };
    const r = await datajudPost(IDX, body);
    if (r.status !== 200) throw new Error(`DataJud ${r.status}`);
    res.json({ assuntos: (r.body.aggregations?.por_assunto?.buckets ?? []).map(b => ({ nome: b.key, total: b.doc_count })), mock: false });
  } catch (e) { console.error('[pje/assuntos]', e.message); res.status(502).json({ error: e.message }); }
});

// ── API: tempos (mock — requer pipeline de movimentos) ────────────────────────
app.get('/api/pje/tempos', async (req, res) => {
  res.json({ tempos: MOCK_TEMPOS, mock: true });
});

// ── API: eficiência — distribuição do acervo por antiguidade ─────────────────
const MOCK_EFICIENCIA = {
  faixas: [
    { nome: 'Menos de 1 ano', total: 94,  pct: 11.1 },
    { nome: '1 a 2 anos',     total: 178, pct: 21.0 },
    { nome: '2 a 4 anos',     total: 253, pct: 29.9 },
    { nome: 'Mais de 4 anos', total: 322, pct: 38.0 },
  ],
  total_acervo: 847,
  tempo_medio_estimado_anos: 2.9,
  mock: true,
};

app.get('/api/pje/eficiencia', async (req, res) => {
  const q = buildQuery(req);
  if (!q) return res.json({ ...MOCK_EFICIENCIA });
  try {
    const body = {
      query: q,
      size: 0,
      aggs: {
        por_faixa: {
          date_range: {
            field: 'dataAjuizamento',
            ranges: [
              { key: 'Menos de 1 ano', from: 'now-1y/d' },
              { key: '1 a 2 anos',     from: 'now-2y/d', to: 'now-1y/d' },
              { key: '2 a 4 anos',     from: 'now-4y/d', to: 'now-2y/d' },
              { key: 'Mais de 4 anos', to:   'now-4y/d' },
            ],
          },
        },
      },
    };
    const r = await datajudPost(IDX, body);
    if (r.status !== 200) throw new Error(`DataJud ${r.status}`);
    const buckets   = r.body.aggregations?.por_faixa?.buckets ?? [];
    const total     = buckets.reduce((s, b) => s + b.doc_count, 0);
    const midpoints = { 'Menos de 1 ano': 0.5, '1 a 2 anos': 1.5, '2 a 4 anos': 3, 'Mais de 4 anos': 5 };
    const faixas    = buckets.map(b => ({
      nome:  b.key,
      total: b.doc_count,
      pct:   total ? Number((b.doc_count / total * 100).toFixed(1)) : 0,
    }));
    const tempoMedio = total
      ? Number((faixas.reduce((s, f) => s + f.total * (midpoints[f.nome] ?? 3), 0) / total).toFixed(2))
      : 0;
    res.json({ faixas, total_acervo: total, tempo_medio_estimado_anos: tempoMedio, mock: false });
  } catch (e) { console.error('[pje/eficiencia]', e.message); res.status(502).json({ error: e.message }); }
});

// ── API: processos recentes ───────────────────────────────────────────────────
app.get('/api/pje/processos', async (req, res) => {
  const q = buildQuery(req);
  if (!q) return res.json({ processos: MOCK_PROCESSOS, mock: true });
  try {
    const body = { query: q, sort: [{ dataAjuizamento: { order: 'desc' } }],
                   _source: ['numeroProcesso', 'dataAjuizamento', 'classe', 'grau'], size: 30 };
    const r = await datajudPost(IDX, body);
    if (r.status !== 200) throw new Error(`DataJud ${r.status}`);
    res.json({ processos: (r.body.hits?.hits ?? []).map(h => ({
      numero:      h._source.numeroProcesso,
      classe:      h._source.classe?.nome ?? '—',
      ajuizamento: String(h._source.dataAjuizamento || '').replace(/(\d{4})(\d{2})(\d{2}).*/, '$3/$2/$1'),
      grau:        h._source.grau ?? '—',
    })), mock: false });
  } catch (e) { console.error('[pje/processos]', e.message); res.status(502).json({ error: e.message }); }
});

// ── API: busca processo individual ────────────────────────────────────────────
app.get('/api/pje/processo/:numero', async (req, res) => {
  const numero = req.params.numero.replace(/[^\d.\-]/g, '');
  if (!numero) return res.status(400).json({ error: 'Número inválido' });
  try {
    const soDigits = numero.replace(/\D/g, '');
    const body = { query: { bool: { should: [
      { term:         { 'numeroProcesso.keyword': numero } },
      { query_string: { query: `"${numero}"`, default_field: 'numeroProcesso' } },
      { term:         { 'numeroProcesso.keyword': soDigits } },
    ], minimum_should_match: 1 } }, size: 1 };
    const r = await datajudPost(IDX, body);
    if (r.status !== 200) throw new Error(`DataJud ${r.status}`);
    const hit = r.body.hits?.hits?.[0];
    if (!hit) return res.status(404).json({ error: 'Processo não encontrado' });
    res.json({ processo: hit._source });
  } catch (e) { console.error('[pje/processo]', e.message); res.status(502).json({ error: e.message }); }
});

// ── API: comparativo por período ──────────────────────────────────────────────
app.get('/api/pje/comparativo', async (req, res) => {
  const q    = varaQuery(req);
  const tipo = req.query.tipo || 'mes';
  if (!q) {
    const MOCK = tipo === 'mes'
      ? MOCK_POR_MES.map(m => ({ label: m.mes, total: m.total, classes: [] }))
      : Array.from({length:5}, (_, i) => ({ label: String(new Date().getFullYear()-4+i), total: Math.round(200+Math.random()*100), classes: [] }));
    return res.json({ tipo, periodos: MOCK, mock: true });
  }
  const interval = tipo === 'mes' ? 'month' : 'year';
  const fmt      = tipo === 'mes' ? 'MM/yyyy' : 'yyyy';
  try {
    const body = {
      query: q, size: 0,
      aggs: {
        por_periodo: {
          date_histogram: { field: 'dataAjuizamento', calendar_interval: interval, format: fmt, min_doc_count: 0 },
          aggs: { por_classe: { terms: { field: 'classe.nome.keyword', size: 3 } } },
        },
      },
    };
    const r = await datajudPost(IDX, body);
    if (r.status !== 200) throw new Error(`DataJud ${r.status}`);
    const buckets = r.body.aggregations?.por_periodo?.buckets ?? [];
    const slice   = tipo === 'mes' ? 24 : 10;
    const ynow    = new Date().getFullYear();
    const validB  = buckets.filter(b => { const y = new Date(b.key).getFullYear(); return y >= 2000 && y <= ynow + 1; });
    res.json({
      tipo,
      periodos: validB.filter(b => b.doc_count > 0).slice(-slice).map(b => ({
        label:   b.key_as_string,
        total:   b.doc_count,
        classes: (b.por_classe?.buckets ?? []).map(c => ({ nome: c.key, total: c.doc_count })),
      })),
      mock: false,
    });
  } catch (e) { console.error('[pje/comparativo]', e.message); res.status(502).json({ error: e.message }); }
});

// ── API: varas comparativo ────────────────────────────────────────────────────
app.get('/api/pje/varas-comparativo', async (req, res) => {
  const varaPrincipal = req.query.vara || VARA_NOME;
  const grupo         = req.query.grupo || 'proximas';
  if (!varaPrincipal) return res.json({ ...MOCK_VARAS_COMPARATIVO });

  const cacheKey = `varas-comp:${varaPrincipal}:${grupo}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  try {
    // Buscar todas as varas (cache 1h pois muda pouco)
    const varasKey = 'todas-varas';
    let todasVaras = cacheGet(varasKey);
    if (!todasVaras) {
      const rVaras = await datajudPost(IDX, {
        size: 0,
        aggs: { varas: { terms: { field: 'orgaoJulgador.nome.keyword', size: 300, order: { _count: 'desc' } } } },
      });
      if (rVaras.status !== 200) throw new Error(`DataJud ${rVaras.status}`);
      todasVaras = (rVaras.body.aggregations?.varas?.buckets ?? []).map(b => ({ nome: b.key, acervo: b.doc_count }));
      cacheSet(varasKey, todasVaras, 60 * 60 * 1000);
    }

    // Filtrar apenas BH
    const varasBH = todasVaras.filter(v => /BELO HORIZONTE/i.test(v.nome));

    // Ranking da vara principal no universo BH (por acervo, maior = 1º)
    const rankingBH = (() => {
      const idx = varasBH.findIndex(v => v.nome === varaPrincipal);
      return idx === -1
        ? { posicao: null, total_varas: varasBH.length, percentil: null }
        : { posicao: idx + 1, total_varas: varasBH.length, percentil: Math.round((1 - idx / varasBH.length) * 100) };
    })();

    // Montar grupo de varas a detalhar (max 8)
    let grupoVaras;
    if (grupo === 'bh') {
      // Varas BH ordenadas por acervo, limitar a 8 ao redor da vara principal
      const idxPrincipal = varasBH.findIndex(v => v.nome === varaPrincipal);
      if (idxPrincipal === -1) {
        grupoVaras = varasBH.slice(0, 8).map(v => v.nome);
      } else {
        const start = Math.max(0, idxPrincipal - 3);
        grupoVaras = varasBH.slice(start, start + 8).map(v => v.nome);
      }
    } else {
      // Varas próximas numericamente (extrair número da vara)
      const numMatch = varaPrincipal.match(/(\d+)ª/);
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        const prefix = varaPrincipal.replace(/^\d+ª/, '').trim();
        const proximas = [];
        for (let delta = -3; delta <= 3; delta++) {
          const n = num + delta;
          if (n < 1) continue;
          const ordinal = `${n}ª`;
          const candidata = todasVaras.find(v => v.nome.startsWith(ordinal) && v.nome.includes('BELO HORIZONTE'));
          if (candidata) proximas.push(candidata.nome);
        }
        // Garantir que a vara principal esteja incluída
        if (!proximas.includes(varaPrincipal)) proximas.unshift(varaPrincipal);
        grupoVaras = proximas.slice(0, 8);
      } else {
        grupoVaras = [varaPrincipal];
      }
    }

    // Buscar ultimos_12m e top_classe para cada vara do grupo em paralelo
    const gte12m = new Date();
    gte12m.setFullYear(gte12m.getFullYear() - 1);
    const gte12mStr = gte12m.toISOString().slice(0, 10);
    const gte4y     = new Date(); gte4y.setFullYear(gte4y.getFullYear() - 4);
    const gte4yStr  = gte4y.toISOString().slice(0, 10);

    const detalhes = await Promise.all(grupoVaras.map(async nome => {
      const acervoLocal = todasVaras.find(v => v.nome === nome)?.acervo ?? 0;
      const varaFilter  = { term: { 'orgaoJulgador.nome.keyword': nome } };
      // Uma única query por vara com sub-aggregations (evita N*2 queries simultâneas)
      const bodyVara = {
        query: { bool: { filter: [varaFilter] } },
        size: 0,
        aggs: {
          ultimos_12m: {
            filter: { range: { dataAjuizamento: { gte: gte12mStr } } },
            aggs: {
              por_classe:  { terms: { field: 'classe.nome.keyword',   size: 1 } },
              por_assunto: { terms: { field: 'assuntos.nome.keyword', size: 1 } },
            },
          },
          antigos: { filter: { range: { dataAjuizamento: { lt: gte4yStr } } } },
        },
      };
      try {
        const r        = await datajudPost(IDX, bodyVara);
        const aggs     = r.body?.aggregations ?? {};
        const hits12m  = aggs.ultimos_12m?.doc_count ?? 0;
        const antigos  = aggs.antigos?.doc_count ?? 0;
        const topClasse  = aggs.ultimos_12m?.por_classe?.buckets?.[0]?.key  ?? '—';
        const topAssunto = aggs.ultimos_12m?.por_assunto?.buckets?.[0]?.key ?? '—';
        const pctAntigos = acervoLocal > 0 ? +((antigos / acervoLocal) * 100).toFixed(1) : 0;
        return { nome, acervo: acervoLocal, ultimos_12m: hits12m,
                 media_mensal: Math.round(hits12m / 12),
                 top_classe: topClasse, top_assunto: topAssunto,
                 pct_antigos: pctAntigos };
      } catch {
        return { nome, acervo: acervoLocal, ultimos_12m: 0, media_mensal: 0,
                 top_classe: '—', top_assunto: '—', pct_antigos: 0 };
      }
    }));

    const result = { vara_principal: varaPrincipal, ranking_bh: rankingBH, varas: detalhes, mock: false };
    cacheSet(cacheKey, result, 30 * 60 * 1000);
    res.json(result);
  } catch (e) {
    console.error('[pje/varas-comparativo]', e.message);
    res.status(502).json({ error: e.message });
  }
});

// ── Dashboard (protected) ─────────────────────────────────────────────────────
app.get('/pje-dashboard', dashAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'pje-dashboard.html'));
});

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname), {
  extensions: ['html'],
  index:      'index.html',
}));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`Marina Trabalhista — porta ${PORT}`));
