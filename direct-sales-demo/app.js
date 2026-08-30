document.addEventListener('DOMContentLoaded', () => {
  const supabaseClient =
    window.supabase &&
    window.SUPABASE_URL &&
    window.SUPABASE_PUBLISHABLE_KEY
      ? window.supabase.createClient(
          window.SUPABASE_URL,
          window.SUPABASE_PUBLISHABLE_KEY,
          {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
            },
          },
        )
      : null;

  if (!supabaseClient) {
    console.error('Supabase client could not be initialized.');
  }

  const screenAuth = document.getElementById('screen-auth');
  const screenMain = document.getElementById('screen-main');
  const logoutBtn = document.getElementById('btn-logout');

  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const referralInput = document.getElementById('auth-referral');
  const loginBtn = document.getElementById('btn-login');

  // Small UI additions are injected here so index.html can stay unchanged.
  ensureHomeShell();
  ensureBirthdayField();
  ensureGenderField();
  ensureCartShell();
  organizeWithdrawalUi();

  const tabButtons = document.querySelectorAll('.tab-bar .tab');
  const tabPanels = document.querySelectorAll('.tab-panel');

  const productList = document.getElementById('product-list');

  const bookingDateInput = document.getElementById('booking-date');
  const bookingSlotSelect = document.getElementById('booking-slot');
  const bookingBtn = document.getElementById('btn-booking');
  const bookingMessage = document.getElementById('booking-message');
  const aiChatInput = document.getElementById('ai-chat-input');
  const aiChatMessages = document.getElementById('ai-chat-messages');
  const btnAiSend = document.getElementById('btn-ai-send');

  const STORAGE_KEY_USER = 'huiwen_demo_user';
  const STORAGE_KEY_USERS = 'huiwen_demo_users';
  const STORAGE_KEY_BOOKINGS = 'huiwen_demo_bookings';
  const STORAGE_KEY_ANNOUNCEMENT = 'huiwen_demo_announcement';
  const STORAGE_KEY_PRODUCTS = 'huiwen_demo_products';
  const STORAGE_KEY_ORDERS = 'huiwen_demo_orders';
  const STORAGE_KEY_COMMISSIONS = 'huiwen_supabase_commissions';
  const STORAGE_KEY_CART = 'huiwen_supabase_cart';
  const STORAGE_KEY_WITHDRAWALS = 'huiwen_demo_withdrawals';
  const STORAGE_KEY_AI_FAQ = 'huiwen_demo_ai_faq';
  const STORAGE_KEY_AI_CHAT = 'huiwen_demo_ai_chat';
  const STORAGE_KEY_CONSULT_SESSION = 'huiwen_demo_consult_session';
  const STORAGE_KEY_POINTS_MIGRATION = 'huiwen_demo_points_migration_v1';

  const COMMISSION_RATES = [0.2, 0.15, 0.1, 0.05, 0.03]; // 1~5 级
  const CONSULT_MAX_MINUTES = 30; // 所有真人咨询固定 30 分钟
  const POINTS_PER_REGISTRATION = 10; // 仅直推注册：直接上级 +10 缘
  const POINTS_PER_DIRECT_PURCHASE = 20; // 仅直推购买：直接上级每单固定 +20 缘
  const WITHDRAW_THRESHOLD = 0.05; // TESTING. Change to 200 for production.
  // 发货服务地址：如配置可用于邮件服务；客户订单页不提供专属符下载。
  const DELIVERY_API_URL = '';

  const defaultProducts = [
    { id: 'p1', name: '静心山水 · 电子图片', price: 19, stock: 99, desc: '柔和山水意境，适合做手机壁纸、冥想背景图。' },
    { id: 'p2', name: '东方禅意 · 电子图片', price: 29, stock: 99, desc: '极简线条与留白，适合做网络头像、社交封面。' },
    { id: 'p3', name: '城市夜景 · 电子图片', price: 39, stock: 99, desc: '高对比夜色光影，适合作为电脑桌面或宣传素材。' },
  ];


  let homeAnnouncementsCache = [];

  function escapeHomeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function ensureHomeShell() {
    // Keep only the main brand title in the header.
    const subtitleEl = document.querySelector('.app-subtitle');
    if (subtitleEl) subtitleEl.remove();
    const logoutEl = document.getElementById('btn-logout');
    if (logoutEl) logoutEl.innerHTML = '退<br>出';

    const tabBar = document.querySelector('.tab-bar');
    const productsTab = tabBar?.querySelector('[data-tab="products"]');
    const productsPanel = document.getElementById('tab-products');
    if (!tabBar || !productsTab || !productsPanel) return;

    let homeTab = tabBar.querySelector('[data-tab="home"]');
    if (!homeTab) {
      homeTab = document.createElement('button');
      homeTab.type = 'button';
      homeTab.dataset.tab = 'home';
      homeTab.className = 'tab tab--active';
      homeTab.textContent = '首页';
      productsTab.insertAdjacentElement('beforebegin', homeTab);
    }

    let homePanel = document.getElementById('tab-home');
    if (!homePanel) {
      homePanel = document.createElement('section');
      homePanel.id = 'tab-home';
      homePanel.className = 'tab-panel tab-panel--active';
      homePanel.innerHTML = `
        <div class="home-announcements-shell">
          ${[
            { category: 'category1', title: '最新公告' },
            { category: 'category2', title: '社区掠影' },
          ].map(({ category, title }) => `
            <section class="home-announcement-section" data-category="${category}">
              <div class="home-announcement-heading">
                <h2>${title}</h2>
                <div class="home-announcement-arrows" aria-label="${title} navigation">
                  <button type="button" class="home-row-arrow" data-direction="left" aria-label="向左">‹</button>
                  <button type="button" class="home-row-arrow" data-direction="right" aria-label="向右">›</button>
                </div>
              </div>
              <div class="home-announcement-row" data-announcement-row="${category}">
                <div class="home-announcement-empty">正在载入...</div>
              </div>
            </section>
          `).join('')}
        </div>
      `;
      productsPanel.insertAdjacentElement('beforebegin', homePanel);

      homePanel.addEventListener('click', (event) => {
        const arrow = event.target.closest('.home-row-arrow');
        if (!arrow) return;
        const section = arrow.closest('.home-announcement-section');
        const row = section?.querySelector('.home-announcement-row');
        if (!row) return;
        const amount = Math.max(280, row.clientWidth * 0.8);
        row.scrollBy({
          left: arrow.dataset.direction === 'left' ? -amount : amount,
          behavior: 'smooth',
        });
      });
    }

    productsTab.classList.remove('tab--active');
    homeTab.classList.add('tab--active');
    productsPanel.classList.remove('tab-panel--active');
    homePanel.classList.add('tab-panel--active');

    if (!document.getElementById('huiwen-home-announcement-styles')) {
      const style = document.createElement('style');
      style.id = 'huiwen-home-announcement-styles';
      style.textContent = `
        .home-announcements-shell{display:grid;gap:2rem;padding:.15rem 0 1.5rem}
        .home-announcement-section{min-width:0}
        .home-announcement-heading{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:0 0 .8rem;padding-bottom:.65rem;border-bottom:1px solid rgba(224,177,78,.18)}
        .home-announcement-heading h2{margin:0;color:#f0e6cf;font-size:1.18rem;letter-spacing:.01em}
        .home-announcement-heading h2::before{content:'•';color:#e0b14e;margin-right:.55rem}
        .home-announcement-arrows{display:flex;gap:.45rem}
        .home-row-arrow{width:2.1rem;height:2.1rem;border-radius:999px;border:1px solid rgba(224,177,78,.45);background:rgba(224,177,78,.06);color:#e7bd62;font-size:1.35rem;line-height:1;cursor:pointer}
        .home-row-arrow:hover{background:rgba(224,177,78,.14)}
        .home-announcement-row{display:flex;align-items:flex-start;gap:1rem;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x proximity;scrollbar-width:thin;scrollbar-color:rgba(224,177,78,.55) rgba(255,255,255,.04);padding:.1rem 0 .7rem}
        .home-announcement-card{position:relative;border-radius:20px;overflow:hidden;border:1px solid rgba(224,177,78,.22);background:#0a0a0d;scroll-snap-align:start;box-shadow:0 14px 35px rgba(0,0,0,.2);text-decoration:none}
        [data-announcement-row="category1"] .home-announcement-card{flex:0 0 320px;aspect-ratio:16/9}
        [data-announcement-row="category2"] .home-announcement-card{flex:0 0 180px;aspect-ratio:9/16}
        .home-announcement-card img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .25s ease,filter .25s ease}
        .home-announcement-card:hover img{transform:scale(1.025);filter:brightness(1.04)}
        .home-announcement-card::after{content:'';position:absolute;inset:auto 0 0;height:22%;background:linear-gradient(transparent,rgba(0,0,0,.28));pointer-events:none}
        .home-announcement-empty{min-height:120px;display:flex;align-items:center;color:var(--text-muted,#9aa3b5);font-size:.92rem}

        /* Keep brand title and all front-end menu items on one line. */
        .app-header{justify-content:flex-start!important;gap:clamp(5px,1vw,11px);padding:clamp(10px,2vw,14px) clamp(10px,2vw,18px)}
        .app-header-left{min-width:0;flex:0 1 36%;max-width:36%;gap:clamp(5px,1vw,10px)}
        .logo-mark{width:clamp(24px,6vw,38px);height:clamp(24px,6vw,38px);flex:0 0 auto}
        .header-text{min-width:0}
        .app-title{font-size:clamp(.62rem,2vw,1rem)!important;letter-spacing:.02em!important;white-space:nowrap!important}
        .app-subtitle{font-size:clamp(.50rem,1.45vw,.76rem)!important;white-space:normal!important;line-height:1.35;overflow:visible;text-overflow:clip}
        .header-current-user{font-size:clamp(.46rem,1.25vw,.72rem)!important;padding:5px clamp(6px,1vw,10px)!important;max-width:none!important;overflow:visible!important;text-overflow:clip!important;white-space:normal!important;flex:1 1 auto;min-width:0;display:flex!important;flex-direction:column;align-items:flex-start;justify-content:center;gap:1px;line-height:1.3;margin-left:-2px}
        .header-current-user .header-user-line{display:block;white-space:nowrap;max-width:100%}
        .header-logout{font-size:clamp(.48rem,1.2vw,.72rem)!important;padding:5px clamp(5px,1vw,8px)!important;flex:0 0 auto;line-height:1.15!important;text-align:center;white-space:normal!important;min-width:32px;margin-left:auto}

        .tab-bar{display:flex!important;grid-template-columns:none!important;flex-wrap:nowrap!important;gap:clamp(1px,.35vw,4px)!important;padding:3px!important;overflow:hidden}
        .tab-bar .tab{flex:.8 1 0;min-width:0;white-space:nowrap!important;font-size:clamp(.42rem,1.6vw,.76rem)!important;padding:6px 1px!important;letter-spacing:-.03em}
        .tab-bar .tab[data-tab="cart"]{flex:1 1 0}
        .tab-bar .tab[data-tab="wallet"]{flex:1.55 1 0}
        .tab-bar .tab[data-tab="support"]{flex:1.15 1 0}

        @media (max-width:700px){
          .app-header-left{flex-basis:32%;max-width:32%}
          .app-title{font-size:clamp(.56rem,2.7vw,.78rem)!important}
          .app-subtitle{font-size:clamp(.44rem,2vw,.62rem)!important}
          .header-current-user{font-size:clamp(.39rem,1.8vw,.56rem)!important;padding:4px 5px!important;gap:0;margin-left:-1px}
          .header-logout{font-size:clamp(.43rem,1.9vw,.58rem)!important;padding:4px 5px!important;min-width:28px}
          .home-announcements-shell{gap:1.55rem}
          [data-announcement-row="category1"] .home-announcement-card{flex-basis:clamp(220px,68vw,300px);border-radius:16px}
          [data-announcement-row="category2"] .home-announcement-card{flex-basis:clamp(130px,38vw,165px);border-radius:16px}
          .home-announcement-arrows{display:none}
          .home-announcement-heading h2{font-size:1.05rem}
        }
      `;
      document.head.appendChild(style);
    }
  }

  function activateHomeTab() {
    const homeTab = document.querySelector('.tab-bar [data-tab="home"]');
    const homePanel = document.getElementById('tab-home');
    if (!homeTab || !homePanel) return;

    document.querySelectorAll('.tab-bar .tab').forEach((button) => {
      button.classList.toggle('tab--active', button === homeTab);
    });
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.classList.toggle('tab-panel--active', panel === homePanel);
    });
  }

  function renderHomeAnnouncements() {
    const categories = ['category1','category2'];
    categories.forEach((category) => {
      const row = document.querySelector(`[data-announcement-row="${category}"]`);
      if (!row) return;
      const items = homeAnnouncementsCache.filter((item) => item.category === category && item.image_url);
      if (!items.length) {
        row.innerHTML = '<div class="home-announcement-empty">暂无公告</div>';
        return;
      }
      const detailPage = category === 'category2'
        ? '/announcement-9x16.html'
        : '/announcement-16x9.html';
      row.innerHTML = items.map((item) => `
        <a class="home-announcement-card" href="${detailPage}?id=${encodeURIComponent(item.id)}" aria-label="查看公告">
          <img src="${escapeHomeHtml(item.image_url)}" alt="公告图片" loading="lazy" />
        </a>
      `).join('');
    });
  }

  async function syncHomeAnnouncements() {
    if (!supabaseClient) {
      homeAnnouncementsCache = [];
      renderHomeAnnouncements();
      return [];
    }
    const { data, error } = await supabaseClient.rpc('get_published_announcements');
    if (error) throw error;
    homeAnnouncementsCache = Array.isArray(data) ? data : [];
    renderHomeAnnouncements();
    return homeAnnouncementsCache;
  }

  function getBusinessTodayParts() {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Vancouver',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());

      const map = {};
      parts.forEach((part) => {
        if (part.type !== 'literal') map[part.type] = part.value;
      });

      return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day),
      };
    } catch {
      const now = new Date();
      return {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
      };
    }
  }

  function birthdayDaysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function syncBirthdayValue() {
    const hidden = document.getElementById('purchase-buyer-dob');
    const yearInput = document.getElementById('purchase-buyer-year');
    const monthSelect = document.getElementById('purchase-buyer-month');
    const daySelect = document.getElementById('purchase-buyer-day');

    if (!hidden || !yearInput || !monthSelect || !daySelect) return;

    const yearText = yearInput.value.trim();
    const year = Number(yearText);
    const month = Number(monthSelect.value);
    const day = Number(daySelect.value);
    const today = getBusinessTodayParts();

    hidden.value = '';

    if (!/^\d{4}$/.test(yearText)) return;
    if (year < 1000 || year > today.year) return;
    if (!month || !day) return;

    const maxDay = birthdayDaysInMonth(year, month);
    if (day < 1 || day > maxDay) return;

    if (
      year === today.year &&
      (month > today.month || (month === today.month && day > today.day))
    ) {
      return;
    }

    hidden.value =
      String(year).padStart(4, '0') +
      '-' +
      String(month).padStart(2, '0') +
      '-' +
      String(day).padStart(2, '0');
  }

  function updateBirthdayChoices() {
    const yearInput = document.getElementById('purchase-buyer-year');
    const monthSelect = document.getElementById('purchase-buyer-month');
    const daySelect = document.getElementById('purchase-buyer-day');

    if (!yearInput || !monthSelect || !daySelect) return;

    const today = getBusinessTodayParts();
    const yearText = yearInput.value.trim();
    const year = /^\d{4}$/.test(yearText) ? Number(yearText) : null;

    Array.from(monthSelect.options).forEach((option) => {
      if (!option.value) return;
      const month = Number(option.value);
      option.disabled =
        year !== null &&
        (year > today.year ||
          (year === today.year && month > today.month));
    });

    if (
      monthSelect.value &&
      monthSelect.selectedOptions[0] &&
      monthSelect.selectedOptions[0].disabled
    ) {
      monthSelect.value = '';
    }

    const previousDay = Number(daySelect.value);
    daySelect.innerHTML = '<option value="">日</option>';

    const month = Number(monthSelect.value);
    if (year !== null && year >= 1000 && year <= today.year && month) {
      let maxDay = birthdayDaysInMonth(year, month);

      if (year === today.year && month === today.month) {
        maxDay = Math.min(maxDay, today.day);
      }

      for (let day = 1; day <= maxDay; day += 1) {
        const option = document.createElement('option');
        option.value = String(day).padStart(2, '0');
        option.textContent = String(day).padStart(2, '0') + ' 日';
        daySelect.appendChild(option);
      }

      if (previousDay >= 1 && previousDay <= maxDay) {
        daySelect.value = String(previousDay).padStart(2, '0');
      }
    }

    syncBirthdayValue();
  }

  function resetBirthdayFields() {
    const hidden = document.getElementById('purchase-buyer-dob');
    const yearInput = document.getElementById('purchase-buyer-year');
    const monthSelect = document.getElementById('purchase-buyer-month');
    const daySelect = document.getElementById('purchase-buyer-day');

    if (hidden) hidden.value = '';
    if (yearInput) yearInput.value = '';
    if (monthSelect) monthSelect.value = '';
    if (daySelect) {
      daySelect.innerHTML = '<option value="">日</option>';
      daySelect.value = '';
    }

    updateBirthdayChoices();
  }

  function ensureBirthdayField() {
    const original = document.getElementById('purchase-buyer-dob');
    if (!original || document.getElementById('purchase-buyer-year')) return;

    const field = original.closest('.field');
    if (!field) return;

    original.type = 'hidden';
    original.removeAttribute('placeholder');
    original.removeAttribute('min');
    original.removeAttribute('max');

    const controls = document.createElement('div');
    controls.className = 'birthday-select-row';
    controls.innerHTML = `
      <input
        id="purchase-buyer-year"
        class="field-input birthday-year-input"
        type="text"
        inputmode="numeric"
        autocomplete="bday-year"
        maxlength="4"
        placeholder="YYYY"
        aria-label="出生年份"
      />
      <select
        id="purchase-buyer-month"
        class="field-input"
        autocomplete="bday-month"
        aria-label="出生月份"
      >
        <option value="">月</option>
        ${Array.from({ length: 12 }, (_, index) => {
          const month = String(index + 1).padStart(2, '0');
          return `<option value="${month}">${month} 月</option>`;
        }).join('')}
      </select>
      <select
        id="purchase-buyer-day"
        class="field-input"
        autocomplete="bday-day"
        aria-label="出生日期"
      >
        <option value="">日</option>
      </select>
    `;

    original.insertAdjacentElement('afterend', controls);

    if (!document.getElementById('huiwen-birthday-styles')) {
      const style = document.createElement('style');
      style.id = 'huiwen-birthday-styles';
      style.textContent = `
        .birthday-select-row{
          display:grid;
          grid-template-columns:1.15fr 1fr 1fr;
          gap:8px;
          width:100%;
        }
        .birthday-select-row .field-input{
          min-width:0;
          width:100%;
        }
      `;
      document.head.appendChild(style);
    }

    const yearInput = document.getElementById('purchase-buyer-year');
    const monthSelect = document.getElementById('purchase-buyer-month');
    const daySelect = document.getElementById('purchase-buyer-day');

    yearInput.addEventListener('input', () => {
      yearInput.value = yearInput.value.replace(/\D/g, '').slice(0, 4);
      updateBirthdayChoices();
    });

    yearInput.addEventListener('blur', () => {
      const today = getBusinessTodayParts();
      const value = yearInput.value.trim();

      if (value && !/^\d{4}$/.test(value)) {
        alert('出生年份必须是 4 位数字。');
        yearInput.focus();
        return;
      }

      if (/^\d{4}$/.test(value) && Number(value) > today.year) {
        alert('出生年份不能晚于当前年份。');
        yearInput.value = '';
        updateBirthdayChoices();
      }
    });

    monthSelect.addEventListener('change', updateBirthdayChoices);
    daySelect.addEventListener('change', syncBirthdayValue);

    updateBirthdayChoices();
  }

  function ensureGenderField() {
    if (document.getElementById('purchase-buyer-gender')) return;

    const actions = document.querySelector('#purchase-modal .purchase-modal-actions');
    if (!actions || !actions.parentNode) return;

    const field = document.createElement('label');
    field.className = 'field';
    field.innerHTML = `
      <span class="field-label">性别</span>
      <select id="purchase-buyer-gender" class="field-input">
        <option value="">请选择</option>
        <option value="男">男</option>
        <option value="女">女</option>
      </select>
    `;
    actions.parentNode.insertBefore(field, actions);
  }

  function organizeWithdrawalUi() {
    const modal = document.getElementById('withdraw-modal');
    const withdrawTip = document.getElementById('withdraw-tip');
    if (!modal || !withdrawTip) return;

    // Keep the testing/production minimum line compact on the Wallet page.
    withdrawTip.textContent = '测试期间最低 ￥0.05；正式最低 ￥200。';

    // These two paragraphs already exist in index.html. Move the actual DOM nodes
    // instead of recreating their text so traditional.js / english.js can keep
    // translating the same structural text without any index.html change.
    const paragraphs = Array.from(modal.querySelectorAll('p.wallet-subtext'));
    const frequencyNote = paragraphs.find((el) =>
      String(el.textContent || '').includes('每 3 天最多申请一次提现')
    );
    const paypalNote = paragraphs.find((el) =>
      String(el.textContent || '').includes('必须拥有 PayPal 账户才能申请提现')
    );

    let insertAfter = withdrawTip;

    for (const note of [frequencyNote, paypalNote]) {
      if (!note) continue;

      note.style.lineHeight = '1.55';
      note.style.marginTop = '8px';
      note.dataset.withdrawWalletNote = '1';

      insertAfter.insertAdjacentElement('afterend', note);
      insertAfter = note;
    }
  }

  function ensureCartShell() {
    const tabBar = document.querySelector('.tab-bar');
    const productsTab = tabBar?.querySelector('[data-tab="products"]');
    const productsPanel = document.getElementById('tab-products');
    if (!tabBar || !productsTab || !productsPanel) return;

    if (!document.querySelector('[data-tab="cart"]')) {
      const cartTab = document.createElement('button');
      cartTab.type = 'button';
      cartTab.dataset.tab = 'cart';
      cartTab.className = 'tab';
      cartTab.innerHTML = `购物车 <span id="cart-tab-count" class="cart-tab-count">0</span>`;
      productsTab.insertAdjacentElement('afterend', cartTab);
    }

    if (!document.getElementById('tab-cart')) {
      const cartPanel = document.createElement('section');
      cartPanel.id = 'tab-cart';
      cartPanel.className = 'tab-panel';
      cartPanel.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">购物车</h2>
              <p class="card-subtitle">已加入购物车的商品会保存在您的账号中。</p>
            </div>
          </div>
          <div id="cart-list" class="cart-list"></div>
          <div class="cart-summary">
            <span>合计</span>
            <strong id="cart-total">￥0.00</strong>
          </div>
        </div>
      `;
      productsPanel.insertAdjacentElement('afterend', cartPanel);

      cartPanel.addEventListener('click', async (event) => {
        const buyBtn = event.target.closest('.cart-buy-btn');
        if (buyBtn) {
          const product = loadProducts().find((p) => p.id === buyBtn.dataset.productId);
          if (product) openPurchaseModal(product, true);
          return;
        }

        const removeBtn = event.target.closest('.cart-remove-btn');
        if (removeBtn) {
          await removeProductFromCart(removeBtn.dataset.productId);
        }
      });
    }

    if (!document.getElementById('huiwen-cart-styles')) {
      const style = document.createElement('style');
      style.id = 'huiwen-cart-styles';
      style.textContent = `
        .product-action-group{display:flex;gap:.55rem;align-items:center;flex-wrap:wrap;justify-content:flex-end}
        .product-cart-btn{border:1px solid rgba(224,177,78,.65);background:transparent;color:#e0b14e;border-radius:999px;padding:.52rem .9rem;cursor:pointer}
        .product-cart-btn:disabled{opacity:.45;cursor:not-allowed}
        .cart-tab-count{display:inline-flex;min-width:1.35rem;height:1.35rem;padding:0 .35rem;align-items:center;justify-content:center;border-radius:999px;background:rgba(224,177,78,.18);font-size:.75rem;margin-left:.25rem}
        .cart-list{display:grid;gap:.75rem}
        .cart-empty{color:var(--text-muted,#9aa3b5);padding:1rem 0}
        .cart-item{display:grid;grid-template-columns:1fr auto;gap:1rem;align-items:center;padding:1rem;border:1px solid rgba(255,255,255,.08);border-radius:14px}
        .cart-item-title{font-weight:700;margin-bottom:.25rem}
        .cart-item-meta{color:var(--text-muted,#9aa3b5);font-size:.9rem}
        .cart-item-actions{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;justify-content:flex-end}
        .cart-buy-btn,.cart-remove-btn{border-radius:999px;padding:.52rem .9rem;cursor:pointer}
        .cart-buy-btn{border:0;background:linear-gradient(90deg,#d8aa4a,#f2d48a);color:#111}
        .cart-remove-btn{border:1px solid rgba(224,177,78,.5);background:transparent;color:#e0b14e}
        .cart-summary{display:flex;justify-content:space-between;align-items:center;margin-top:1rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,.08);font-size:1rem}
        @media (max-width:640px){.cart-item{grid-template-columns:1fr}.cart-item-actions{justify-content:flex-start}.product-action-group{justify-content:flex-start}}
      `;
      document.head.appendChild(style);
    }
  }

  function saveCartItems(items) {
    localStorage.setItem(STORAGE_KEY_CART, JSON.stringify(items || []));
  }

  function loadCartItems() {
    const raw = localStorage.getItem(STORAGE_KEY_CART);
    if (!raw) return [];
    try {
      const items = JSON.parse(raw);
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }

  function updateCartCount() {
    const el = document.getElementById('cart-tab-count');
    if (el) el.textContent = String(loadCartItems().length);
  }

  async function syncCartFromSupabase() {
    if (!supabaseClient) {
      updateCartCount();
      return loadCartItems();
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      saveCartItems([]);
      updateCartCount();
      return [];
    }

    const { data, error } = await supabaseClient
      .from('cart_items')
      .select('product_id, quantity, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const items = (Array.isArray(data) ? data : []).map((item) => ({
      productId: item.product_id,
      quantity: Number(item.quantity || 1),
      createdAt: item.created_at,
    }));

    saveCartItems(items);
    updateCartCount();
    return items;
  }

  async function addProductToCart(productId) {
    if (!supabaseClient) {
      alert('购物车服务暂时不可用。');
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      alert('请先登录，再加入购物车。');
      return;
    }

    const { error } = await supabaseClient
      .from('cart_items')
      .upsert(
        {
          user_id: user.id,
          product_id: productId,
          quantity: 1,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,product_id',
          ignoreDuplicates: true,
        },
      );

    if (error) {
      console.error('Add to cart error:', error);
      alert('加入购物车失败，请稍后重试。');
      return;
    }

    await syncCartFromSupabase();
    renderCart();
    alert('已加入购物车。');
  }

  async function removeProductFromCart(productId, showMessage = true) {
    if (!supabaseClient) return;

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) return;

    const { error } = await supabaseClient
      .from('cart_items')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', productId);

    if (error) {
      console.error('Remove cart item error:', error);
      if (showMessage) alert('删除失败，请稍后重试。');
      return;
    }

    await syncCartFromSupabase();
    renderCart();
    if (showMessage) alert('已从购物车删除。');
  }

  function renderCart() {
    const container = document.getElementById('cart-list');
    const totalEl = document.getElementById('cart-total');
    if (!container) return;

    const items = loadCartItems();
    const products = loadProducts();

    const rows = items
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        return product ? { item, product } : null;
      })
      .filter(Boolean);

    if (!rows.length) {
      container.innerHTML = '<div class="cart-empty">购物车还是空的。</div>';
      if (totalEl) totalEl.textContent = '￥0.00';
      updateCartCount();
      return;
    }

    const total = rows.reduce((sum, row) => sum + Number(row.product.price || 0), 0);

    container.innerHTML = rows.map(({ product }) => `
      <div class="cart-item" data-product-id="${product.id}">
        <div>
          <div class="cart-item-title">${String(product.name || '商品').replace(/</g, '&lt;')}</div>
          <div class="cart-item-meta">￥${Number(product.price || 0).toFixed(2)}</div>
        </div>
        <div class="cart-item-actions">
          <button type="button" class="cart-buy-btn" data-product-id="${product.id}">立即购买</button>
          <button type="button" class="cart-remove-btn" data-product-id="${product.id}">删除</button>
        </div>
      </div>
    `).join('');

    if (totalEl) totalEl.textContent = `￥${total.toFixed(2)}`;
    updateCartCount();
  }

  function loadProducts() {
    const raw = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    if (!raw) return defaultProducts;
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) && list.length ? list : defaultProducts;
    } catch {
      return defaultProducts;
    }
  }

  function saveProducts(products) {
    localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products || []));
  }

  function mapSupabaseProduct(product) {
    return {
      id: product.id,
      name: product.name || '',
      price: Number(product.price || 0),
      stock: Number.isFinite(Number(product.stock)) ? Number(product.stock) : 0,
      desc: product.description || '',
      image: product.image_url || undefined,
      active: product.active !== false,
      createdAt: product.created_at || null,
      updatedAt: product.updated_at || null,
      sortOrder: Number(product.sort_order || 0),
    };
  }

  async function syncProductsFromSupabase() {
    if (!supabaseClient) return loadProducts();

    const { data, error } = await supabaseClient.rpc('get_active_products');
    if (error) {
      console.error('Product sync error:', error);
      throw error;
    }

    const products = (Array.isArray(data) ? data : []).map(mapSupabaseProduct);
    if (products.length) {
      saveProducts(products);
      return products;
    }

    // Do not erase a usable local cache if the database temporarily returns no rows.
    return loadProducts();
  }

  function saveCurrentUser(user) {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  }

  function loadCurrentUser() {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function loadUsers() {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    if (!raw) return [];
    try {
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list.map((u) => ensureUserFinancialFields(u));
    } catch {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  }

  function mapSupabaseProfile(profile) {
    return ensureUserFinancialFields({
      id: profile.id,
      email: profile.email,
      referralCode: profile.referral_code,
      parentReferral: profile.parent_referral,
      totalCommission: Number(profile.total_commission || 0),
      commissionBalance: Number(profile.commission_balance || 0),
      points: Number(profile.points || 0),
      createdAt: profile.created_at,
    });
  }

  async function syncProfilesFromSupabase() {
    if (!supabaseClient) return loadUsers();

    const { data, error } = await supabaseClient.rpc('get_app_profiles');
    if (error) {
      console.error('Profile sync error:', error);
      throw error;
    }

    const users = Array.isArray(data) ? data.map(mapSupabaseProfile) : [];
    saveUsers(users);
    return users;
  }

  function saveCommissionRecords(records) {
    localStorage.setItem(STORAGE_KEY_COMMISSIONS, JSON.stringify(records || []));
  }

  function loadCommissionRecords() {
    const raw = localStorage.getItem(STORAGE_KEY_COMMISSIONS);
    if (!raw) return [];
    try {
      const records = JSON.parse(raw);
      return Array.isArray(records) ? records : [];
    } catch {
      return [];
    }
  }

  async function syncOrdersFromSupabase() {
    if (!supabaseClient) return loadOrders();

    const { data, error } = await supabaseClient.rpc('get_my_orders');
    if (error) throw error;

    const orders = (Array.isArray(data) ? data : []).map((order) => ({
      id: order.id,
      paypalOrderId: order.paypal_order_id,
      buyerEmail: order.buyer_email,
      buyerName: order.buyer_name || '',
      buyerDob: order.buyer_dob || '',
      buyerCountry: order.buyer_country || '',
      buyerGender: order.buyer_gender || '',
      productId: order.product_id,
      productName: order.product_name,
      price: Number(order.price || 0),
      paymentStatus: order.payment_status,
      shipped: Boolean(order.shipped),
      createdAt: order.created_at,
    }));

    saveOrders(orders);
    return orders;
  }

  async function syncCommissionsFromSupabase() {
    if (!supabaseClient) return loadCommissionRecords();

    const { data, error } = await supabaseClient.rpc('get_my_commissions');
    if (error) throw error;

    const records = (Array.isArray(data) ? data : []).map((item) => ({
      buyerEmail: item.buyer_email,
      buyerCode: item.buyer_code || '',
      level: Number(item.level || 0),
      commission: Number(item.amount || 0),
      createdAt: item.created_at,
    }));

    saveCommissionRecords(records);
    return records;
  }

  async function syncWithdrawalsFromSupabase() {
    if (!supabaseClient) return loadWithdrawals();

    const { data, error } = await supabaseClient.rpc('get_my_withdrawals');
    if (error) throw error;

    const withdrawals = (Array.isArray(data) ? data : []).map((item) => ({
      id: item.id,
      email: item.email,
      amount: Number(item.amount || 0),
      status: item.status || 'pending',
      createdAt: item.created_at,
    }));

    saveWithdrawals(withdrawals);
    return withdrawals;
  }

  async function createWithdrawalRequest(formData) {
    if (!supabaseClient) {
      throw new Error('Supabase is unavailable.');
    }

    const { error } = await supabaseClient.rpc('create_withdrawal_request', {
      p_amount: Number(formData.amount),
      p_first_name: formData.firstName,
      p_last_name: formData.lastName,
      p_phone_number: formData.phoneNumber,
      p_billing_address: formData.billingAddress,
      p_paypal_email: formData.paypalEmail,
    });
    if (error) throw error;

    const [allUsers] = await Promise.all([
      syncProfilesFromSupabase(),
      syncWithdrawalsFromSupabase(),
    ]);

    const current = loadCurrentUser();
    const updated = allUsers.find((user) => user.id === current?.id);

    if (updated) {
      saveCurrentUser(updated);
      updateWalletSummary(updated);
    }
  }

  function getWithdrawalBlockingState() {
    const withdrawals = loadWithdrawals()
      .filter((item) => item && item.status !== 'rejected')
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

    const active = withdrawals.find((item) =>
      item.status === 'pending' || item.status === 'approved'
    );
    if (active) {
      return { blocked: true, reason: 'active' };
    }

    return { blocked: false, reason: '' };
  }

  function openWithdrawalModal(user) {
    const modal = document.getElementById('withdraw-modal');
    const amountInput = document.getElementById('withdraw-amount');
    const help = document.getElementById('withdraw-amount-help');
    const message = document.getElementById('withdraw-modal-message');
    if (!modal || !user) return;

    const balance = Number(user.commissionBalance || 0);
    if (amountInput) {
      amountInput.min = String(WITHDRAW_THRESHOLD);
      amountInput.max = balance.toFixed(2);
      amountInput.value = '';
    }
    if (help) {
      help.textContent = `可输入 ￥${WITHDRAW_THRESHOLD.toFixed(2)} 至 ￥${balance.toFixed(2)}。`;
    }
    if (message) message.textContent = '';
    modal.hidden = false;
  }

  function closeWithdrawalModal() {
    const modal = document.getElementById('withdraw-modal');
    if (modal) modal.hidden = true;
    const message = document.getElementById('withdraw-modal-message');
    if (message) message.textContent = '';
  }

  function initWithdrawalModal() {
    const modal = document.getElementById('withdraw-modal');
    const cancelBtn = document.getElementById('withdraw-modal-cancel');
    const submitBtn = document.getElementById('withdraw-modal-submit');
    const backdrop = modal?.querySelector('.purchase-modal-backdrop');

    cancelBtn?.addEventListener('click', closeWithdrawalModal);
    backdrop?.addEventListener('click', closeWithdrawalModal);

    submitBtn?.addEventListener('click', async () => {
      const user = loadCurrentUser();
      const message = document.getElementById('withdraw-modal-message');
      if (!user) return;

      const firstName = (document.getElementById('withdraw-first-name')?.value || '').trim();
      const lastName = (document.getElementById('withdraw-last-name')?.value || '').trim();
      const phoneNumber = normalizeBookingPhone(
        (document.getElementById('withdraw-phone')?.value || '').trim(),
      );
      const billingAddress = (document.getElementById('withdraw-billing-address')?.value || '').trim();
      const paypalEmail = (document.getElementById('withdraw-paypal-email')?.value || '').trim().toLowerCase();
      const amount = Number(document.getElementById('withdraw-amount')?.value || 0);
      const balance = Number(user.commissionBalance || 0);

      const fail = (text) => {
        if (message) message.textContent = text;
      };

      if (!firstName) return fail('请填写名字。');
      if (!lastName) return fail('请填写姓氏。');
      if (!phoneNumber) return fail('请填写有效电话号码，并包含国家 / 地区代码。');
      if (!billingAddress) return fail('请填写完整账单地址。');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail)) {
        return fail('请填写有效的 PayPal 邮箱。');
      }
      if (!Number.isFinite(amount) || amount < WITHDRAW_THRESHOLD) {
        return fail(`提现金额不能低于 ￥${WITHDRAW_THRESHOLD.toFixed(2)}。`);
      }
      if (amount > balance + 0.000001) {
        return fail('提现金额不能超过当前可提现余额。');
      }

      submitBtn.disabled = true;
      try {
        await createWithdrawalRequest({
          amount,
          firstName,
          lastName,
          phoneNumber,
          billingAddress,
          paypalEmail,
        });
        closeWithdrawalModal();
        alert('提现申请已提交，当前状态为待审核。');
      } catch (error) {
        const errorText = String(error?.message || '');
        if (/minimum withdrawal/i.test(errorText) || /minimum balance/i.test(errorText)) {
          fail(`提现金额不能低于 ￥${WITHDRAW_THRESHOLD.toFixed(2)}。`);
        } else if (/amount exceeds balance/i.test(errorText)) {
          fail('提现金额不能超过当前可提现余额。');
        } else if (/active withdrawal/i.test(errorText) || /pending withdrawal/i.test(errorText)) {
          fail('你已有一笔正在处理的提现申请，请等待处理完成。');
        } else if (/invalid phone/i.test(errorText)) {
          fail('请填写有效电话号码，并包含国家 / 地区代码。');
        } else if (/invalid paypal/i.test(errorText)) {
          fail('请填写有效的 PayPal 邮箱。');
        } else {
          fail('提现申请提交失败，请稍后重试。');
        }
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  async function recordCompletedPurchase(product, buyerInfo, paypalOrderId) {
    const { error } = await supabaseClient.rpc('record_completed_purchase', {
      p_paypal_order_id: paypalOrderId,
      p_product_id: product.id,
      p_buyer_name: buyerInfo?.name || '',
      p_buyer_dob: buyerInfo?.dob || null,
      p_buyer_country: buyerInfo?.country || '',
      p_buyer_gender: buyerInfo?.gender || '',
    });

    if (error) throw error;

    const [allUsers] = await Promise.all([
      syncProfilesFromSupabase(),
      syncOrdersFromSupabase(),
      syncCommissionsFromSupabase(),
    ]);

    const current = loadCurrentUser();
    const updated = allUsers.find((user) => user.id === current?.id);
    if (updated) {
      saveCurrentUser(updated);
      updateWalletSummary(updated);
    }

    renderMyOrders();
    if (typeof updateHumanConsultVisibility === 'function') {
      updateHumanConsultVisibility();
    }
  }

  function ensureUserFinancialFields(user) {
    if (typeof user.totalCommission !== 'number') {
      user.totalCommission = 0;
    }
    if (typeof user.commissionBalance !== 'number') {
      user.commissionBalance = 0;
    }
    if (typeof user.points !== 'number') {
      user.points = 0;
    }
    return user;
  }

  // 计算“根级别”（没有上级）的下一位邀请码，例如 A001、A002、A003 ...
  function generateRootReferralCode(users) {
    const roots = users.filter((u) => /^[A-Z]\d{3}$/.test(u.referralCode));
    if (!roots.length) return 'A001';

    const maxNum = roots.reduce((max, u) => {
      const n = parseInt(u.referralCode.slice(1), 10);
      if (Number.isNaN(n)) return max;
      return Math.max(max, n);
    }, 0);

    const next = maxNum + 1;
    return `A${String(next).padStart(3, '0')}`;
  }

  // 为某个上级生成下一级的邀请码，例如：
  // 父级 A001 -> 子级前缀 A001B + 编号（A001B001、A001B002 ...）
  function generateChildReferralCode(users, parentCode) {
    const parentSegments = parentCode.match(/[A-Z]\d{3}/g) || [];
    const parentLevel = parentSegments.length; // 1 表示 A 层，2 表示 A...B 层

    // 子级要用的字母：父级是 A -> 子级 B，父级是 A..B -> 子级 C ...
    const childLetterCode = 'A'.charCodeAt(0) + parentLevel;
    const childLetter = String.fromCharCode(childLetterCode);

    const prefix = `${parentCode}${childLetter}`;

    const children = users.filter(
      (u) =>
        u.referralCode.startsWith(prefix) &&
        u.referralCode.length === prefix.length + 3,
    );

    const maxNum = children.reduce((max, u) => {
      const n = parseInt(u.referralCode.slice(-3), 10);
      if (Number.isNaN(n)) return max;
      return Math.max(max, n);
    }, 0);

    const next = maxNum + 1;
    const fullCode = `${prefix}${String(next).padStart(3, '0')}`;

    // 只保留最近 5 段（例如 A001B001C001D001E001），更早的段截掉
    const codeSegments = fullCode.match(/[A-Z]\d{3}/g) || [];
    if (codeSegments.length <= 5) return fullCode;

    const recent = codeSegments.slice(-5);
    return recent.join('');
  }

  function updateHeaderCurrentUser(user) {
    const el = document.getElementById('header-current-user');
    if (!el) return;
    if (!user) {
      el.style.display = 'none';
      el.textContent = '';
      return;
    }
    el.style.display = 'flex';
    const safeEmail = (user.email || '—').replace(/</g, '&lt;');
    const safeCode = (user.referralCode || '—').replace(/</g, '&lt;');
    el.innerHTML = `
      <span class="header-user-line">当前：<strong>${safeEmail}</strong></span>
      <span class="header-user-line">邀请码 <strong>${safeCode}</strong></span>
    `;
  }

  function showMainScreen() {
    screenAuth.classList.remove('screen--active');
    screenAuth.hidden = true;
    screenMain.classList.add('screen--active');
    screenMain.hidden = false;

    if (logoutBtn) {
      logoutBtn.style.display = 'inline-flex';
    }
    updateHeaderCurrentUser(loadCurrentUser());
    if (document.getElementById('booking-year')) {
      updateBookingDateChoices();
    }
    activateHomeTab();
    syncHomeAnnouncements().catch((error) => {
      console.error('Announcement homepage load error:', error);
      homeAnnouncementsCache = [];
      renderHomeAnnouncements();
    });
  }

  function showAuthScreen() {
    screenMain.classList.remove('screen--active');
    screenMain.hidden = true;
    screenAuth.classList.add('screen--active');
    screenAuth.hidden = false;

    // 清空登录表单，方便切换账号
    emailInput.value = '';
    passwordInput.value = '';
    referralInput.value = '';

    if (logoutBtn) {
      logoutBtn.style.display = 'none';
    }
    updateHeaderCurrentUser(null);
  }

  async function handleAuth() {
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value.trim();
    const referral = referralInput.value.trim().toUpperCase();

    if (!email || !password) {
      alert('请输入邮箱和密码。');
      return;
    }

    if (!supabaseClient) {
      alert('登录服务暂时不可用，请稍后重试。');
      return;
    }

    try {
      let authUser = null;

      const {
        data: signInData,
        error: signInError,
      } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (!signInError && signInData?.user) {
        authUser = signInData.user;
      } else {
        const {
          data: signUpData,
          error: signUpError,
        } = await supabaseClient.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          const message = String(signUpError.message || '');
          if (/already|registered|exists/i.test(message)) {
            alert('该邮箱已经注册。请检查密码后重试，或使用“忘记密码”。');
          } else {
            alert(message || '注册失败，请稍后重试。');
          }
          return;
        }

        authUser = signUpData?.user || null;

        if (!authUser || !signUpData?.session) {
          alert('请先完成邮箱验证，然后再登录。');
          return;
        }
      }

      let {
        data: profile,
        error: profileError,
      } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileError) {
        console.error('Profile load error:', profileError);
        alert('无法读取用户资料，请稍后重试。');
        return;
      }

      if (!profile) {
        const {
          data: createdProfile,
          error: createProfileError,
        } = await supabaseClient.rpc('create_profile_with_referral', {
          p_referral: referral || null,
        });

        if (createProfileError) {
          console.error('Profile creation error:', createProfileError);
          const message = String(createProfileError.message || '');
          if (/invalid referral/i.test(message)) {
            alert('推荐码无效或不存在，请确认后再填写。');
          } else {
            alert('创建用户资料失败，请稍后重试。');
          }
          return;
        }

        profile = Array.isArray(createdProfile)
          ? createdProfile[0]
          : createdProfile;
      }

      const [allUsers] = await Promise.all([
        syncProfilesFromSupabase(),
        syncOrdersFromSupabase(),
        syncCommissionsFromSupabase(),
        syncWithdrawalsFromSupabase(),
        syncBookingsFromSupabase(),
        syncCartFromSupabase(),
        syncProductsFromSupabase(),
      ]);
      let user = allUsers.find((item) => item.id === authUser.id);

      if (!user && profile) {
        user = mapSupabaseProfile(profile);
      }

      if (!user) {
        alert('无法载入用户资料，请稍后重试。');
        return;
      }

      saveCurrentUser(user);
      showMainScreen();
      updateWalletSummary(user);
      renderProducts();
      renderMyOrders();
      renderCart();
      initNetworkPanel();
    } catch (error) {
      console.error('Supabase auth error:', error);
      alert('登录或注册失败，请稍后重试。');
    }
  }

  const btnWithdraw = document.getElementById('btn-withdraw');
  if (btnWithdraw) {
    btnWithdraw.addEventListener('click', () => {
      const user = loadCurrentUser();
      if (!user) return;

      const balance = Number(user.commissionBalance || 0);
      if (balance < WITHDRAW_THRESHOLD) {
        alert(
          `需满 ￥${WITHDRAW_THRESHOLD.toFixed(2)} 可申请提现，当前余额 ￥${balance.toFixed(2)}。`,
        );
        return;
      }

      const state = getWithdrawalBlockingState();
      if (state.reason === 'active') {
        alert('你已有一笔正在处理的提现申请，请等待处理完成。');
        return;
      }
      openWithdrawalModal(user);
    });
  }

  initWithdrawalModal();

  function initTabs() {
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;

        tabButtons.forEach((b) => b.classList.remove('tab--active'));
        btn.classList.add('tab--active');

        tabPanels.forEach((panel) => {
          panel.classList.toggle(
            'tab-panel--active',
            panel.id === `tab-${target}`,
          );
        });

        if (target === 'home') {
          syncHomeAnnouncements().catch((error) => {
            console.error('Announcement homepage refresh error:', error);
            renderHomeAnnouncements();
          });
        }

        if (target === 'support' && typeof updateHumanConsultVisibility === 'function') {
          updateHumanConsultVisibility();
        }

        if (target === 'products') {
          syncProductsFromSupabase()
            .then(() => {
              renderProducts();
              renderCart();
            })
            .catch((error) => {
              console.error('Product refresh error:', error);
            });
        }

        if (target === 'cart') {
          Promise.all([
            syncProductsFromSupabase(),
            syncCartFromSupabase(),
          ])
            .then(() => renderCart())
            .catch((error) => {
              console.error('Cart refresh error:', error);
              renderCart();
            });
        }
      });
    });
  }

  function renderProducts() {
    productList.innerHTML = '';
    const products = loadProducts();

    products.forEach((product) => {
      const card = document.createElement('article');
      card.className = 'product-card';
      const thumbStyle = product.image ? `style="background-image:url(${product.image});background-size:cover;background-position:center"` : '';
      const stock = typeof product.stock === 'number' ? product.stock : 999;
      const soldOut = stock <= 0;
      const stockText = typeof product.stock === 'number' ? (soldOut ? '已售罄' : `库存 ${product.stock}`) : '';
      card.innerHTML = `
        <div class="product-thumb" ${thumbStyle}></div>
        <div>
          <h3 class="product-info-title">${product.name}</h3>
          <p class="product-info-desc">${product.desc}</p>
          ${stockText ? `<p class="product-stock ${soldOut ? 'sold-out' : ''}">${stockText}</p>` : ''}
          <div class="product-meta">
            <span class="product-price">
              ￥<span class="product-price-amount">${product.price}</span>
            </span>
            <div class="product-action-group">
              <button class="product-cart-btn" data-id="${product.id}" ${soldOut ? 'disabled' : ''}>
                ${soldOut ? '已售罄' : '加入购物车'}
              </button>
              <button class="product-buy-btn" data-id="${product.id}" ${soldOut ? 'disabled' : ''}>
                ${soldOut ? '已售罄' : '立即购买'}
              </button>
            </div>
          </div>
        </div>
      `;
      productList.appendChild(card);
    });

    if (!productList.dataset.productListenerAdded) {
      productList.dataset.productListenerAdded = '1';
      productList.addEventListener('click', async (event) => {
        const cartBtn = event.target.closest('.product-cart-btn');
        if (cartBtn && !cartBtn.disabled) {
          await addProductToCart(cartBtn.dataset.id);
          return;
        }

        const btn = event.target.closest('.product-buy-btn');
        if (!btn || btn.disabled) return;

        const productId = btn.dataset.id;
        const product = loadProducts().find((p) => p.id === productId);
        if (!product) return;

        openPurchaseModal(product, false);
      });
    }
  }

  let purchaseModalProduct = null;
  let purchaseFromCartProductId = null;

  function openPurchaseModal(product, fromCart = false) {
    purchaseModalProduct = product;
    purchaseFromCartProductId = fromCart ? product.id : null;

    const modal = document.getElementById('purchase-modal');
    const nameInput = document.getElementById('purchase-buyer-name');
    const dobInput = document.getElementById('purchase-buyer-dob');
    const countryInput = document.getElementById('purchase-buyer-country');
    const genderInput = document.getElementById('purchase-buyer-gender');

    if (!modal || !nameInput || !dobInput || !countryInput || !genderInput) return;

    nameInput.value = '';
    resetBirthdayFields();
    countryInput.value = '';
    genderInput.value = '';
    modal.hidden = false;
  }

  async function showPayPalPayment(product, buyerInfo) {
      const paymentArea = document.getElementById('paypal-payment-area');
      const buttonContainer = document.getElementById('paypal-button-container');
      const message = document.getElementById('paypal-payment-message');
      const actions = document.querySelector('.purchase-modal-actions');
  
      if (!paymentArea || !buttonContainer || !message) {
        alert('PayPal payment area was not found.');
        return;
      }
  
      if (!window.PAYPAL_CLIENT_ID) {
        alert('PayPal Client ID is unavailable.');
        return;
      }
  
      paymentArea.hidden = false;
      buttonContainer.innerHTML = '';
      message.textContent = '正在加载 PayPal…';
  
      if (actions) actions.hidden = true;
  
      try {
        if (!window.paypal) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
  
            script.src =
              'https://www.paypal.com/sdk/js?client-id=' +
              encodeURIComponent(window.PAYPAL_CLIENT_ID) +
  '&currency=CAD&intent=capture&disable-funding=card,credit,paylater,venmo';
          
            script.onload = resolve;
            script.onerror = () => reject(new Error('PayPal SDK failed to load.'));
  
            document.head.appendChild(script);
          });
        }
  
        message.textContent = '请使用 PayPal 完成付款。';
  
       window.paypal
    .Buttons({
      fundingSource: window.paypal.FUNDING.PAYPAL,
    
            createOrder: async () => {
              const response = await fetch('/api/paypal/create-order', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  productId: product.id,
                }),
              });
  
              const data = await response.json();
  
              if (!response.ok || !data.id) {
                throw new Error(data.error || 'Unable to create PayPal order.');
              }
  
              return data.id;
            },
  
            onApprove: async (data) => {
              message.textContent = '正在确认付款…';
  
              const response = await fetch('/api/paypal/capture-order', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  orderId: data.orderID,
                }),
              });
  
              const result = await response.json();
  
              if (!response.ok || result.status !== 'COMPLETED') {
                throw new Error(result.error || 'Payment was not completed.');
              }
  
              message.textContent = '付款成功，正在保存订单和佣金…';

              await recordCompletedPurchase(product, buyerInfo, data.orderID);

              if (purchaseFromCartProductId) {
                await removeProductFromCart(purchaseFromCartProductId, false);
                purchaseFromCartProductId = null;
              }

              message.textContent = '付款成功，订单和佣金已保存。';
              const modal = document.getElementById('purchase-modal');
  if (modal) modal.hidden = true;
  purchaseModalProduct = null;
            },
  
            onCancel: () => {
              message.textContent = '付款已取消，您可以重新尝试。';
            },
  
            onError: (error) => {
              console.error('PayPal error:', error);
              message.textContent = 'PayPal 付款出现问题，请稍后重试。';
            },
          })
          .render('#paypal-button-container');
      } catch (error) {
        console.error('PayPal loading error:', error);
        message.textContent = 'PayPal 无法加载，请稍后重试。';
  
        if (actions) actions.hidden = false;
      }
    }

  function initPurchaseModal() {
      const modal = document.getElementById('purchase-modal');
      const cancelBtn = document.getElementById('purchase-modal-cancel');
      const confirmBtn = document.getElementById('purchase-modal-confirm');
      const backdrop = document.querySelector('.purchase-modal-backdrop');
      const paymentArea = document.getElementById('paypal-payment-area');
      const buttonContainer = document.getElementById('paypal-button-container');
      const message = document.getElementById('paypal-payment-message');
      const actions = document.querySelector('.purchase-modal-actions');
  
      const closeModal = () => {
        if (modal) modal.hidden = true;
  
        purchaseModalProduct = null;
        purchaseFromCartProductId = null;
  
        if (paymentArea) paymentArea.hidden = true;
        if (buttonContainer) buttonContainer.innerHTML = '';
        if (message) message.textContent = '';
        if (actions) actions.hidden = false;
      };
  
      if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
      }
  
      if (backdrop) {
        backdrop.addEventListener('click', closeModal);
      }
  
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          const name = (
            document.getElementById('purchase-buyer-name')?.value || ''
          ).trim();
  
          const dob = (
            document.getElementById('purchase-buyer-dob')?.value || ''
          ).trim();
  
          const country = (
            document.getElementById('purchase-buyer-country')?.value || ''
          ).trim();

          const gender = (
            document.getElementById('purchase-buyer-gender')?.value || ''
          ).trim();
  
          if (!name) {
            alert('请填写姓名。');
            return;
          }
  
          if (!dob) {
            alert('请选择有效的出生年月日。年份必须为 4 位数字，且日期不能晚于今天。');
            return;
          }
  
          if (!country) {
            alert('请填写来自的国家。');
            return;
          }

          if (!gender) {
            alert('请选择性别。');
            return;
          }
  
          const product = purchaseModalProduct;
  
          if (!product) {
            alert('未找到商品信息，请重新选择商品。');
            return;
          }
  
          showPayPalPayment(product, {
            name,
            dob,
            country,
            gender,
          });
        });
      }
    }

  function loadOrders() {
    const raw = localStorage.getItem(STORAGE_KEY_ORDERS);
    if (!raw) return [];
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function saveOrders(orders) {
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
  }

  function handleDemoPurchase(product, buyerInfo) {
    const current = loadCurrentUser();
    if (!current) {
      alert('请先登录，再进行购买。');
      return;
    }

    const products = loadProducts();
    const productData = products.find((p) => p.id === product.id) || product;
    const stock = typeof productData.stock === 'number' ? productData.stock : 999;
    if (stock <= 0) {
      alert('该商品已售罄。');
      return;
    }

    const allUsers = loadUsers();
    const userIndex = allUsers.findIndex((u) => u.email === current.email);
    if (userIndex === -1) {
      alert('当前用户信息未找到，请重新登录。');
      return;
    }

    const buyer = ensureUserFinancialFields(allUsers[userIndex]);
    const amount = product.price;

    // 佣金：仍按 5 级 20% / 15% / 10% / 5% / 3% 向上发放。
    // 善缘值：完全独立，只奖励直接上级；每次直推用户完成购买固定 +20 缘。
    let parentCode = buyer.parentReferral;
    for (let level = 0; level < COMMISSION_RATES.length && parentCode; level += 1) {
      const rate = COMMISSION_RATES[level];
      const parent = allUsers.find((u) => u.referralCode === parentCode);
      if (!parent) break;

      ensureUserFinancialFields(parent);
      const commission = amount * rate;
      parent.totalCommission += commission;
      parent.commissionBalance += commission;

      parentCode = parent.parentReferral;
    }

    if (buyer.parentReferral) {
      const directParent = allUsers.find(
        (u) => u.referralCode === buyer.parentReferral,
      );
      if (directParent) {
        ensureUserFinancialFields(directParent);
        directParent.points =
          Math.round(directParent.points || 0) + POINTS_PER_DIRECT_PURCHASE;
      }
    }

    allUsers[userIndex] = buyer;
    saveUsers(allUsers);

    const pIdx = products.findIndex((p) => p.id === product.id);
    if (pIdx >= 0 && typeof products[pIdx].stock === 'number') {
      products[pIdx].stock = Math.max(0, products[pIdx].stock - 1);
      saveProducts(products);
    }

    const orderId = 'o' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const createdAt = new Date().toISOString();
    const order = {
      id: orderId,
      buyerEmail: current.email,
      buyerCode: current.referralCode,
      productId: product.id,
      productName: product.name,
      price: amount,
      createdAt,
      shipped: false,
      buyerName: buyerInfo?.name || '',
      buyerDob: buyerInfo?.dob || '',
      buyerCountry: buyerInfo?.country || '',
      buyerGender: buyerInfo?.gender || '',
    };
    const orders = loadOrders();
    orders.unshift(order);
    saveOrders(orders);

    const updatedCurrent = allUsers[userIndex];
    saveCurrentUser(updatedCurrent);
    updateWalletSummary(updatedCurrent);
    if (typeof renderMyOrders === 'function') renderMyOrders();
    if (typeof updateHumanConsultVisibility === 'function') updateHumanConsultVisibility();

    // 发货：若配置了发货服务且商品有图片，自动发邮件到客户邮箱
    const deliveryUrl = (typeof DELIVERY_API_URL !== 'undefined' ? DELIVERY_API_URL : '') || '';
    if (deliveryUrl && product.image) {
      fetch(deliveryUrl + '/api/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerEmail: current.email,
          productName: product.name,
          productImage: product.image,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            alert(`购买成功！《${product.name}》已发送到您的邮箱 ${current.email}，请查收。`);
          } else {
            alert(`购买成功！订单已生成。管理员会在制作完成并确认后，通过邮件向您发送专属符。`);
          }
        })
        .catch(() => {
          alert(`购买成功！订单已生成。管理员会在制作完成并确认后，通过邮件向您发送专属符。`);
        });
    } else {
      const msg = product.image
        ? `购买成功！《${product.name}》已生成订单。管理员制作完成并确认后，会通过邮件向您发送专属符，请留意查收。`
        : `购买成功！《${product.name}》已生成订单，管理员将根据订单制作电子图片并发送至您的邮箱。`;
      alert(msg);
    }
  }

  function loadBookings() {
    const raw = localStorage.getItem(STORAGE_KEY_BOOKINGS);
    if (!raw) return [];
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function saveBookings(list) {
    localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(list));
  }

  function isBuyer(email) {
    return loadOrders().some((o) => o.buyerEmail === email);
  }

  async function syncBookingsFromSupabase() {
    if (!supabaseClient) return loadBookings();

    const { data, error } = await supabaseClient.rpc('get_my_bookings');
    if (error) {
      console.error('Booking sync error:', error);
      throw error;
    }

    const bookings = (Array.isArray(data) ? data : []).map((item) => ({
      id: item.id,
      userEmail: item.user_email,
      date: item.booking_date,
      slot: item.booking_slot,
      duration: Number(item.duration_minutes || 30),
      status: item.status || 'pending',
      phoneNumber: item.phone_number || '',
      notes: item.notes || '',
      createdAt: item.created_at,
    }));

    saveBookings(bookings);
    return bookings;
  }

  async function createBookingInSupabase(date, slot, phoneNumber) {
    if (!supabaseClient) {
      throw new Error('Supabase is unavailable.');
    }

    const { error } = await supabaseClient.rpc('create_booking', {
      p_booking_date: date,
      p_booking_slot: slot,
      p_phone_number: phoneNumber,
      p_duration_minutes: 30,
    });

    if (error) {
      console.error('Booking creation error:', error);
      throw error;
    }

    await syncBookingsFromSupabase();
  }

  // Booking time is intentionally fixed to PDT (UTC-7) all year.
  // Boss explicitly does not want automatic PST/PDT switching for appointments.
  function getPdtDateTimeParts(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

    const pdtClock = new Date(date.getTime() - 7 * 60 * 60 * 1000);
    return {
      year: pdtClock.getUTCFullYear(),
      month: pdtClock.getUTCMonth() + 1,
      day: pdtClock.getUTCDate(),
      hour: pdtClock.getUTCHours(),
      minute: pdtClock.getUTCMinutes(),
    };
  }

  function bookingDateKey(parts) {
    if (!parts) return null;
    return parts.year * 10000 + parts.month * 100 + parts.day;
  }

  function bookingDateTimeKey(parts) {
    if (!parts) return null;
    return (
      parts.year * 100000000 +
      parts.month * 1000000 +
      parts.day * 10000 +
      parts.hour * 100 +
      parts.minute
    );
  }

  function getBookingRegistrationWindow() {
    const user = loadCurrentUser();
    const registeredAt = user?.createdAt ? new Date(user.createdAt) : null;
    if (!registeredAt || Number.isNaN(registeredAt.getTime())) return null;

    const minDate = new Date(registeredAt.getTime() + 3 * 24 * 60 * 60 * 1000);
    const maxDate = new Date(registeredAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const minParts = getPdtDateTimeParts(minDate);
    const maxParts = getPdtDateTimeParts(maxDate);

    if (!minParts || !maxParts) return null;

    return {
      minParts,
      maxParts,
      minDateKey: bookingDateKey(minParts),
      maxDateKey: bookingDateKey(maxParts),
      minDateTimeKey: bookingDateTimeKey(minParts),
      maxDateTimeKey: bookingDateTimeKey(maxParts),
    };
  }

  function bookingDaysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function parseBookingSlotStart(slot) {
    const match = String(slot || '').match(/^(\d{2}):(\d{2})-/);
    if (!match) return null;
    return { hour: Number(match[1]), minute: Number(match[2]) };
  }

  function isBookingDateTimeWithinRegistrationWindow(dateValue, slotValue) {
    const windowRange = getBookingRegistrationWindow();
    const slotStart = parseBookingSlotStart(slotValue);
    const match = String(dateValue || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!windowRange || !slotStart || !match) return false;

    const selectedKey = bookingDateTimeKey({
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: slotStart.hour,
      minute: slotStart.minute,
    });

    return (
      selectedKey >= windowRange.minDateTimeKey &&
      selectedKey <= windowRange.maxDateTimeKey
    );
  }

  function updateBookingSlotChoices() {
    if (!bookingSlotSelect) return;

    const dateValue = bookingDateInput?.value || '';
    const windowRange = getBookingRegistrationWindow();

    Array.from(bookingSlotSelect.options).forEach((option) => {
      if (!option.value) return;
      option.disabled =
        !windowRange ||
        !dateValue ||
        !isBookingDateTimeWithinRegistrationWindow(dateValue, option.value);
    });

    if (
      bookingSlotSelect.value &&
      bookingSlotSelect.selectedOptions[0]?.disabled
    ) {
      bookingSlotSelect.value = '';
    }
  }

  function syncBookingDateValue() {
    const hidden = document.getElementById('booking-date');
    const yearInput = document.getElementById('booking-year');
    const monthSelect = document.getElementById('booking-month');
    const daySelect = document.getElementById('booking-day');

    if (!hidden || !yearInput || !monthSelect || !daySelect) return;

    hidden.value = '';

    const yearText = yearInput.value.trim();
    if (!/^\d{4}$/.test(yearText)) {
      updateBookingSlotChoices();
      return;
    }

    const year = Number(yearText);
    const month = Number(monthSelect.value);
    const day = Number(daySelect.value);
    if (!month || !day) {
      updateBookingSlotChoices();
      return;
    }

    const windowRange = getBookingRegistrationWindow();
    const maxDay = bookingDaysInMonth(year, month);
    if (!windowRange || day < 1 || day > maxDay) {
      updateBookingSlotChoices();
      return;
    }

    const selectedDateKey = year * 10000 + month * 100 + day;
    if (
      selectedDateKey < windowRange.minDateKey ||
      selectedDateKey > windowRange.maxDateKey
    ) {
      updateBookingSlotChoices();
      return;
    }

    hidden.value =
      String(year).padStart(4, '0') +
      '-' +
      String(month).padStart(2, '0') +
      '-' +
      String(day).padStart(2, '0');

    updateBookingSlotChoices();
  }

  function updateBookingDateChoices() {
    const yearInput = document.getElementById('booking-year');
    const monthSelect = document.getElementById('booking-month');
    const daySelect = document.getElementById('booking-day');

    if (!yearInput || !monthSelect || !daySelect) return;

    const windowRange = getBookingRegistrationWindow();
    const yearText = yearInput.value.trim();
    const year = /^\d{4}$/.test(yearText) ? Number(yearText) : null;

    Array.from(monthSelect.options).forEach((option) => {
      if (!option.value) return;
      const month = Number(option.value);

      option.disabled =
        year !== null &&
        (!windowRange ||
          year < windowRange.minParts.year ||
          year > windowRange.maxParts.year ||
          (year === windowRange.minParts.year && month < windowRange.minParts.month) ||
          (year === windowRange.maxParts.year && month > windowRange.maxParts.month));
    });

    if (
      monthSelect.value &&
      monthSelect.selectedOptions[0] &&
      monthSelect.selectedOptions[0].disabled
    ) {
      monthSelect.value = '';
    }

    const previousDay = Number(daySelect.value);
    daySelect.innerHTML = '<option value="">日</option>';

    const month = Number(monthSelect.value);

    if (windowRange && year !== null && month) {
      const maxDayInMonth = bookingDaysInMonth(year, month);
      let firstDay = 1;
      let lastDay = maxDayInMonth;

      if (
        year === windowRange.minParts.year &&
        month === windowRange.minParts.month
      ) {
        firstDay = windowRange.minParts.day;
      }

      if (
        year === windowRange.maxParts.year &&
        month === windowRange.maxParts.month
      ) {
        lastDay = Math.min(lastDay, windowRange.maxParts.day);
      }

      if (firstDay <= lastDay) {
        for (let day = firstDay; day <= lastDay; day += 1) {
          const option = document.createElement('option');
          option.value = String(day).padStart(2, '0');
          option.textContent = String(day).padStart(2, '0') + ' 日';
          daySelect.appendChild(option);
        }

        if (previousDay >= firstDay && previousDay <= lastDay) {
          daySelect.value = String(previousDay).padStart(2, '0');
        }
      }
    }

    syncBookingDateValue();
  }

  function ensureBookingDateField() {
    const original = document.getElementById('booking-date');
    if (!original || document.getElementById('booking-year')) return;

    const field = original.closest('.field');
    if (!field) return;

    original.type = 'hidden';
    original.removeAttribute('placeholder');
    original.removeAttribute('min');
    original.removeAttribute('max');

    const controls = document.createElement('div');
    controls.className = 'booking-date-select-row';
    controls.innerHTML = `
      <input
        id="booking-year"
        class="field-input booking-year-input"
        type="text"
        inputmode="numeric"
        maxlength="4"
        placeholder="YYYY"
        aria-label="预约年份"
      />
      <select
        id="booking-month"
        class="field-input"
        aria-label="预约月份"
      >
        <option value="">月</option>
        ${Array.from({ length: 12 }, (_, index) => {
          const month = String(index + 1).padStart(2, '0');
          return `<option value="${month}">${month} 月</option>`;
        }).join('')}
      </select>
      <select
        id="booking-day"
        class="field-input"
        aria-label="预约日期"
      >
        <option value="">日</option>
      </select>
    `;

    original.insertAdjacentElement('afterend', controls);

    if (!document.getElementById('huiwen-booking-date-styles')) {
      const style = document.createElement('style');
      style.id = 'huiwen-booking-date-styles';
      style.textContent = `
        .booking-date-select-row{
          display:grid;
          grid-template-columns:1.15fr 1fr 1fr;
          gap:8px;
          width:100%;
        }
        .booking-date-select-row .field-input{
          min-width:0;
          width:100%;
        }
      `;
      document.head.appendChild(style);
    }

    const yearInput = document.getElementById('booking-year');
    const monthSelect = document.getElementById('booking-month');
    const daySelect = document.getElementById('booking-day');

    yearInput.addEventListener('input', () => {
      yearInput.value = yearInput.value.replace(/\D/g, '').slice(0, 4);
      updateBookingDateChoices();
    });

    yearInput.addEventListener('blur', () => {
      const windowRange = getBookingRegistrationWindow();
      const value = yearInput.value.trim();

      if (value && !/^\d{4}$/.test(value)) {
        alert('预约年份必须是 4 位数字。');
        yearInput.focus();
        return;
      }

      if (
        /^\d{4}$/.test(value) &&
        (!windowRange ||
          Number(value) < windowRange.minParts.year ||
          Number(value) > windowRange.maxParts.year)
      ) {
        alert('预约年份必须在注册后 3 至 30 天的可预约范围内。');
        yearInput.value = '';
        updateBookingDateChoices();
      }
    });

    monthSelect.addEventListener('change', updateBookingDateChoices);
    daySelect.addEventListener('change', syncBookingDateValue);

    updateBookingDateChoices();
  }

  function normalizeBookingPhone(value) {
    const raw = String(value || '').trim();
    if (!raw.startsWith('+')) return '';

    const digits = raw.slice(1).replace(/\D/g, '');
    if (!/^[1-9]\d{6,14}$/.test(digits)) return '';

    return '+' + digits;
  }

  function ensureBookingPhoneField() {
    if (document.getElementById('booking-phone')) return;

    const dateInput = document.getElementById('booking-date');
    const dateField = dateInput && dateInput.closest('.field');
    if (!dateField) return;

    const phoneField = document.createElement('label');
    phoneField.className = 'field';
    phoneField.innerHTML = `
      <span class="field-label">联系电话（含国家 / 地区代码）</span>
      <input
        id="booking-phone"
        type="tel"
        class="field-input"
        inputmode="tel"
        autocomplete="tel"
        placeholder="例如：+1 604 555 1234"
      />
      <span class="wallet-subtext" style="display:block;margin-top:6px">
        仅用于本次预约联系与提醒。
      </span>
    `;

    dateField.insertAdjacentElement('beforebegin', phoneField);
  }

  function initBooking() {
    ensureBookingPhoneField();
    ensureBookingDateField();

    if (bookingBtn) {
      bookingBtn.addEventListener('click', async () => {
        const user = loadCurrentUser();
        if (!user) {
          if (bookingMessage) bookingMessage.textContent = '请先登录。';
          return;
        }

        const date = bookingDateInput.value;
        const slot = bookingSlotSelect.value;
        const phoneRaw = (document.getElementById('booking-phone')?.value || '').trim();
        const phoneNumber = normalizeBookingPhone(phoneRaw);
        const duration = 30;

        if (!phoneNumber) {
          if (bookingMessage) {
            bookingMessage.textContent =
              '请填写有效联系电话，并包含国家 / 地区代码，例如 +1 604 555 1234。';
          }
          return;
        }

        if (!date || !slot) {
          if (bookingMessage) {
            bookingMessage.textContent = '请选择预约日期和时间段。';
          }
          return;
        }

        if (!isBookingDateTimeWithinRegistrationWindow(date, slot)) {
          if (bookingMessage) {
            bookingMessage.textContent =
              '预约时间必须在注册满 3 天后至注册后 30 天内。';
          }
          return;
        }

        bookingBtn.disabled = true;

        try {
          await createBookingInSupabase(date, slot, phoneNumber);
          if (bookingMessage) {
            bookingMessage.textContent = '预约已提交，当前状态为待确认。';
          }
          renderMyBookings();
        } catch (error) {
          const message = String(error?.message || '');

          if (/duplicate booking/i.test(message)) {
            if (bookingMessage) {
              bookingMessage.textContent = '这个时间段已经预约过了。';
            }
          } else if (/booking outside registration window/i.test(message)) {
            if (bookingMessage) {
              bookingMessage.textContent =
                '预约时间必须在注册满 3 天后至注册后 30 天内。';
            }
          } else if (/invalid booking date/i.test(message)) {
            if (bookingMessage) {
              bookingMessage.textContent = '预约日期无效。';
            }
          } else {
            if (bookingMessage) {
              bookingMessage.textContent = '预约提交失败，请稍后重试。';
            }
          }
        } finally {
          bookingBtn.disabled = false;
        }
      });
    }

    initConsultSession();
    updateHumanConsultVisibility();
    renderMyBookings();
    initAiChat();

    document.querySelectorAll('[data-tab-link="products"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        tabButtons.forEach((b) => b.classList.remove('tab--active'));
        const productsTab = document.querySelector('[data-tab="products"]');
        if (productsTab) productsTab.classList.add('tab--active');
        tabPanels.forEach((p) => p.classList.remove('tab-panel--active'));
        const productsPanel = document.getElementById('tab-products');
        if (productsPanel) productsPanel.classList.add('tab-panel--active');
      });
    });
  }

  function updateHumanConsultVisibility() {
    const user = loadCurrentUser();
    const buyer = user && isBuyer(user.email);
    const humanSection = document.querySelector('.human-booking-section');
    const myBookingsSection = document.getElementById('my-bookings-section');
    const nonBuyerTip = document.getElementById('non-buyer-tip');

    if (buyer) {
      if (humanSection) humanSection.style.display = '';
      if (myBookingsSection) myBookingsSection.style.display = '';
      if (nonBuyerTip) nonBuyerTip.hidden = true;
    } else {
      if (humanSection) humanSection.style.display = 'none';
      if (myBookingsSection) myBookingsSection.style.display = 'none';
      if (nonBuyerTip) nonBuyerTip.hidden = false;
    }
  }

  function renderMyBookings() {
    const container = document.getElementById('my-bookings-list');
    const user = loadCurrentUser();
    if (!container || !user) return;

    const list = loadBookings().filter((b) => b.userEmail === user.email).reverse();
    if (!list.length) {
      container.innerHTML = '<p class="bookings-empty">暂无预约</p>';
      return;
    }

    container.innerHTML = list.map((b) => {
      const canStart = canStartConsult(b);
      const statusLabels = {
        pending: '待确认',
        confirmed: '已确认',
        completed: '已完成',
        cancelled: '已取消',
      };

      return `<div class="booking-item-card" data-id="${b.id}">
        <span>${b.date} ${b.slot}</span>
        <span>${b.duration || 30} 分钟</span>
        <span>${statusLabels[b.status] || b.status || '待确认'}</span>
        ${canStart ? `<button type="button" class="btn btn-ghost btn-small btn-start-consult" data-id="${b.id}">开始咨询</button>` : ''}
      </div>`;
    }).join('');

    container.querySelectorAll('.btn-start-consult').forEach((btn) => {
      btn.addEventListener('click', () => startConsult(btn.dataset.id, false));
    });
  }

  function canStartConsult(booking) {
    const now = new Date();
    const [date, slot] = [booking.date, booking.slot];
    if (!date || !slot) return false;
    const [startStr] = slot.split('-').map((s) => s.trim());
    const parts = (startStr || '00:00').split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    // Appointment times are fixed PDT (UTC-7), matching the booking rules.
    const start = new Date(
      date + 'T' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00-07:00',
    );
    const end = new Date(start.getTime() + 30 * 60000);
    return now >= start && now <= end;
  }

  function getConsultSession() {
    const raw = localStorage.getItem(STORAGE_KEY_CONSULT_SESSION);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveConsultSession(session) {
    if (session) {
      localStorage.setItem(STORAGE_KEY_CONSULT_SESSION, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY_CONSULT_SESSION);
    }
  }

  let consultTimerInterval = null;

  function initConsultSession() {
    const session = getConsultSession();
    const wrap = document.getElementById('consult-session-wrap');
    const bookingSection = document.querySelector('.human-booking-section');
    const myBookingsSection = document.getElementById('my-bookings-section');

    if (session && session.status === 'active') {
      if (wrap) wrap.hidden = false;
      if (bookingSection) bookingSection.style.display = 'none';
      if (myBookingsSection) myBookingsSection.style.display = 'none';
      startConsultTimer(session);
    } else {
      if (wrap) wrap.hidden = true;
      if (bookingSection) bookingSection.style.display = '';
      if (myBookingsSection) myBookingsSection.style.display = '';
    }

    const btnEnd = document.getElementById('btn-end-consult');
    if (btnEnd) btnEnd.addEventListener('click', endConsult);
  }

  function startConsult(bookingId, isDemo) {
    const user = loadCurrentUser();
    if (!user) return;

    const list = loadBookings();
    const booking = list.find((b) => b.id === bookingId);
    if (!booking) {
      alert('预约不存在。');
      return;
    }
    if (!isDemo && !canStartConsult(booking)) {
      alert('该预约已过期或未到开始时间。');
      return;
    }

    const session = {
      id: 'c' + Date.now(),
      bookingId,
      userEmail: user.email,
      startTime: new Date().toISOString(),
      status: 'active',
    };

    saveConsultSession(session);

    const wrap = document.getElementById('consult-session-wrap');
    const bookingSection = document.querySelector('.human-booking-section');
    const myBookingsSection = document.getElementById('my-bookings-section');
    if (wrap) wrap.hidden = false;
    if (bookingSection) bookingSection.style.display = 'none';
    if (myBookingsSection) myBookingsSection.style.display = 'none';

    startConsultTimer(session);
  }

  function startConsultTimer(session) {
    if (consultTimerInterval) clearInterval(consultTimerInterval);

    const update = () => {
      const start = new Date(session.startTime).getTime();
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;

      const timerEl = document.getElementById('consult-timer');
      const statusEl = document.getElementById('consult-status');
      if (timerEl) timerEl.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');

      if (mins >= CONSULT_MAX_MINUTES) {
        clearInterval(consultTimerInterval);
        consultTimerInterval = null;
        endConsult();
        alert('本次咨询已达到 30 分钟，咨询已结束。');
        return;
      }

      if (statusEl) {
        statusEl.textContent = '咨询进行中 · 会议时长 30 分钟';
      }
    };

    update();
    consultTimerInterval = setInterval(update, 1000);
  }

  function endConsult() {
    if (consultTimerInterval) {
      clearInterval(consultTimerInterval);
      consultTimerInterval = null;
    }
    const session = getConsultSession();
    if (session) {
      session.status = 'ended';
      saveConsultSession(null);
    }

    const wrap = document.getElementById('consult-session-wrap');
    const bookingSection = document.querySelector('.human-booking-section');
    const myBookingsSection = document.getElementById('my-bookings-section');
    if (wrap) wrap.hidden = true;
    if (bookingSection) bookingSection.style.display = '';
    if (myBookingsSection) myBookingsSection.style.display = '';
    renderMyBookings();
  }

  function loadAiFaq() {
    const raw = localStorage.getItem(STORAGE_KEY_AI_FAQ);
    if (!raw) return getDefaultAiFaq();
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) && list.length ? list : getDefaultAiFaq();
    } catch {
      return getDefaultAiFaq();
    }
  }

  function getDefaultAiFaq() {
    return [
      { q: '提现|佣金|余额', a: '累计佣金满 ￥0.05 可申请提现。在「佣金与善缘值」页点击「申请提现」即可。' },
      { q: '邀请|推荐|下线|团队', a: '分享你的专属链接给好友，对方通过链接注册即成为你的下线。在「团队」页可查看下级结构。' },
      { q: '善缘值|善缘|积分', a: '善缘值可用于参与不同类型及不同等级的专属活动，具体资格以相关活动规则为准。' },
      { q: '预约|真人|顾问', a: '如需真人顾问，可在此页下方选择日期和时间段提交预约。' },
    ];
  }

  function getAiReply(question) {
    const faq = loadAiFaq();
    const q = question.trim().toLowerCase();
    for (const item of faq) {
      const keywords = item.q.split('|');
      if (keywords.some((k) => q.includes(k.trim().toLowerCase()))) {
        return item.a;
      }
    }
    return '感谢您的提问。若以上未解答，可尝试：1) 在「团队」页查看邀请规则；2) 在「佣金与善缘值」页查看提现说明；3) 需要真人顾问时，请点击下方预约。';
  }

  function saveAiChatRecord(question, answer) {
    const raw = localStorage.getItem(STORAGE_KEY_AI_CHAT);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({ q: question, a: answer, t: new Date().toISOString() });
    if (list.length > 100) list.length = 100;
    localStorage.setItem(STORAGE_KEY_AI_CHAT, JSON.stringify(list));
  }

  function appendAiMessage(text, isUser) {
    if (!aiChatMessages) return;
    const div = document.createElement('div');
    div.className = 'ai-msg ' + (isUser ? 'ai-msg-user' : 'ai-msg-bot');
    div.textContent = text;
    aiChatMessages.appendChild(div);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
  }

  function initAiChat() {
    if (!aiChatMessages) return;
    aiChatMessages.innerHTML = '';
    appendAiMessage('你好，我是 AI 咨询助手。请问有什么可以帮您？', false);

    const send = () => {
      const text = (aiChatInput && aiChatInput.value || '').trim();
      if (!text) return;
      appendAiMessage(text, true);
      if (aiChatInput) aiChatInput.value = '';
      const reply = getAiReply(text);
      appendAiMessage(reply, false);
      saveAiChatRecord(text, reply);
    };

    if (btnAiSend) btnAiSend.addEventListener('click', send);
    if (aiChatInput) aiChatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  }

  function recalculateAllPoints() {
    if (supabaseClient) return;
    if (localStorage.getItem(STORAGE_KEY_POINTS_MIGRATION)) return;
    const allUsers = loadUsers();
    const orders = loadOrders();

    allUsers.forEach((u) => { u.points = 0; });

    allUsers.forEach((u) => {
      if (u.parentReferral) {
        const parent = allUsers.find((p) => p.referralCode === u.parentReferral);
        if (parent) parent.points = Math.round((parent.points || 0) + POINTS_PER_REGISTRATION);
      }
    });

    orders.forEach((order) => {
      const buyer = allUsers.find((u) => u.email === order.buyerEmail);
      if (!buyer || !buyer.parentReferral) return;
      const directParent = allUsers.find(
        (u) => u.referralCode === buyer.parentReferral,
      );
      if (!directParent) return;
      directParent.points =
        Math.round(directParent.points || 0) + POINTS_PER_DIRECT_PURCHASE;
    });

    saveUsers(allUsers);
    localStorage.setItem(STORAGE_KEY_POINTS_MIGRATION, '1');
  }

  function getCommissionBreakdown(user) {
    const records = loadCommissionRecords();
    const breakdown = {};

    records.forEach((item) => {
      const key = `${item.buyerEmail || ''}-${item.level || 0}`;
      if (!breakdown[key]) {
        breakdown[key] = {
          buyerEmail: item.buyerEmail || '',
          buyerCode: item.buyerCode || '',
          commission: 0,
          level: item.level || 0,
        };
      }
      breakdown[key].commission += Number(item.commission || 0);
    });

    return Object.values(breakdown).sort(
      (a, b) => b.commission - a.commission,
    );
  }

  function updateWalletSummary(user) {
    const myCodeEl = document.getElementById('wallet-my-code');
    const parentCodeEl = document.getElementById('wallet-parent-code');
    const totalCommissionEl = document.getElementById('wallet-total-commission');
    const breakdownEl = document.getElementById('wallet-commission-breakdown');
    const balanceEl = document.getElementById('wallet-balance');
    const pointsEl = document.getElementById('wallet-points');
    const shareInputEl = document.getElementById('wallet-share-link');

    if (myCodeEl) {
      myCodeEl.textContent = user.referralCode || '—';
    }

    if (parentCodeEl) {
      parentCodeEl.textContent = user.parentReferral || '—';
    }

    if (totalCommissionEl) {
      const total = typeof user.totalCommission === 'number' ? user.totalCommission : 0;
      totalCommissionEl.textContent = `￥${total.toFixed(2)}`;
    }

    if (breakdownEl) {
      const items = getCommissionBreakdown(user);
      if (!items.length) {
        breakdownEl.innerHTML = '';
      } else {
        breakdownEl.innerHTML = items.map((item) => {
          const label = item.buyerCode ? `${item.buyerCode}（${item.level}级）` : `${item.buyerEmail}（${item.level}级）`;
          return `<div class="commission-breakdown-item">${label}<span class="commission-breakdown-amount">￥${item.commission.toFixed(2)}</span></div>`;
        }).join('');
      }
    }

    if (balanceEl) {
      const balance = typeof user.commissionBalance === 'number' ? user.commissionBalance : 0;
      balanceEl.textContent = `￥${balance.toFixed(2)}`;
    }

    if (pointsEl) {
      const pts = typeof user.points === 'number' ? user.points : 0;
      pointsEl.textContent = `${pts.toFixed(0)} 缘`;
    }

    if (shareInputEl) {
      const baseUrl = window.location.href.split('?')[0];
      const ref = encodeURIComponent(user.referralCode || '');
      const link = ref ? `${baseUrl}?ref=${ref}` : baseUrl;
      shareInputEl.value = link;
    }

    const statsEl = document.getElementById('wallet-stats');
    if (statsEl) {
      const allUsers = loadUsers();
      const direct = allUsers.filter((u) => u.parentReferral === user.referralCode).length;
      const total = countDescendants(user.referralCode, allUsers);
      const now = new Date();
      const thisMonth = allUsers.filter((u) => {
        const created = u.createdAt ? new Date(u.createdAt) : null;
        return created && created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth() && u.parentReferral === user.referralCode;
      }).length;
      statsEl.textContent = `直推 ${direct} 人 · 下级共 ${total} 人${thisMonth > 0 ? ' · 本月新增 ' + thisMonth + ' 人' : ''}`;
    }

    const withdrawHistoryEl = document.getElementById('withdraw-history');
    if (withdrawHistoryEl) {
      const withdrawals = loadWithdrawals().filter((w) => w.email === user.email);
      if (!withdrawals.length) {
        withdrawHistoryEl.innerHTML = '<span class="wallet-subtext">暂无提现记录</span>';
      } else {
        const statusLabels = {
          pending: '待审核',
          approved: '已批准',
          paid: '已支付',
          rejected: '已拒绝',
        };

        withdrawHistoryEl.innerHTML = withdrawals.slice(0, 10).map((w) =>
          `<div class="withdraw-item">￥${w.amount.toFixed(2)} · ${statusLabels[w.status] || w.status || '待审核'} · ${formatDate(w.createdAt)}</div>`
        ).join('');
      }
    }

    updateShareAnnouncement();
  }

  function countDescendants(code, allUsers) {
    const children = allUsers.filter((u) => u.parentReferral === code);
    return children.length + children.reduce((sum, c) => sum + countDescendants(c.referralCode, allUsers), 0);
  }

  function loadWithdrawals() {
    const raw = localStorage.getItem(STORAGE_KEY_WITHDRAWALS);
    if (!raw) return [];
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function saveWithdrawals(list) {
    localStorage.setItem(STORAGE_KEY_WITHDRAWALS, JSON.stringify(list));
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function loadAnnouncement() {
    const raw = localStorage.getItem(STORAGE_KEY_ANNOUNCEMENT);
    if (!raw) return { text: '', image: null };
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.text === 'string') {
        return { text: parsed.text, image: parsed.image || null };
      }
    } catch {}
    return { text: raw, image: null };
  }

  function updateShareAnnouncement() {
    const el = document.getElementById('share-announcement');
    if (!el) return;
    const data = loadAnnouncement();
    const text = data.text || '此处由管理员后台发布与修改，暂无公告时显示此提示。';
    const escaped = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br>');
    if (data.image) {
      el.innerHTML = `<img src="${data.image}" alt="公告图片" class="announcement-image" />${text ? `<div class="announcement-text">${escaped(text)}</div>` : ''}`;
    } else {
      el.textContent = text;
    }
  }

  function initRefFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && referralInput) {
      referralInput.value = decodeURIComponent(ref);
    }
  }

  function renderMyOrders() {
    const container = document.getElementById('my-orders-list');
    if (!container) return;
    const user = loadCurrentUser();
    const orders = loadOrders().filter((o) => o.buyerEmail === (user && user.email));
    if (!orders.length) {
      container.innerHTML = '<p class="orders-empty">暂无订单</p>';
      return;
    }

    container.innerHTML = orders.map((o) => {
      return `<div class="order-item">
        <span class="order-product">${(o.productName || '商品').replace(/</g, '&lt;')}</span>
        <span class="order-price">￥${(o.price || 0).toFixed(2)}</span>
        <span class="order-date">${formatDate(o.createdAt)}</span>
      </div>`;
    }).join('');
  }

  function initFromStorage() {
    const user = loadCurrentUser();
    if (!user) return;

    showMainScreen();
    updateWalletSummary(user);
    renderMyOrders();
    initNetworkPanel();
  }

  async function initFromSupabaseSession() {
    if (!supabaseClient) {
      initFromStorage();
      return;
    }

    try {
      const {
        data: { session },
        error,
      } = await supabaseClient.auth.getSession();

      if (error || !session?.user) {
        localStorage.removeItem(STORAGE_KEY_USER);
        showAuthScreen();
        return;
      }

      const [allUsers] = await Promise.all([
        syncProfilesFromSupabase(),
        syncOrdersFromSupabase(),
        syncCommissionsFromSupabase(),
        syncWithdrawalsFromSupabase(),
        syncBookingsFromSupabase(),
        syncCartFromSupabase(),
        syncProductsFromSupabase(),
      ]);
      const user = allUsers.find((item) => item.id === session.user.id);

      if (!user) {
        localStorage.removeItem(STORAGE_KEY_USER);
        showAuthScreen();
        return;
      }

      saveCurrentUser(user);
      showMainScreen();
      updateWalletSummary(user);
      renderProducts();
      renderMyOrders();
      renderCart();
      initNetworkPanel();
    } catch (error) {
      console.error('Session restore error:', error);
      showAuthScreen();
    }
  }

  const copyShareBtn = document.getElementById('btn-copy-share-link');
  if (copyShareBtn) {
    copyShareBtn.addEventListener('click', () => {
      const input = document.getElementById('wallet-share-link');
      if (!input || !input.value) return;

      const text = input.value;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          () => {
            alert('已复制分享链接，可以粘贴给好友。');
          },
          () => {
            alert('复制失败，请手动选择文本后复制。');
          },
        );
      } else {
        input.select();
        document.execCommand('copy');
        alert('已尝试复制分享链接，如未成功，请手动选择文本复制。');
      }
    });
  }

  const MAX_NETWORK_DEPTH = 5; // 普通用户最多看到 5 级下线

  function getDirectChildren(parentCode, allUsers) {
    return allUsers.filter((u) => u.parentReferral === parentCode);
  }

  function buildNetworkTree(parentCode, allUsers, depth) {
    if (depth >= MAX_NETWORK_DEPTH) return [];
    const children = getDirectChildren(parentCode, allUsers);
    return children.map((u) => {
      const childTree = buildNetworkTree(u.referralCode, allUsers, depth + 1);
      const directCount = childTree.length;
      const totalCount = directCount + childTree.reduce((sum, c) => sum + (c.totalCount || 0), 0);
      return {
        user: u,
        children: childTree,
        directCount,
        totalCount,
      };
    });
  }

  function nodeMatchesSearch(node, search) {
    if (!search || !search.trim()) return true;
    const q = search.trim().toLowerCase();
    const code = (node.user.referralCode || '').toLowerCase();
    const email = (node.user.email || '').toLowerCase();
    return code.includes(q) || email.includes(q);
  }

  function nodeOrDescendantMatches(node, search) {
    if (!search || !search.trim()) return true;
    if (nodeMatchesSearch(node, search)) return true;
    return node.children.some((c) => nodeOrDescendantMatches(c, search));
  }

  function filterTreeBySearch(tree, search) {
    if (!search || !search.trim()) return tree;
    return tree.filter((node) => nodeOrDescendantMatches(node, search));
  }

  function renderNetworkNode(node, depth, expandedSet) {
    const levelLabel = depth === 0 ? '直推' : `第 ${depth + 1} 级`;
    const hasChildren = node.children.length > 0;
    const directCount = node.directCount || 0;
    const totalCount = node.totalCount || 0;
    const isExpanded = expandedSet.has(node.user.referralCode);
    const stats = hasChildren ? `直推 ${directCount} 人 · 下级共 ${totalCount} 人` : '';

    let html = `<div class="network-tree-node" data-depth="${depth}" data-code="${(node.user.referralCode || '').replace(/"/g, '&quot;')}">
      <div class="network-node-content">
        <button type="button" class="network-node-toggle" aria-label="${isExpanded ? '收起' : '展开'}" ${!hasChildren ? 'disabled' : ''}>
          <span class="network-node-chevron ${isExpanded ? 'expanded' : ''}">${hasChildren ? '▸' : ''}</span>
        </button>
        <div class="network-node-info">
          <span class="network-node-code">${node.user.referralCode}</span>
          <span class="network-node-email">${node.user.email}</span>
          <span class="network-node-level">${levelLabel}</span>
          ${stats ? `<span class="network-node-stats">${stats}</span>` : ''}
        </div>
      </div>`;
    if (hasChildren) {
      const childHtml = node.children
        .map((c) => renderNetworkNode(c, depth + 1, expandedSet))
        .join('');
      html += `<div class="network-tree-children ${isExpanded ? '' : 'collapsed'}">${childHtml}</div>`;
    }
    return html;
  }

  function renderNetwork(currentUser, searchQuery, expandedSet) {
    const container = document.getElementById('network-list');
    if (!container || !currentUser) return;

    const allUsers = loadUsers();
    let tree = buildNetworkTree(currentUser.referralCode, allUsers, 0);
    tree = filterTreeBySearch(tree, searchQuery);

    if (!tree.length) {
      container.innerHTML = '<div class="network-empty">暂无下线，分享链接邀请好友注册即可。</div>';
      return;
    }

    const parts = [
      '<p class="network-tip">仅展示你下面最多 5 级，再往下仅管理员可见。</p>',
      ...tree.map((node) => renderNetworkNode(node, 0, expandedSet)),
    ];
    container.innerHTML = parts.join('');

    container.querySelectorAll('.network-node-toggle:not([disabled])').forEach((btn) => {
      btn.addEventListener('click', () => {
        const node = btn.closest('.network-tree-node');
        const code = node && node.dataset && node.dataset.code;
        if (!code) return;
        if (expandedSet.has(code)) {
          expandedSet.delete(code);
        } else {
          expandedSet.add(code);
        }
        renderNetwork(currentUser, searchQuery, expandedSet);
      });
    });
  }

  let networkExpandedSet = new Set();
  let networkSearchQuery = '';

  function expandMatchingPaths(tree, search, set) {
    tree.forEach((node) => {
      if (nodeOrDescendantMatches(node, search)) {
        set.add(node.user.referralCode);
        expandMatchingPaths(node.children, search, set);
      }
    });
  }

  function initNetworkPanel() {
    const currentUser = loadCurrentUser();
    if (!currentUser) return;

    const searchInput = document.getElementById('network-search');
    if (searchInput) {
      searchInput.value = networkSearchQuery;
      if (!searchInput.dataset.listenerAdded) {
        searchInput.dataset.listenerAdded = '1';
        searchInput.addEventListener('input', () => {
        networkSearchQuery = searchInput.value;
        if (networkSearchQuery.trim()) {
          const tree = buildNetworkTree(currentUser.referralCode, loadUsers(), 0);
          networkExpandedSet = new Set();
          expandMatchingPaths(tree, networkSearchQuery, networkExpandedSet);
        } else {
          networkExpandedSet = new Set();
        }
        renderNetwork(currentUser, networkSearchQuery, networkExpandedSet);
        });
      }
    }

    const allUsers = loadUsers();
    const tree = buildNetworkTree(currentUser.referralCode, allUsers, 0);
    if (networkSearchQuery.trim()) {
      networkExpandedSet = new Set();
      expandMatchingPaths(tree, networkSearchQuery, networkExpandedSet);
    } else {
      networkExpandedSet = new Set();
    }

    renderNetwork(currentUser, networkSearchQuery, networkExpandedSet);
  }

  // 使用事件委托，确保登录按钮在各种加载场景下都能响应
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('#btn-login')) {
      e.preventDefault();
      handleAuth();
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (supabaseClient) {
        await supabaseClient.auth.signOut();
      }
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem(STORAGE_KEY_CART);
      updateCartCount();
      renderCart();
      showAuthScreen();
    });
  }

  const resetDemoBtn = document.getElementById('btn-reset-demo');
  if (resetDemoBtn) {
    resetDemoBtn.addEventListener('click', () => {
      if (!confirm('确定要清空所有本地 Demo 数据吗？将清除用户、订单、预约等，无法恢复。')) return;
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem(STORAGE_KEY_USERS);
      localStorage.removeItem(STORAGE_KEY_BOOKINGS);
      localStorage.removeItem(STORAGE_KEY_ANNOUNCEMENT);
      localStorage.removeItem(STORAGE_KEY_PRODUCTS);
      localStorage.removeItem(STORAGE_KEY_ORDERS);
      localStorage.removeItem(STORAGE_KEY_COMMISSIONS);
      localStorage.removeItem(STORAGE_KEY_WITHDRAWALS);
      localStorage.removeItem(STORAGE_KEY_AI_FAQ);
      localStorage.removeItem(STORAGE_KEY_AI_CHAT);
      localStorage.removeItem(STORAGE_KEY_CONSULT_SESSION);
      localStorage.removeItem(STORAGE_KEY_POINTS_MIGRATION);
      alert('已清空本地数据，页面即将刷新。');
      window.location.reload();
    });
  }

  recalculateAllPoints();
  const currentUser = loadCurrentUser();
  if (currentUser) {
    const allUsers = loadUsers();
    const updated = allUsers.find((u) => u.email === currentUser.email);
    if (updated) saveCurrentUser(updated);
  }
  initRefFromUrl();

  const togglePwdBtn = document.getElementById('btn-toggle-password');
  const pwdInput = document.getElementById('auth-password');
  if (togglePwdBtn && pwdInput) {
    togglePwdBtn.addEventListener('click', () => {
      const isHidden = pwdInput.type === 'password';
      pwdInput.type = isHidden ? 'text' : 'password';
      togglePwdBtn.querySelector('.toggle-text').textContent = isHidden ? '隐藏' : '显示';
      togglePwdBtn.title = isHidden ? '隐藏密码' : '显示密码';
    });
  }

  const forgotBtn = document.getElementById('btn-forgot-password');
  const loginFormWrap = document.getElementById('login-form-wrap');
  const forgotPanel = document.getElementById('forgot-password-panel');
  const backLoginBtn = document.getElementById('btn-back-login');
  const submitResetBtn = document.getElementById('btn-submit-reset');
  const resetMessage = document.getElementById('reset-message');
  const resetEmailInput = document.getElementById('reset-email');
  const resetPwdInput = document.getElementById('reset-password');
  const resetPwdConfirmInput = document.getElementById('reset-password-confirm');

  if (forgotBtn && loginFormWrap && forgotPanel) {
    forgotBtn.addEventListener('click', () => {
      loginFormWrap.hidden = true;
      forgotPanel.hidden = false;
      if (resetMessage) resetMessage.textContent = '';
    });
  }

  if (backLoginBtn && loginFormWrap && forgotPanel) {
    backLoginBtn.addEventListener('click', () => {
      forgotPanel.hidden = true;
      loginFormWrap.hidden = false;
      if (resetEmailInput) resetEmailInput.value = '';
      if (resetPwdInput) resetPwdInput.value = '';
      if (resetPwdConfirmInput) resetPwdConfirmInput.value = '';
      if (resetMessage) resetMessage.textContent = '';
    });
  }

  if (submitResetBtn && resetEmailInput && resetMessage) {
    submitResetBtn.addEventListener('click', async () => {
      const email = resetEmailInput.value.trim().toLowerCase();

      if (!email) {
        resetMessage.textContent = '请输入邮箱。';
        return;
      }

      if (!supabaseClient) {
        resetMessage.textContent = '密码重置服务暂时不可用。';
        return;
      }

      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      resetMessage.textContent = error
        ? (error.message || '发送失败，请稍后重试。')
        : '密码重置邮件已发送，请检查邮箱。';
    });
  }

  initTabs();
  renderProducts();
  renderCart();
  initPurchaseModal();
  initBooking();
  initFromSupabaseSession();
});
