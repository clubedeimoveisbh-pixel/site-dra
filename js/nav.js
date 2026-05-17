/**
 * nav.js — Injeta header e footer em todas as páginas,
 * gerencia scroll, hamburger e estado ativo do menu.
 */

(function () {
  const NAV_HTML = `
<nav id="site-nav">
  <div class="nav-inner">
    <a href="/index.html" class="nav-logo">
      <span class="nav-logo-name">Dra. Ana Paula Oliveira</span>
      <span class="nav-logo-subtitle">Direito do Trabalho &amp; IA</span>
    </a>
    <div class="nav-links">
      <a href="/quem-sou-eu.html">Quem Sou Eu</a>
      <a href="/publicacoes.html">Publicações</a>
      <a href="/artigos.html">Artigos</a>
      <a href="/ferramentas.html">Ferramentas</a>
      <a href="/modelos.html">Modelos Gratuitos</a>
      <a href="/cursos.html">Cursos</a>
    </div>
    <div class="nav-cta">
      <a href="/ferramentas.html">Ferramentas Grátis</a>
    </div>
    <button class="nav-hamburger" id="hamburger" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
  </div>
  <nav class="nav-mobile" id="nav-mobile">
    <a href="/quem-sou-eu.html">Quem Sou Eu</a>
    <a href="/publicacoes.html">Publicações</a>
    <a href="/artigos.html">Artigos</a>
    <a href="/ferramentas.html">Ferramentas</a>
    <a href="/modelos.html">Modelos Gratuitos</a>
    <a href="/cursos.html">Cursos</a>
    <a href="/ferramentas.html" class="mobile-cta">Ferramentas Grátis</a>
  </nav>
</nav>`;

  const FOOTER_HTML = `
<footer id="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="footer-logo-name">Dra. Ana Paula Oliveira</div>
        <div class="footer-logo-sub">Direito do Trabalho &amp; IA</div>
        <p class="footer-desc">
          Servidora pública, assistente de juiz do trabalho e criadora de conteúdo
          sobre direito do trabalho e inteligência artificial aplicada ao direito.
        </p>
        <div class="footer-socials">
          <a href="#" class="social-btn" aria-label="Instagram">&#x1F4F7;</a>
          <a href="#" class="social-btn" aria-label="LinkedIn">&#x1F4BC;</a>
          <a href="#" class="social-btn" aria-label="YouTube">&#x25B6;</a>
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
          <a href="/ferramentas.html#prescricao">Calc. Prescrição</a>
          <a href="/ferramentas.html#aviso-previo">Calc. Aviso Prévio</a>
        </div>
      </div>
      <div>
        <div class="footer-col-title">Contato</div>
        <div class="footer-links">
          <a href="#">Instagram</a>
          <a href="#">LinkedIn</a>
          <a href="#">YouTube</a>
          <a href="mailto:contato@exemplo.com.br">E-mail</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <p class="footer-copy">
        &copy; 2025 <span>Dra. Ana Paula Oliveira</span>. Todos os direitos reservados.
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
    nav.querySelectorAll('.nav-links a, .nav-mobile a').forEach(a => {
      const href = a.getAttribute('href').split('/').pop();
      if (href === path || (path === '' && href === 'index.html')) {
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
