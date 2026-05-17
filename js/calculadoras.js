/**
 * calculadoras.js — Ferramentas jurídicas em JavaScript puro.
 * 1. Calculadora de Prescrição — Lei 14.010/2020
 * 2. Calculadora de Aviso Prévio
 * (Tabela de Reflexos é HTML estático, sem cálculo)
 */

/* ──────────────────────────────────────────────────────────
   UTILITÁRIOS
   ────────────────────────────────────────────────────────── */

function parseLocalDate(str) {
  // Garante parse correto sem problema de fuso horário
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function subtractYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() - years);
  return d;
}

function formatDate(date) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDateShort(date) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function diffYears(from, to) {
  let years = to.getFullYear() - from.getFullYear();
  const mDiff = to.getMonth() - from.getMonth();
  const dDiff = to.getDate() - from.getDate();
  if (mDiff < 0 || (mDiff === 0 && dDiff < 0)) years--;
  return years;
}

/* ──────────────────────────────────────────────────────────
   1. CALCULADORA DE PRESCRIÇÃO — LEI 14.010/2020
   ────────────────────────────────────────────────────────── */

/**
 * Entrada: data do ajuizamento da ação
 *
 * a) Prescrição quinquenal simples:
 *    ajuizamento − 5 anos
 *
 * b) Prescrição com suspensão Lei 14.010/2020:
 *    A lei suspendeu prazos de 12/06/2020 a 30/10/2020 (141 dias).
 *    Se o período prescricional (ajuizamento − 5 anos … ajuizamento)
 *    engloba esse intervalo, subtrai-se mais 141 dias da data de
 *    prescrição (a prescrição alcança 141 dias a mais para trás).
 */

const SUSPENSAO_INICIO = new Date(2020, 5, 12); // 12/06/2020
const SUSPENSAO_FIM    = new Date(2020, 9, 30); // 30/10/2020
const DIAS_SUSPENSAO   = 141;

