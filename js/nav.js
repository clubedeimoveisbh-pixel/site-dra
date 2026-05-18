/**
 * nav.js — Injeta header e footer em todas as páginas,
 * gerencia scroll, hamburger e estado ativo do menu.
 */

(function () {
  const NAV_HTML = `
<nav id="site-nav">
  <div class="nav-inner">
    <a href="/index.html" class="nav-logo">
      <span class="nav-logo-name">Marina Trabalhista</span>
      <span class="nav-logo-subtitle">Direito do Trabalho</span>
    </a>
    <div class="nav-links">
      <a href="/quem-sou-eu.html">Quem Sou Eu</a>
      <a href="/publicacoes.html">Publicações</a>
      <a href="/artigos.html">Artigos</a>
      <div class="nav-dropdown">
        <a href="/ferramentas.html" class="nav-dropdown-toggle">Ferramentas ▾</a>
        <div class="nav-dropdown-menu">
          <a href="/ferramentas/prescricao.html">⏱ Calculadora de Prescrição</a>
          <a href="/ferramentas/aviso-previo.html">📅 Calculadora de Aviso Prévio</a>
          <a href="/ferramentas/avos.html">📊 Calculadora de Avos</a>
          <a href="/ferramentas/reflexos.html">⚖️ Tabela de Reflexos</a>
          <a href="/ferramentas/remover-espacos.html">✂️ Remover Espaços</a>
        </div>
      </div>
      <a href="/modelos.html">Modelos Gratuitos</a>
      <a href="/cursos.html">Cursos</a>
    </div>
    <button class="nav-hamburger" id="hamburger" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
  </div>
  <nav class="nav-mobile" id="nav-mobile">
    <a href="/quem-sou-eu.html">Quem Sou Eu</a>
    <a href="/publicacoes.html">Publicações</a>
    <a href="/artigos.html">Artigos</a>
    <a href="/ferramentas.html" style="font-weight:700">Ferramentas</a>
    <a href="/ferramentas/prescricao.html" style="padding-left:1.5rem;font-size:0.85rem;opacity:0.85">⏱ Prescrição</a>
    <a href="/ferramentas/aviso-previo.html" style="padding-left:1.5rem;font-size:0.85rem;opacity:0.85">📅 Aviso Prévio</a>
    <a href="/ferramentas/avos.html" style="padding-left:1.5rem;font-size:0.85rem;opacity:0.85">📊 Avos</a>
    <a href="/ferramentas/reflexos.html" style="padding-left:1.5rem;font-size:0.85rem;opacity:0.85">⚖️ Reflexos</a>
    <a href="/ferramentas/remover-espacos.html" style="padding-left:1.5rem;font-size:0.85rem;opacity:0.85">✂️ Remover Espaços</a>
    <a href="/modelos.html">Modelos Gratuitos</a>
    <a href="/cursos.html">Cursos</a>
  </nav>
</nav>`;

  const FOOTER_HTML = `
<footer id="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="footer-logo-name">Marina Trabalhista</div>
        <div class="footer-logo-sub">Direito do Trabalho</div>
        <p class="footer-desc">
          Analista Judiciária do TRT da 3ª Região e assistente de juiz do trabalho.
          Conteúdo prático sobre processo do trabalho para advogados e operadores do direito.
        </p>
        <div class="footer-socials">
          <a href="https://www.instagram.com/marinatrabalhista" target="_blank" rel="noopener" class="social-btn" aria-label="Instagram @marinatrabalhista">📷 @marinatrabalhista</a>
        </div>
      </div>
      <div>
        <div class="footer-col-title">Navegação</div>
        <div class="footer-links">
          <a href="/quem-sou-eu.html">Quem Sou Eu</a>
          <a href="/publicacoes.html">Publicações</a>
          <a href="/artigos.html">Artigos</a>
          <a href="/ferramentas.html">Ferramentas</a>
        </div>
      </div>
      <div>
        <div class="footer-col-title">Recursos</div>
        <div class="footer-links">
          <a href="/modelos.html">Modelos Gratuitos</a>
          <a href="/cursos.html">Cursos</a>
          <a href="/ferramentas/prescricao.html">Calc. Prescrição</a>
          <a href="/ferramentas/aviso-previo.html">Calc. Aviso Prévio</a>
        </div>
      </div>
      <div>
        <div class="footer-col-title">Siga no Instagram</div>
        <div class="footer-links">
          <a href="https://www.instagram.com/marinatrabalhista" target="_blank" rel="noopener">📷 @marinatrabalhista</a>
        </div>
        <p style="font-size:0.75rem;color:rgba(232,230,224,0.45);margin-top:0.75rem;line-height:1.5">
          Conteúdo gratuito sobre<br>direito material e processual do trabalho
        </p>
      </div>
    </div>
    <div class="footer-bottom">
      <p class="footer-copy">
        &copy; 2025 <span>Marina Trabalhista</span>. Todos os direitos reservados.
      </p>
      <div class="footer-legal">
        <a href="#">Política de Privacidade</a>
        <a href="#">Termos de Uso</a>
      </div>
    </div>
  </div>
</footer>`;

  function injectNav() {
    const placeholder = document.getElementById('nav-placeholder');
    if (placeholder) placeholder.outerHTML = NAV_HTML;
    else document.body.insertAdjacentHTML('afterbegin', NAV_HTML);
  }

  function injectFooter() {
    const placeholder = document.getElementById('footer-placeholder');
    if (placeholder) placeholder.outerHTML = FOOTER_HTML;
    else document.body.insertAdjacentHTML('beforeend', FOOTER_HTML);
  }

  function initNav() {
    // Scroll behaviour
    const nav = document.getElementById('site-nav');
    if (!nav) return;

    function handleScroll() {
      nav.classList.toggle('scrolled', window.scrollY > 30);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    // Active link
    const path = window.location.pathname.split('/').pop() || 'index.html';
    const fullPath = window.location.pathname;
    nav.querySelectorAll('.nav-links a, .nav-mobile a').forEach(a => {
      const href = a.getAttribute('href').split('/').pop();
      const hrefFull = a.getAttribute('href');
      // Mark ferramentas.html active when on any ferramentas/* subpage
      if (fullPath.includes('/ferramentas') && hrefFull.includes('ferramentas.html')) {
        a.classList.add('active');
      } else if (href === path || (path === '' && href === 'index.html')) {
        a.classList.add('active');
      }
    });

    // Hamburger
    const burger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('nav-mobile');
    if (burger && mobileMenu) {
      burger.addEventListener('click', () => {
        burger.classList.toggle('open');
        mobileMenu.classList.toggle('open');
      });
      // Close on link click
      mobileMenu.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
          burger.classList.remove('open');
          mobileMenu.classList.remove('open');
        });
      });
    }
  }

  function initFadeUp() {
    const els = document.querySelectorAll('.fade-up');
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach(el => io.observe(el));
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectNav();
    injectFooter();
    initNav();
    initFadeUp();
  });
})();
