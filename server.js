const express = require('express');
const path    = require('path');
const https   = require('https');
const { Pool } = require('pg');
const app     = express();
const PORT    = process.env.PORT || 3000;

// ── PostgreSQL ────────────────────────────────────────────────────────────────
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

async function dbq(sql, p = []) {
  const c = await pool.connect();
  try { return await c.query(sql, p); } finally { c.release(); }
}

async function initDB() {
  if (!pool) return;
  await dbq(`CREATE TABLE IF NOT EXISTS trt3_varas_snapshot (
    nome         TEXT PRIMARY KEY,
    acervo       INTEGER DEFAULT 0,
    ultimos_12m  INTEGER DEFAULT 0,
    media_mensal INTEGER DEFAULT 0,
    top_classe   TEXT    DEFAULT '—',
    top_assunto  TEXT    DEFAULT '—',
    pct_antigos  NUMERIC(5,2) DEFAULT 0,
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
  )`);
  await dbq(`ALTER TABLE trt3_varas_snapshot ADD COLUMN IF NOT EXISTS menos_1ano INTEGER DEFAULT 0`);
  await dbq(`ALTER TABLE trt3_varas_snapshot ADD COLUMN IF NOT EXISTS um_2anos INTEGER DEFAULT 0`);
  await dbq(`ALTER TABLE trt3_varas_snapshot ADD COLUMN IF NOT EXISTS dois_4anos INTEGER DEFAULT 0`);
  await dbq(`ALTER TABLE trt3_varas_snapshot ADD COLUMN IF NOT EXISTS mais_4anos INTEGER DEFAULT 0`);
  await dbq(`ALTER TABLE trt3_varas_snapshot ADD COLUMN IF NOT EXISTS tempo_medio_estimado NUMERIC(5,2) DEFAULT 0`);
  await dbq(`ALTER TABLE trt3_varas_snapshot ADD COLUMN IF NOT EXISTS indice_eficiencia NUMERIC(5,1) DEFAULT 0`);
  console.log('[DB] tabela trt3_varas_snapshot ok');
}
initDB().catch(e => console.error('[DB init]', e.message));

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
    { nome: '14ª VARA DO TRABALHO DE BELO HORIZONTE', acervo: 1203, ultimos_12m: 287, pct_antigos: 42, taxa_giro: 24, top_classe: 'Reclamação Trabalhista' },
    { nome: '15ª VARA DO TRABALHO DE BELO HORIZONTE', acervo: 985,  ultimos_12m: 241, pct_antigos: 38, taxa_giro: 24, top_classe: 'Reclamação Trabalhista' },
    { nome: '16ª VARA DO TRABALHO DE BELO HORIZONTE', acervo: 1074, ultimos_12m: 263, pct_antigos: 55, taxa_giro: 24, top_classe: 'Execução de Título Extrajudicial' },
    { nome: '17ª VARA DO TRABALHO DE BELO HORIZONTE', acervo: 847,  ultimos_12m: 198, pct_antigos: 47, taxa_giro: 23, top_classe: 'Reclamação Trabalhista' },
    { nome: '18ª VARA DO TRABALHO DE BELO HORIZONTE', acervo: 921,  ultimos_12m: 219, pct_antigos: 51, taxa_giro: 24, top_classe: 'Reclamação Trabalhista' },
    { nome: '19ª VARA DO TRABALHO DE BELO HORIZONTE', acervo: 1138, ultimos_12m: 274, pct_antigos: 62, taxa_giro: 24, top_classe: 'Mandado de Segurança' },
    { nome: '20ª VARA DO TRABALHO DE BELO HORIZONTE', acervo: 762,  ultimos_12m: 183, pct_antigos: 33, taxa_giro: 24, top_classe: 'Reclamação Trabalhista' },
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
  const de  = req.query.de;   // 'YYYY-MM' início do range
  const ate = req.query.ate;  // 'YYYY-MM' fim do range (inclusivo)
  if (de || ate) {
    const r = {};
    if (de)  r.gte = `${de}-01`;
    if (ate) {
      const [y, m] = ate.split('-').map(Number);
      const next   = new Date(y, m, 1);
      r.lt = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-01`;
    }
    return { range: { dataAjuizamento: r } };
  }
  // compatibilidade legada
  const mes = req.query.mes;
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [y, m] = mes.split('-').map(Number);
    const next = new Date(y, m, 1);
    return { range: { dataAjuizamento: {
      gte: `${y}-${String(m).padStart(2,'0')}-01`,
      lt:  `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-01`,
    } } };
  }
  const ano = req.query.ano;
  if (ano && /^\d{4}$/.test(ano)) {
    return { range: { dataAjuizamento: { gte: `${ano}-01-01`, lt: `${Number(ano)+1}-01-01` } } };
  }
  return null;
}

function hasPeriodFilter(req) {
  return !!(req.query.de || req.query.ate || req.query.mes || req.query.ano);
}

function buildQuery(req) {
  const vara   = varaQuery(req);
  if (!vara) return null;
  const period = buildPeriodFilter(req);
  const filters = [vara, period].filter(Boolean);
  return { bool: { filter: filters } };
}

// ── Análise de fases processuais (server-side) ────────────────────────────────
function analisarFasesServer(proc) {
  const rawAj = String(proc.dataAjuizamento || '').replace(/\D/g, '');
  if (rawAj.length < 8) return null;
  const dtAj = new Date(+rawAj.slice(0,4), +rawAj.slice(4,6)-1, +rawAj.slice(6,8));
  if (isNaN(dtAj)) return null;

  const movs = (proc.movimentos || [])
    .filter(m => m.dataHora)
    .sort((a,b) => a.dataHora.localeCompare(b.dataHora));

  const dias = (d1, d2) => Math.max(0, Math.round((new Date(d2) - new Date(d1)) / 86400000));

  let dataSentenca = null, dataRecurso = null, dataExecucao = null, dataConclusao = null;

  for (const m of movs) {
    const n = (m.nome || '').toLowerCase();
    const t = m.dataHora;
    if (!dataSentenca && /senten[cç]|homolog.*acordo|acordo.*homolog|improcedente|procedente.*mérito|dispensa.*cumprimento/.test(n))
      dataSentenca = t;
    if (!dataRecurso && /recurso ordinário|agravo de peti[cç]|embargos de declara[cç]|recurso de revist/.test(n))
      dataRecurso = t;
    if (!dataExecucao && /execu[cç]|penhora|arrest|bloqueio.*bacen|bacen.*bloqueio|cálculo.*homolog|homolog.*cálculo/.test(n))
      dataExecucao = t;
    if (/arquivamento|baixa definitiv|extinção do processo|extinção da execu|trânsito.*julgado.*quit|quit.*trânsito|pagamento total|satisfa[cç]/.test(n))
      dataConclusao = t;
  }

  if (!dataConclusao) return null;
  return {
    total_dias:        dias(dtAj, dataConclusao),
    conhecimento_dias: dataSentenca ? dias(dtAj, dataSentenca) : null,
    recursal_dias:     (dataRecurso && dataSentenca) ? dias(dataSentenca, dataRecurso) : null,
    execucao_dias:     dataExecucao ? dias(dataExecucao, dataConclusao) : null,
  };
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
  const hasPeriod = hasPeriodFilter(req);
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

// ── API: eficiência — taxa de giro + distribuição do acervo por antiguidade ───
const MOCK_EFICIENCIA = {
  faixas: [
    { nome: 'Menos de 1 ano', key: 'menos_1ano', total: 94,  pct: 11.1 },
    { nome: '1 a 2 anos',     key: 'um_2anos',   total: 178, pct: 21.0 },
    { nome: '2 a 4 anos',     key: 'dois_4anos', total: 253, pct: 29.9 },
    { nome: 'Mais de 4 anos', key: 'mais_4anos', total: 322, pct: 38.0 },
  ],
  total_acervo: 847,
  ultimos_12m: 198,
  taxa_giro: 23,
  tempo_medio_estimado_anos: 2.9,
  menos_1ano: 94, um_2anos: 178, dois_4anos: 253, mais_4anos: 322,
  indice_eficiencia: 15.5,
  mock: true,
};

// ── API: eficiência por fases — coortes anuais + evolução temporal ────────────
app.get('/api/pje/eficiencia-fases', async (req, res) => {
  const varaFilter = varaQuery(req);
  if (!varaFilter) return res.json({ mock: true, cohorts: [], total: null });

  const avg = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : null;

  function sumarizarCoorte(processos) {
    const fases = processos.map(h => analisarFasesServer(h._source)).filter(Boolean);
    if (!fases.length) return null;
    const tc = fases.map(f=>f.conhecimento_dias).filter(v=>v!=null);
    const tr = fases.map(f=>f.recursal_dias).filter(v=>v!=null);
    const te = fases.map(f=>f.execucao_dias).filter(v=>v!=null);
    return {
      amostrado:                     processos.length,
      concluidos:                    fases.length,
      tempo_medio_total_dias:        avg(fases.map(f=>f.total_dias)),
      tempo_medio_conhecimento_dias: avg(tc),
      tempo_medio_recursal_dias:     avg(tr),
      tempo_medio_execucao_dias:     avg(te),
      pct_com_recurso:  Math.round(tr.length/fases.length*100),
      pct_com_execucao: Math.round(te.length/fases.length*100),
    };
  }

  try {
    const anoAtual = new Date().getFullYear();
    // 6 coortes: processos ajuizados em cada ano (mais antigos têm mais concluídos)
    const anos = [anoAtual-6, anoAtual-5, anoAtual-4, anoAtual-3, anoAtual-2, anoAtual-1];

    const resultados = await Promise.all(anos.map(async ano => {
      try {
        const r = await datajudPost(IDX, {
          query: { bool: { filter: [
            varaFilter,
            { range: { dataAjuizamento: { gte: `${ano}-01-01`, lt: `${ano+1}-01-01` } } },
          ]}},
          size: 30,
          _source: ['dataAjuizamento', 'movimentos'],
        });
        const processos = r.body?.hits?.hits ?? [];
        const stats = sumarizarCoorte(processos);
        return { ano, ...(stats ?? { amostrado: processos.length, concluidos: 0 }) };
      } catch { return { ano, amostrado: 0, concluidos: 0 }; }
    }));

    // Total geral (todos os coortes combinados)
    const todosHits = resultados.flatMap(c => []); // já sumarizado por coorte
    // Recalcula total a partir das médias ponderadas dos coortes
    const comDados = resultados.filter(c => c.concluidos > 0);
    const totalConcluidos = comDados.reduce((s,c) => s + c.concluidos, 0);
    const totalAmostrado  = resultados.reduce((s,c) => s + c.amostrado, 0);
    const mediaGlobal = field => {
      const vals = comDados.flatMap(c => c[field] != null ? Array(c.concluidos).fill(c[field]) : []);
      return avg(vals);
    };

    res.json({
      mock: false,
      cohorts: resultados,
      total: {
        amostrado:                     totalAmostrado,
        concluidos:                    totalConcluidos,
        tempo_medio_total_dias:        mediaGlobal('tempo_medio_total_dias'),
        tempo_medio_conhecimento_dias: mediaGlobal('tempo_medio_conhecimento_dias'),
        tempo_medio_recursal_dias:     mediaGlobal('tempo_medio_recursal_dias'),
        tempo_medio_execucao_dias:     mediaGlobal('tempo_medio_execucao_dias'),
        pct_com_recurso:  comDados.length ? Math.round(comDados.reduce((s,c)=>s+c.pct_com_recurso,0)/comDados.length) : 0,
        pct_com_execucao: comDados.length ? Math.round(comDados.reduce((s,c)=>s+c.pct_com_execucao,0)/comDados.length) : 0,
      },
    });
  } catch(e) { console.error('[eficiencia-fases]', e.message); res.status(502).json({ error: e.message }); }
});

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
              { key: 'menos_1ano', from: 'now-1y/d' },
              { key: 'um_2anos',   from: 'now-2y/d', to: 'now-1y/d' },
              { key: 'dois_4anos', from: 'now-4y/d', to: 'now-2y/d' },
              { key: 'mais_4anos', to:   'now-4y/d' },
            ],
          },
        },
        ultimos_12m: {
          filter: { range: { dataAjuizamento: { gte: 'now-1y/d' } } },
        },
      },
    };
    const r = await datajudPost(IDX, body);
    if (r.status !== 200) throw new Error(`DataJud ${r.status}`);
    const aggs    = r.body.aggregations ?? {};
    const buckets = aggs.por_faixa?.buckets ?? [];
    const f       = key => buckets.find(b => b.key === key)?.doc_count ?? 0;
    const menos1  = f('menos_1ano');
    const um2     = f('um_2anos');
    const dois4   = f('dois_4anos');
    const mais4   = f('mais_4anos');
    const total   = menos1 + um2 + dois4 + mais4 || 1;
    const ult12m  = aggs.ultimos_12m?.doc_count ?? 0;
    const taxaGiro  = total > 0 ? +(ult12m / total * 100).toFixed(1) : 0;
    const tempoMedio = +((menos1*0.5 + um2*1.5 + dois4*3 + mais4*5.5) / total).toFixed(2);
    const pctMais4   = +(mais4 / total * 100).toFixed(1);
    const indice     = +Math.max(0, Math.min(100, taxaGiro * 2 - pctMais4 * 0.8)).toFixed(1);
    const nomesFaixas = { menos_1ano: 'Menos de 1 ano', um_2anos: '1 a 2 anos', dois_4anos: '2 a 4 anos', mais_4anos: 'Mais de 4 anos' };
    const faixas = buckets.map(b => ({
      nome:  nomesFaixas[b.key] ?? b.key,
      key:   b.key,
      total: b.doc_count,
      pct:   total > 0 ? Number((b.doc_count / total * 100).toFixed(1)) : 0,
    }));
    res.json({
      faixas, total_acervo: total, ultimos_12m: ult12m,
      taxa_giro: taxaGiro, tempo_medio_estimado_anos: tempoMedio,
      menos_1ano: menos1, um_2anos: um2, dois_4anos: dois4, mais_4anos: mais4,
      indice_eficiencia: indice, mock: false,
    });
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

  // ── Servir do banco se tiver snapshot ────────────────────────
  if (pool) {
    try {
      const snap = await dbq('SELECT * FROM trt3_varas_snapshot ORDER BY acervo DESC');
      if (snap.rows.length > 0) {
        const todas = snap.rows;
        const varasBH = todas; // snapshot já é só BH
        const idxPrincipal = varasBH.findIndex(v => v.nome === varaPrincipal);
        const rankingBH = idxPrincipal === -1
          ? { posicao: null, total_varas: varasBH.length, percentil: null }
          : { posicao: idxPrincipal + 1, total_varas: varasBH.length,
              percentil: Math.round((1 - idxPrincipal / varasBH.length) * 100) };

        let grupoVaras;
        if (grupo === 'bh') {
          grupoVaras = varasBH;
        } else {
          const numMatch = varaPrincipal.match(/(\d+)ª/);
          if (numMatch) {
            const num = parseInt(numMatch[1], 10);
            grupoVaras = varasBH.filter(v => {
              const m = v.nome.match(/(\d+)ª/);
              return m && Math.abs(parseInt(m[1], 10) - num) <= 3;
            });
          } else {
            grupoVaras = varasBH.slice(0, 8);
          }
        }
        const detalhes = grupoVaras.map(v => ({
          nome:                 v.nome,
          acervo:               +v.acervo,
          ultimos_12m:          +v.ultimos_12m,
          media_mensal:         +v.media_mensal,
          top_classe:           v.top_classe,
          top_assunto:          v.top_assunto,
          pct_antigos:          +v.pct_antigos,
          taxa_giro:            +v.acervo > 0 ? Math.round((+v.ultimos_12m / +v.acervo) * 100) : 0,
          menos_1ano:           +(v.menos_1ano ?? 0),
          um_2anos:             +(v.um_2anos   ?? 0),
          dois_4anos:           +(v.dois_4anos  ?? 0),
          mais_4anos:           +(v.mais_4anos  ?? 0),
          tempo_medio_estimado: +(v.tempo_medio_estimado ?? 0),
          indice_eficiencia:    +(v.indice_eficiencia    ?? 0),
        }));
        return res.json({ vara_principal: varaPrincipal, ranking_bh: rankingBH,
                          varas: detalhes, mock: false, fonte: 'banco' });
      }
    } catch (e) { console.error('[varas-comp db]', e.message); }
  }

  // ── Fallback: cache em memória → DataJud ──────────────────────
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
          por_faixa: {
            date_range: {
              field: 'dataAjuizamento',
              ranges: [
                { key: 'menos_1ano', from: 'now-1y/d' },
                { key: 'um_2anos',   from: 'now-2y/d', to: 'now-1y/d' },
                { key: 'dois_4anos', from: 'now-4y/d', to: 'now-2y/d' },
                { key: 'mais_4anos', to:   'now-4y/d' },
              ],
            },
          },
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
        const taxaGiro   = acervoLocal > 0 ? +(hits12m / acervoLocal * 100).toFixed(1) : 0;
        const fBuckets   = aggs.por_faixa?.buckets ?? [];
        const fv         = key => fBuckets.find(b => b.key === key)?.doc_count ?? 0;
        const menos1     = fv('menos_1ano');
        const um2        = fv('um_2anos');
        const dois4      = fv('dois_4anos');
        const mais4      = fv('mais_4anos');
        const tot        = acervoLocal || 1;
        const tempoMedio = +((menos1*0.5 + um2*1.5 + dois4*3 + mais4*5.5) / tot).toFixed(2);
        const pctMais4   = +(mais4 / tot * 100).toFixed(1);
        const indice     = +Math.max(0, Math.min(100, taxaGiro * 2 - pctMais4 * 0.8)).toFixed(1);
        return { nome, acervo: acervoLocal, ultimos_12m: hits12m,
                 media_mensal: Math.round(hits12m / 12),
                 top_classe: topClasse, top_assunto: topAssunto,
                 pct_antigos: pctAntigos, taxa_giro: taxaGiro,
                 menos_1ano: menos1, um_2anos: um2, dois_4anos: dois4, mais_4anos: mais4,
                 tempo_medio_estimado: tempoMedio, indice_eficiencia: indice };
      } catch {
        return { nome, acervo: acervoLocal, ultimos_12m: 0, media_mensal: 0,
                 top_classe: '—', top_assunto: '—', pct_antigos: 0, taxa_giro: 0,
                 menos_1ano: 0, um_2anos: 0, dois_4anos: 0, mais_4anos: 0,
                 tempo_medio_estimado: 0, indice_eficiencia: 0 };
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

// ── Admin: snapshot de todas as varas BH ─────────────────────────────────────
app.post('/api/admin/snapshot-varas', dashAuth, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'DATABASE_URL não configurado' });
  res.json({ status: 'iniciado', msg: 'Snapshot rodando em background (~2-5 min para todas as varas de BH)' });

  (async () => {
    try {
      const rVaras = await datajudPost(IDX, {
        size: 0,
        aggs: { varas: { terms: { field: 'orgaoJulgador.nome.keyword', size: 300, order: { _count: 'desc' } } } },
      });
      const todas   = rVaras.body.aggregations?.varas?.buckets ?? [];
      const varasBH = todas.filter(v => /BELO HORIZONTE/i.test(v.key));
      console.log(`[snapshot] ${varasBH.length} varas BH encontradas`);

      const gte12m = new Date(); gte12m.setFullYear(gte12m.getFullYear() - 1);
      const gte4y  = new Date(); gte4y.setFullYear(gte4y.getFullYear() - 4);
      const gte12mStr = gte12m.toISOString().slice(0, 10);
      const gte4yStr  = gte4y.toISOString().slice(0, 10);

      const BATCH = 4;
      let ok = 0;
      for (let i = 0; i < varasBH.length; i += BATCH) {
        const lote = varasBH.slice(i, i + BATCH);
        await Promise.all(lote.map(async v => {
          const varaFilter = { term: { 'orgaoJulgador.nome.keyword': v.key } };
          try {
            const r = await datajudPost(IDX, {
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
                por_faixa: {
                  date_range: {
                    field: 'dataAjuizamento',
                    ranges: [
                      { key: 'menos_1ano', from: 'now-1y/d' },
                      { key: 'um_2anos',   from: 'now-2y/d', to: 'now-1y/d' },
                      { key: 'dois_4anos', from: 'now-4y/d', to: 'now-2y/d' },
                      { key: 'mais_4anos', to:   'now-4y/d' },
                    ],
                  },
                },
              },
            });
            const aggs     = r.body?.aggregations ?? {};
            const hits12m  = aggs.ultimos_12m?.doc_count ?? 0;
            const antigos  = aggs.antigos?.doc_count ?? 0;
            const topC     = aggs.ultimos_12m?.por_classe?.buckets?.[0]?.key  ?? '—';
            const topA     = aggs.ultimos_12m?.por_assunto?.buckets?.[0]?.key ?? '—';
            const pctAnt   = v.doc_count > 0 ? +((antigos / v.doc_count) * 100).toFixed(1) : 0;
            const fBuckets = aggs.por_faixa?.buckets ?? [];
            const fv       = key => fBuckets.find(b => b.key === key)?.doc_count ?? 0;
            const menos1   = fv('menos_1ano');
            const um2      = fv('um_2anos');
            const dois4    = fv('dois_4anos');
            const mais4    = fv('mais_4anos');
            const tot      = v.doc_count || 1;
            const tempoMed = +((menos1*0.5 + um2*1.5 + dois4*3 + mais4*5.5) / tot).toFixed(2);
            const taxaG    = v.doc_count > 0 ? +(hits12m / v.doc_count * 100).toFixed(1) : 0;
            const pctM4    = +(mais4 / tot * 100).toFixed(1);
            const indice   = +Math.max(0, Math.min(100, taxaG * 2 - pctM4 * 0.8)).toFixed(1);
            await dbq(`
              INSERT INTO trt3_varas_snapshot
                (nome, acervo, ultimos_12m, media_mensal, top_classe, top_assunto, pct_antigos,
                 menos_1ano, um_2anos, dois_4anos, mais_4anos, tempo_medio_estimado, indice_eficiencia,
                 atualizado_em)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
              ON CONFLICT (nome) DO UPDATE SET
                acervo=EXCLUDED.acervo, ultimos_12m=EXCLUDED.ultimos_12m,
                media_mensal=EXCLUDED.media_mensal, top_classe=EXCLUDED.top_classe,
                top_assunto=EXCLUDED.top_assunto, pct_antigos=EXCLUDED.pct_antigos,
                menos_1ano=EXCLUDED.menos_1ano, um_2anos=EXCLUDED.um_2anos,
                dois_4anos=EXCLUDED.dois_4anos, mais_4anos=EXCLUDED.mais_4anos,
                tempo_medio_estimado=EXCLUDED.tempo_medio_estimado,
                indice_eficiencia=EXCLUDED.indice_eficiencia,
                atualizado_em=NOW()
            `, [v.key, v.doc_count, hits12m, Math.round(hits12m / 12), topC, topA, pctAnt,
                menos1, um2, dois4, mais4, tempoMed, indice]);
            ok++;
          } catch (e) { console.error(`[snapshot] ${v.key}: ${e.message}`); }
        }));
        await new Promise(r => setTimeout(r, 300)); // pausa entre batches
      }
      console.log(`[snapshot] concluído: ${ok}/${varasBH.length} varas salvas`);
    } catch (e) { console.error('[snapshot] erro geral:', e.message); }
  })();
});

app.get('/api/admin/snapshot-status', dashAuth, async (req, res) => {
  if (!pool) return res.json({ total: 0, atualizado_em: null, db: false });
  try {
    const r = await dbq('SELECT COUNT(*) as total, MAX(atualizado_em) as atualizado_em FROM trt3_varas_snapshot');
    res.json({ ...r.rows[0], db: true });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.post('/api/admin/test-db', dashAuth, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'sem DATABASE_URL' });
  try {
    await dbq(`INSERT INTO trt3_varas_snapshot (nome, acervo) VALUES ($1, $2)
               ON CONFLICT (nome) DO UPDATE SET acervo=EXCLUDED.acervo`,
               ['__teste__', 1]);
    const r = await dbq('SELECT COUNT(*) as total FROM trt3_varas_snapshot');
    await dbq("DELETE FROM trt3_varas_snapshot WHERE nome='__teste__'");
    res.json({ ok: true, total_antes: r.rows[0].total });
  } catch (e) { res.status(502).json({ error: e.message, stack: e.stack?.slice(0,300) }); }
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