function calcPrescricao() {
  const inputEl = document.getElementById('data-prescricao');
  const resultEl = document.getElementById('result-prescricao');

  if (!inputEl || !resultEl) return;
  const val = inputEl.value;
  if (!val) { alert('Por favor, informe a data do ajuizamento da ação.'); return; }

  const dataAjuizamento = parseLocalDate(val);

  // a) Prescrição quinquenal simples: ajuizamento − 5 anos
  const prescricaoSimples = subtractYears(dataAjuizamento, 5);

  // b) Há sobreposição se o período (prescricaoSimples … dataAjuizamento)
  //    intersecta (SUSPENSAO_INICIO … SUSPENSAO_FIM)
  let aplicaSuspensao = false;
  let prescricaoComSuspensao = prescricaoSimples;

  if (prescricaoSimples < SUSPENSAO_FIM && dataAjuizamento > SUSPENSAO_INICIO) {
    aplicaSuspensao = true;
    prescricaoComSuspensao = addDays(prescricaoSimples, -DIAS_SUSPENSAO);
  }

  resultEl.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;margin-bottom:1.5rem">

      <div style="background:rgba(200,167,91,0.07);border:1px solid rgba(200,167,91,0.25);border-radius:var(--radius);padding:1.25rem">
        <div class="result-label" style="margin-bottom:0.5rem">Prescrição quinquenal simples</div>
        <div class="result-value" style="font-size:1.3rem">${formatDateShort(prescricaoSimples)}</div>
        <p style="font-size:0.8rem;margin-top:0.75rem;color:var(--text-light);line-height:1.5">
          Ajuizamento (${formatDateShort(dataAjuizamento)}) &minus; 5 anos
        </p>
      </div>

      <div style="background:${aplicaSuspensao ? 'rgba(74,222,128,0.07)' : 'rgba(100,116,139,0.07)'};border:1px solid ${aplicaSuspensao ? 'rgba(74,222,128,0.30)' : 'rgba(100,116,139,0.20)'};border-radius:var(--radius);padding:1.25rem">
        <div class="result-label" style="margin-bottom:0.5rem">Com suspensão Lei 14.010/2020</div>
        <div class="result-value" style="font-size:1.3rem;color:${aplicaSuspensao ? '#4ade80' : 'inherit'}">${aplicaSuspensao ? formatDateShort(prescricaoComSuspensao) : '—'}</div>
        <p style="font-size:0.8rem;margin-top:0.75rem;color:var(--text-light);line-height:1.5">
          ${aplicaSuspensao
            ? `Quinquenal simples &minus; ${DIAS_SUSPENSAO} dias de suspensão`
            : 'Suspensão não se aplica a este período'}
        </p>
      </div>

    </div>

    <div class="result-detail">
      <div class="result-detail-item">
        <div class="rd-label">Data do ajuizamento</div>
        <div class="rd-value">${formatDateShort(dataAjuizamento)}</div>
      </div>
      <div class="result-detail-item">
        <div class="rd-label">Período prescricional abrangido</div>
        <div class="rd-value">${formatDateShort(prescricaoSimples)} a ${formatDateShort(dataAjuizamento)}</div>
      </div>
      <div class="result-detail-item">
        <div class="rd-label">Suspensão (12/06 – 30/10/2020)</div>
        <div class="rd-value">${aplicaSuspensao ? 'Aplica-se — 141 dias' : 'Não se aplica'}</div>
      </div>
    </div>

    ${aplicaSuspensao ? `
    <div class="result-note" style="margin-top:1.25rem">
      <p>
        <strong style="color:var(--gold)">&#9432; Suspensão aplicada:</strong>
        O período de 5 anos retroativos ao ajuizamento engloba o intervalo de suspensão da
        Lei 14.010/2020 (12/06/2020 a 30/10/2020 — 141 dias). Com a suspensão, a prescrição
        alcança <strong>${formatDateShort(prescricaoComSuspensao)}</strong>, ou seja, 141 dias a mais
        para trás em relação ao prazo quinquenal simples.
      </p>
    </div>` : `
    <div class="result-note" style="margin-top:1.25rem">
      <p>
        O período de 5 anos retroativos ao ajuizamento não engloba o intervalo de suspensão
        da Lei 14.010/2020 (12/06/2020 a 30/10/2020), portanto aplica-se apenas o prazo
        quinquenal simples.
      </p>
    </div>`}
  `;
  resultEl.classList.add('visible');
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ──────────────────────────────────────────────────────────
   2. CALCULADORA DE AVISO PRÉVIO
   ────────────────────────────────────────────────────────── */

/**
 * Lei 12.506/2011 — Aviso Prévio Proporcional
 * Base: 30 dias
 * Acréscimo: 3 dias por ano completo trabalhado
 *            (a partir do 2º ano, ou seja, o 1º ano não gera acréscimo)
 * Máximo: 90 dias (base 30 + acréscimo máximo 60 → 20 anos extras = ~21 anos total)
 *
 * Exemplo: 5 anos → 30 + (4 × 3) = 30 + 12 = 42 dias
 */

function calcAvisoPrevio() {
  const admissaoEl  = document.getElementById('data-admissao');
  const dispensaEl  = document.getElementById('data-dispensa');
  const resultEl    = document.getElementById('result-aviso');

  if (!admissaoEl || !dispensaEl || !resultEl) return;
  if (!admissaoEl.value || !dispensaEl.value) {
    alert('Por favor, informe as duas datas.'); return;
  }

  const admissao = parseLocalDate(admissaoEl.value);
  const dispensa = parseLocalDate(dispensaEl.value);

  if (dispensa <= admissao) {
    alert('A data de dispensa deve ser posterior à data de admissão.'); return;
  }

  const anos = diffYears(admissao, dispensa);

  // Anos que geram acréscimo (a partir do 2º ano completo)
  const anosAcrescimo = Math.max(0, anos - 1);
  const diasAcrescimo = Math.min(anosAcrescimo * 3, 60); // máximo 60 dias de acréscimo
  const totalDias     = 30 + diasAcrescimo;

  // Projeção: data de dispensa + aviso prévio
  const dataFimAviso = addDays(dispensa, totalDias);

  // Tempo de serviço (anos + meses)
  let meses = dispensa.getMonth() - admissao.getMonth();
  let dias  = dispensa.getDate()  - admissao.getDate();
  if (dias < 0)  { meses--; }
  if (meses < 0) { meses += 12; }
  const mesesDisplay = ((meses % 12) + 12) % 12;

  resultEl.innerHTML = `
    <div class="result-label">Aviso Prévio Proporcional (Lei 12.506/2011)</div>
    <div class="result-value">${totalDias} dias de aviso prévio</div>
    <div class="result-detail" style="margin-top:1.25rem">
      <div class="result-detail-item">
        <div class="rd-label">Tempo de serviço</div>
        <div class="rd-value">${anos} ano${anos !== 1 ? 's' : ''} e ${mesesDisplay} mês${mesesDisplay !== 1 ? 'es' : ''}</div>
      </div>
      <div class="result-detail-item">
        <div class="rd-label">Aviso base</div>
        <div class="rd-value">30 dias</div>
      </div>
      <div class="result-detail-item">
        <div class="rd-label">Acréscimo proporcional</div>
        <div class="rd-value">+ ${diasAcrescimo} dias (${anosAcrescimo} × 3)</div>
      </div>
      <div class="result-detail-item">
        <div class="rd-label">Data-limite do aviso</div>
        <div class="rd-value">${formatDateShort(dataFimAviso)}</div>
      </div>
    </div>
    <div class="result-note" style="margin-top:1.25rem">
      <p>
        <strong style="color:var(--gold)">Base legal:</strong> Art. 1º da Lei 12.506/2011.
        O acréscimo de 3 dias incide a partir do 2º ano completo de serviço.
        O período máximo de aviso prévio é de <strong>90 dias</strong>.
        ${totalDias === 90 ? 'O limite máximo foi atingido.' : ''}
      </p>
    </div>
    <div class="result-note" style="margin-top:0.75rem;border-color:rgba(200,167,91,0.30)">
      <p>
        <strong style="color:var(--gold)">&#9432; Projeção:</strong>
        Admissão em ${formatDate(admissao)} &bull;
        Dispensa em ${formatDate(dispensa)} &bull;
        Fim do aviso em <strong style="color:#fde68a">${formatDate(dataFimAviso)}</strong>.
      </p>
    </div>
  `;
  resultEl.classList.add('visible');
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ──────────────────────────────────────────────────────────
   3. REMOVEDOR DE ESPAÇOS
   ────────────────────────────────────────────────────────── */

function atualizarContadorEspacos() {
  const ta = document.getElementById('espacos-input');
  const contador = document.getElementById('espacos-contador');
  if (!ta || !contador) return;
  const txt = ta.value;
  const chars = txt.length;
  const palavras = txt.trim() === '' ? 0 : txt.trim().split(/\s+/).length;
  const linhas = txt === '' ? 0 : txt.split('\n').length;
  const espacos = (txt.match(/ /g) || []).length;
  contador.textContent = `Caract: ${chars} | Palavras: ${palavras} | Linhas: ${linhas} | Espaços: ${espacos}`;
}

function removerEspacos(texto, modo, preservarQuebras, cortarBordas) {
  if (cortarBordas) texto = texto.trim();
  switch (modo) {
    case 'normalizar':      return texto.replace(/ {2,}/g, ' ');
    case 'remover-todos':   return texto.replace(/ /g, '');
    case 'cortar-linhas':   return texto.split('\n').map(l => l.trim()).join('\n');
    case 'remover-vazias':  return texto.split('\n').filter(l => l.trim()).join('\n');
    case 'compacto':        return texto.split('\n').map(l => l.trim()).filter(l => l).join('\n').replace(/ {2,}/g, ' ');
    case 'linha-unica':     return texto.replace(/\s+/g, ' ').trim();
    case 'remover-tudo':    return texto.replace(/\s/g, '');
    default:                return texto;
  }
}

function executarRemocaoEspacos() {
  const input = document.getElementById('espacos-input');
  const resultBox = document.getElementById('espacos-result-wrap');
  const resultTa = document.getElementById('espacos-output');
  if (!input || !resultBox || !resultTa) return;

  const texto = input.value;
  if (!texto.trim() && texto === '') { alert('Cole ou digite um texto primeiro.'); return; }

  const modo = document.querySelector('input[name="espacos-modo"]:checked')?.value || 'normalizar';
  const preservar = document.getElementById('espacos-preservar')?.checked ?? true;
  const cortar = document.getElementById('espacos-cortar')?.checked ?? false;

  const resultado = removerEspacos(texto, modo, preservar, cortar);
  resultTa.value = resultado;
  resultBox.style.display = 'block';
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function limparRemocaoEspacos() {
  const input = document.getElementById('espacos-input');
  const resultBox = document.getElementById('espacos-result-wrap');
  const resultTa = document.getElementById('espacos-output');
  const contador = document.getElementById('espacos-contador');
  if (input) input.value = '';
  if (resultTa) resultTa.value = '';
  if (resultBox) resultBox.style.display = 'none';
  if (contador) contador.textContent = 'Caract: 0 | Palavras: 0 | Linhas: 0 | Espaços: 0';
}

function copiarEspacosOutput() {
  const ta = document.getElementById('espacos-output');
  if (!ta || !ta.value) return;
  navigator.clipboard.writeText(ta.value).then(() => {
    const btn = document.getElementById('espacos-copiar-btn');
    if (btn) { btn.textContent = 'Copiado!'; setTimeout(() => { btn.textContent = 'Copiar'; }, 1800); }
  }).catch(() => {
    ta.select();
    document.execCommand('copy');
  });
}

/* ──────────────────────────────────────────────────────────
   4. CALCULADORA DE AVOS — FÉRIAS E 13º
   ────────────────────────────────────────────────────────── */

/**
 * Calcula quantos avos de férias o empregado tem por período,
 * e os avos de 13º proporcional no ano civil.
 *
 * Regras aplicadas:
 * - Art. 130 CLT: tabela de faltas → dias de férias
 * - Art. 133 CLT: hipóteses que reiniciam o período aquisitivo
 * - Mês conta se trabalhado por mais de 14 dias (Art. 142 §2º)
 * - Período aquisitivo: 12 meses a partir da admissão
 * - Período concessivo: 12 meses seguintes ao aquisitivo
 */

function diasFeriasPorFaltas(faltas) {
  if (faltas <= 5)  return 30;
  if (faltas <= 14) return 24;
  if (faltas <= 23) return 18;
  if (faltas <= 32) return 12;
  return 0;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function diffDias(from, to) {
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

// Retorna quantos meses completos ou com >14 dias entre duas datas
function avosEntre(inicio, fim) {
  let avos = 0;
  let cursor = new Date(inicio);
  while (cursor < fim) {
    const proxMes = addMonths(cursor, 1);
    const fimPeriodo = proxMes <= fim ? proxMes : fim;
    const diasNoMes = diffDias(cursor, fimPeriodo);
    if (diasNoMes > 14) avos++;
    cursor = proxMes;
  }
  return Math.min(avos, 12);
}

function statusPeriodoConcessivo(periodoConcessivoFim, hoje) {
  if (hoje > periodoConcessivoFim) return { label: 'Vencidas', cor: '#f87171' };
  return { label: 'Em período concessivo', cor: '#fde68a' };
}

function calcAvos() {
  const admEl   = document.getElementById('avos-admissao');
  const saidaEl = document.getElementById('avos-saida');
  const faltasEl = document.getElementById('avos-faltas');
  const resultEl = document.getElementById('result-avos');
  const aindaContratado = document.getElementById('avos-ainda-contratado')?.checked;

  if (!admEl.value) { alert('Informe a data de admissão.'); return; }
  if (!saidaEl.value) { alert('Informe a data de saída.'); return; }

  const admissao = parseLocalDate(admEl.value);
  const saida    = parseLocalDate(saidaEl.value);
  const hoje     = new Date(); hoje.setHours(0,0,0,0);
  const faltas   = parseInt(faltasEl.value) || 0;
  const diasFerias = diasFeriasPorFaltas(faltas);

  if (saida < admissao) { alert('A data de saída deve ser posterior à admissão.'); return; }

  // Hipóteses Art. 133 CLT marcadas pelo usuário (os índices correspondem aos checkboxes)
  const hipoteses133 = [
    document.getElementById('art133-1')?.checked,
    document.getElementById('art133-2')?.checked,
    document.getElementById('art133-3')?.checked,
    document.getElementById('art133-4')?.checked,
    document.getElementById('art133-5')?.checked,
  ];
  const temHipotese133 = hipoteses133.some(Boolean);

  // ── Períodos Aquisitivos ───────────────────────────────
  const periodos = [];
  let inicioAquis = new Date(admissao);

  while (inicioAquis < saida) {
    const fimAquis = addYears(inicioAquis, 1);
    const inicioConces = new Date(fimAquis);
    const fimConces = addYears(fimAquis, 1);

    // Período completo (12 meses)
    if (fimAquis <= saida) {
      let status, cor;
      if (temHipotese133) {
        status = 'Perdidas (Art. 133 CLT)';
        cor = '#f87171';
      } else if (hoje < inicioConces) {
        status = 'Em período concessivo';
        cor = '#fde68a';
      } else if (hoje >= inicioConces && hoje <= fimConces) {
        const r = statusPeriodoConcessivo(fimConces, hoje);
        status = r.label; cor = r.cor;
      } else {
        status = 'Vencidas';
        cor = '#f87171';
      }

      periodos.push({
        tipo: 'completo',
        inicioAquis, fimAquis,
        inicioConces, fimConces,
        diasFerias: diasFerias,
        status, cor
      });
    } else {
      // Período incompleto (proporcional)
      const avos = avosEntre(inicioAquis, saida);
      const diasProp = parseFloat((avos / 12 * diasFerias).toFixed(2));
      periodos.push({
        tipo: 'proporcional',
        inicioAquis,
        fimAquis: saida,
        avos,
        diasFerias,
        diasProporcionais: diasProp
      });
    }

    inicioAquis = new Date(fimAquis);
  }

  // ── 13º Proporcional ──────────────────────────────────
  const anoSaida = saida.getFullYear();
  const inicioAno = new Date(anoSaida, 0, 1);  // 1º de janeiro do ano da saída
  const inicioContagem = admissao > inicioAno ? admissao : inicioAno;
  const avos13 = avosEntre(inicioContagem, saida);
  const fracao13 = avos13 + '/12';

  // ── Renderização ───────────────────────────────────────
  let html = '<div style="position:relative;z-index:1">';

  // Título férias completas
  const periodosCompletos = periodos.filter(p => p.tipo === 'completo');
  const periodoProporcional = periodos.find(p => p.tipo === 'proporcional');

  if (periodosCompletos.length > 0) {
    html += `<div class="avos-section-title">F&eacute;rias — Per&iacute;odos Aquisitivos Completos</div>`;
    periodosCompletos.forEach((p, i) => {
      html += `
        <div class="avos-periodo-card">
          <div class="avos-periodo-header">
            <span class="avos-periodo-num">${i + 1}º Per&iacute;odo</span>
            <span class="avos-status-badge" style="color:${p.cor}">${p.status}</span>
          </div>
          <div class="avos-row">
            <div class="avos-col">
              <div class="avos-label">Per&iacute;odo Aquisitivo</div>
              <div class="avos-val">${formatDateShort(p.inicioAquis)} – ${formatDateShort(new Date(p.fimAquis.getTime() - 86400000))}</div>
            </div>
            <div class="avos-col">
              <div class="avos-label">Per&iacute;odo Concessivo</div>
              <div class="avos-val">${formatDateShort(p.inicioConces)} – ${formatDateShort(new Date(p.fimConces.getTime() - 86400000))}</div>
            </div>
            <div class="avos-col">
              <div class="avos-label">Dias de F&eacute;rias (Art. 130)</div>
              <div class="avos-val avos-gold">${p.diasFerias === 0 ? '0 (perdidas por faltas)' : p.diasFerias + ' dias'}</div>
            </div>
          </div>
        </div>`;
    });
  }

  // Férias proporcionais
  if (periodoProporcional && periodoProporcional.avos > 0) {
    html += `
      <div class="avos-section-title">F&eacute;rias Proporcionais</div>
      <div class="avos-periodo-card">
        <div class="avos-row">
          <div class="avos-col">
            <div class="avos-label">Per&iacute;odo</div>
            <div class="avos-val">${formatDateShort(periodoProporcional.inicioAquis)} – ${formatDateShort(new Date(periodoProporcional.fimAquis.getTime() - 86400000))}</div>
          </div>
          <div class="avos-col">
            <div class="avos-label">Avos</div>
            <div class="avos-val avos-gold">${periodoProporcional.avos}/12</div>
          </div>
          <div class="avos-col">
            <div class="avos-label">Dias Proporcionais</div>
            <div class="avos-val avos-gold">${periodoProporcional.avos}/12 &times; ${periodoProporcional.diasFerias} = <strong>${periodoProporcional.diasProporcionais} dias</strong></div>
          </div>
        </div>
      </div>`;
  } else if (!periodoProporcional && periodosCompletos.length === 0) {
    html += `<div class="avos-periodo-card"><p style="color:rgba(255,255,255,0.6);margin:0">Menos de 15 dias trabalhados — sem direito a f&eacute;rias proporcionais.</p></div>`;
  }

  // 13º Proporcional
  html += `
    <div class="avos-section-title">13&ordm; Sal&aacute;rio Proporcional (Art. 7&ordm;, VIII, CF)</div>
    <div class="avos-periodo-card">
      <div class="avos-row">
        <div class="avos-col">
          <div class="avos-label">Ano de refer&ecirc;ncia</div>
          <div class="avos-val">${anoSaida}</div>
        </div>
        <div class="avos-col">
          <div class="avos-label">Per&iacute;odo contado</div>
          <div class="avos-val">${formatDateShort(inicioContagem)} – ${formatDateShort(new Date(saida.getTime() - 86400000))}</div>
        </div>
        <div class="avos-col">
          <div class="avos-label">Avos do 13&ordm;</div>
          <div class="avos-val avos-gold">${fracao13} do sal&aacute;rio mensal</div>
        </div>
      </div>
      <div class="avos-formula">
        F&oacute;rmula: sal&aacute;rio &divide; 12 &times; ${avos13} = <strong>${fracao13} do sal&aacute;rio bruto</strong>
      </div>
    </div>`;

  // Legenda Art. 130
  html += `
    <div class="result-note" style="margin-top:1.5rem">
      <p><strong style="color:var(--gold)">Tabela Art. 130 CLT — Faltas injustificadas:</strong><br>
      0–5 faltas: 30 dias &bull; 6–14 faltas: 24 dias &bull; 15–23 faltas: 18 dias &bull; 24–32 faltas: 12 dias &bull; 33+ faltas: 0 dias (perda total)</p>
    </div>`;

  if (temHipotese133) {
    html += `
      <div class="result-note" style="margin-top:0.75rem;border-color:#f87171;background:rgba(248,113,113,0.06)">
        <p style="color:rgba(255,255,255,0.8)"><strong style="color:#fca5a5">&#9888; Art. 133 CLT aplicado:</strong> As hip&oacute;teses marcadas interrompem o per&iacute;odo aquisitivo, implicando perda do direito &agrave;s f&eacute;rias referentes ao per&iacute;odo em que ocorreram. O ciclo recome&ccedil;a a partir do retorno.</p>
      </div>`;
  }

  html += `
    <div class="result-note" style="margin-top:0.75rem">
      <p>&#9432;&nbsp; M&ecirc;s conta como avo quando o empregado trabalhou mais de 14 dias naquele m&ecirc;s (Art. 142, &sect;2&ordm;, CLT). Esta calculadora &eacute; meramente informativa; consulte um advogado para casos espec&iacute;ficos.</p>
    </div>`;

  html += '</div>';

  resultEl.innerHTML = html;
  resultEl.classList.add('visible');
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function toggleSaidaHoje() {
  const cb = document.getElementById('avos-ainda-contratado');
  const saidaEl = document.getElementById('avos-saida');
  if (!cb || !saidaEl) return;
  if (cb.checked) {
    const hoje = new Date();
    const yyyy = hoje.getFullYear();
    const mm   = String(hoje.getMonth() + 1).padStart(2, '0');
    const dd   = String(hoje.getDate()).padStart(2, '0');
    saidaEl.value = `${yyyy}-${mm}-${dd}`;
    saidaEl.disabled = true;
  } else {
    saidaEl.disabled = false;
  }
}

/* ──────────────────────────────────────────────────────────
   BIND DE EVENTOS
   ────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', function () {
  const btnPrescricao = document.getElementById('btn-calcular-prescricao');
  if (btnPrescricao) btnPrescricao.addEventListener('click', calcPrescricao);

  const btnAviso = document.getElementById('btn-calcular-aviso');
  if (btnAviso) btnAviso.addEventListener('click', calcAvisoPrevio);

  // Também dispara ao pressionar Enter nos campos
  ['data-prescricao'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') calcPrescricao(); });
  });

  ['data-admissao', 'data-dispensa'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') calcAvisoPrevio(); });
  });

  // Ferramenta remover espaços — contador em tempo real
  const espacosInput = document.getElementById('espacos-input');
  if (espacosInput) {
    espacosInput.addEventListener('input', atualizarContadorEspacos);
    espacosInput.addEventListener('paste', () => setTimeout(atualizarContadorEspacos, 0));
  }

  // Avos — checkbox "ainda contratado"
  const cbContratado = document.getElementById('avos-ainda-contratado');
  if (cbContratado) cbContratado.addEventListener('change', toggleSaidaHoje);
});
