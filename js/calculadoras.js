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
 * A Lei 14.010/2020 suspendeu os prazos prescricionais
 * de 12/06/2020 a 30/10/2020 = 141 dias.
 * Ao calcular a prescrição, subtrai-se 141 dias do prazo.
 *
 * Entrada: data da lesão / rescisão / fato gerador
 * Saída: data até a qual o trabalhador tem para ajuizar
 *        (prazo de 2 anos + 141 dias de suspensão)
 */

const SUSPENSAO_INICIO = new Date(2020, 5, 12); // 12/06/2020
const SUSPENSAO_FIM    = new Date(2020, 9, 30); // 30/10/2020
const DIAS_SUSPENSAO   = 141;

function calcPrescricao() {
  const inputEl = document.getElementById('data-prescricao');
  const resultEl = document.getElementById('result-prescricao');

  if (!inputEl || !resultEl) return;
  const val = inputEl.value;
  if (!val) { alert('Por favor, informe a data do fato gerador.'); return; }

  const dataFato = parseLocalDate(val);
  // Prazo ordinário: 2 anos após rescisão/fato
  const prazoOrdinario = addDays(dataFato, 2 * 365);

  // Verifica se o período de suspensão se sobrepõe ao prazo
  let diasAcrescidos = 0;
  if (dataFato <= SUSPENSAO_FIM) {
    // O período de suspensão afeta este prazo
    const inicioSuspensao = dataFato > SUSPENSAO_INICIO ? dataFato : SUSPENSAO_INICIO;
    const fimSuspensao    = SUSPENSAO_FIM;
    const ms = Math.max(0, fimSuspensao - inicioSuspensao);
    diasAcrescidos = Math.min(DIAS_SUSPENSAO, Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1);
  }

  const dataLimite = addDays(prazoOrdinario, diasAcrescidos);

  // Contagem regressiva
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  const diasRestantes = Math.ceil((dataLimite - hoje) / (1000*60*60*24));
  const vencido = diasRestantes < 0;

  resultEl.innerHTML = `
    <div class="result-label">Data-limite para ajuizamento</div>
    <div class="result-value">${formatDate(dataLimite)}</div>
    <div class="result-detail" style="margin-top:1.25rem">
      <div class="result-detail-item">
        <div class="rd-label">Data do fato</div>
        <div class="rd-value">${formatDateShort(dataFato)}</div>
      </div>
      <div class="result-detail-item">
        <div class="rd-label">Prazo ordinário (2 anos)</div>
        <div class="rd-value">${formatDateShort(prazoOrdinario)}</div>
      </div>
      <div class="result-detail-item">
        <div class="rd-label">Dias suspensos acrescidos</div>
        <div class="rd-value">${diasAcrescidos} dias</div>
      </div>
      <div class="result-detail-item">
        <div class="rd-label">${vencido ? 'Prazo expirado há' : 'Dias restantes'}</div>
        <div class="rd-value" style="color:${vencido ? '#f87171' : '#4ade80'}">${Math.abs(diasRestantes)} dias</div>
      </div>
    </div>
    ${diasAcrescidos > 0 ? `
    <div class="result-note" style="margin-top:1.25rem">
      <p>
        <strong style="color:var(--gold)">&#9432; Suspensão aplicada:</strong>
        Durante a pandemia, a Lei 14.010/2020 suspendeu os prazos prescricionais
        de 12/06/2020 a 30/10/2020 (<strong>${diasAcrescidos} dias</strong>).
        Esse período foi acrescido ao prazo ordinário de 2 anos.
      </p>
    </div>` : `
    <div class="result-note" style="margin-top:1.25rem">
      <p>
        A data do fato gerador é posterior ao período de suspensão (12/06 – 30/10/2020),
        portanto o prazo ordinário de 2 anos se aplica integralmente.
      </p>
    </div>`}
    ${vencido ? `
    <div class="result-note" style="margin-top:0.75rem;border-color:#f87171;background:rgba(248,113,113,0.08)">
      <p style="color:#fca5a5">
        <strong>&#9888; Atenção:</strong> O prazo já se encontra <strong>expirado</strong>.
        Consulte um advogado para verificar a possibilidade de alegação de causas interruptivas.
      </p>
    </div>` : ''}
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
});
