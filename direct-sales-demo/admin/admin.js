document.addEventListener('DOMContentLoaded', async () => {
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

  const adminCache = {
    users: [],
    orders: [],
    bookings: [],
    withdrawals: [],
    commissions: [],
  };

  const STORAGE_ANNOUNCEMENT = 'huiwen_demo_announcement';
  let announcementPendingImage = null;

  function compressImage(file, maxSize, quality) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality || 0.7));
        } catch {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      };
      img.src = url;
    });
  }

  window.saveAnnouncementClick = function () {
    const textEl = document.getElementById('admin-announcement');
    const text = String(textEl && textEl.value ? textEl.value : '').trim();
    const image = announcementPendingImage;

    try {
      const data = { text, image };
      const json = JSON.stringify(data);
      if (json.length > 4 * 1024 * 1024) {
        alert('保存失败：内容过大（含图片约 ' + Math.round(json.length / 1024) + 'KB），请使用较小的图片。');
        return;
      }
      localStorage.setItem(STORAGE_ANNOUNCEMENT, json);
    } catch (err) {
      if (err.name === 'QuotaExceededError' || err.code === 22) {
        alert('保存失败：存储空间不足，请删除部分商品图片或使用较小的公告图片。');
      } else {
        alert('保存失败：' + (err.message || err));
      }
      return;
    }

    const recordEl = document.getElementById('announcement-record-content');
    if (recordEl) {
      try {
        if (!text && !image) {
          recordEl.innerHTML = '<span class="announcement-record-empty">暂无公告</span>';
        } else {
          let html = '';
          if (image) html += '<img src="' + image.replace(/"/g, '&quot;') + '" alt="公告图片" class="announcement-record-img" />';
          if (text) html += '<div class="announcement-record-text">' + String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br>') + '</div>';
          recordEl.innerHTML = html;
        }
      } catch (e) {
        recordEl.textContent = text || '(已保存，预览显示异常)';
      }
    }
    alert('保存成功！');
  };

  const STORAGE_ADMIN_PWD = 'huiwen_demo_admin_pwd';
  const STORAGE_USERS = 'huiwen_demo_users';
  const STORAGE_PRODUCTS = 'huiwen_demo_products';
  const STORAGE_BOOKINGS = 'huiwen_demo_bookings';
  const STORAGE_ORDERS = 'huiwen_demo_orders';
  const STORAGE_WITHDRAWALS = 'huiwen_demo_withdrawals';
  const STORAGE_AI_FAQ = 'huiwen_demo_ai_faq';
  const STORAGE_AI_CHAT = 'huiwen_demo_ai_chat';
  const STORAGE_VERIFICATION = 'huiwen_demo_verification';

  const DELIVERY_API_URL = ''; // 配置后发货时自动发邮件给客户，如 'http://localhost:3001'

  function loadUsers() {
    return adminCache.users;
  }

  function loadOrdersAdmin() {
    return adminCache.orders;
  }

  function loadBookingsAdmin() {
    return adminCache.bookings;
  }

  function loadWithdrawalsAdmin() {
    return adminCache.withdrawals;
  }

  async function refreshAdminData() {
    if (!supabaseClient) throw new Error('Supabase unavailable');

    const { data, error } = await supabaseClient.rpc('admin_get_dashboard_data');
    if (error) throw error;

    const payload = data || {};

    adminCache.users = (payload.users || []).map((u) => ({
      id: u.id,
      email: u.email,
      referralCode: u.referral_code,
      parentReferral: u.parent_referral,
      totalCommission: Number(u.total_commission || 0),
      commissionBalance: Number(u.commission_balance || 0),
      points: Number(u.points || 0),
      createdAt: u.created_at,
    }));

    adminCache.orders = (payload.orders || []).map((o) => ({
      id: o.id,
      paypalOrderId: o.paypal_order_id,
      buyerEmail: o.buyer_email,
      buyerName: o.buyer_name || '',
      buyerDob: o.buyer_dob || '',
      buyerCountry: o.buyer_country || '',
      buyerGender: o.buyer_gender || '',
      productId: o.product_id,
      productName: o.product_name,
      price: Number(o.price || 0),
      paymentStatus: o.payment_status || '',
      shipped: Boolean(o.shipped),
      createdAt: o.created_at,
    }));

    adminCache.bookings = (payload.bookings || []).map((b) => ({
      id: b.id,
      userEmail: b.user_email,
      date: b.booking_date,
      slot: b.booking_slot,
      duration: Number(b.duration_minutes || 120),
      status: b.status || 'pending',
      notes: b.notes || '',
      createdAt: b.created_at,
    }));

    adminCache.withdrawals = (payload.withdrawals || []).map((w) => ({
      id: w.id,
      email: w.email,
      amount: Number(w.amount || 0),
      status: w.status || 'pending',
      createdAt: w.created_at,
    }));

    adminCache.commissions = payload.commissions || [];
  }

  async function checkAdminAccess() {
    if (!supabaseClient) return false;
    const { data, error } = await supabaseClient.rpc('admin_check_access');
    if (error) return false;
    return Boolean(data);
  }


  const DEFAULT_PRODUCTS = [
    { id: 'p1', name: '静心山水 · 电子图片', price: 19, stock: 99, desc: '柔和山水意境，适合做手机壁纸、冥想背景图。' },
    { id: 'p2', name: '东方禅意 · 电子图片', price: 29, stock: 99, desc: '极简线条与留白，适合做网络头像、社交封面。' },
    { id: 'p3', name: '城市夜景 · 电子图片', price: 39, stock: 99, desc: '高对比夜色光影，适合作为电脑桌面或宣传素材。' },
  ];

  const loginScreen = document.getElementById('admin-login');
  const mainScreen = document.getElementById('admin-main');
  const setupForm = document.getElementById('setup-form');
  const loginForm = document.getElementById('login-form');
  const setupPasswordInput = document.getElementById('setup-password');
  const adminPasswordInput = document.getElementById('admin-password');
  const btnSetup = document.getElementById('btn-setup');
  const btnAdminLogin = document.getElementById('btn-admin-login');
  const btnAdminLogout = document.getElementById('btn-admin-logout');

  function loadVerificationConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_VERIFICATION);
      if (!raw) return {};
      const o = JSON.parse(raw);
      return {
        url: o.url || '',
        param: o.param || 'code',
        api: o.api || '',
        apiKey: o.apiKey || '',
      };
    } catch {
      return {};
    }
  }

  function saveVerificationConfig(cfg) {
    localStorage.setItem(STORAGE_VERIFICATION, JSON.stringify(cfg));
  }

  function loadProducts() {
    const raw = localStorage.getItem(STORAGE_PRODUCTS);
    if (!raw) return DEFAULT_PRODUCTS;
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) && list.length ? list : DEFAULT_PRODUCTS;
    } catch {
      return DEFAULT_PRODUCTS;
    }
  }

  function saveProducts(products) {
    localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(products));
  }

  async function showMain() {
    loginScreen.classList.remove('admin-screen--active');
    loginScreen.hidden = true;
    mainScreen.classList.remove('admin-screen--active');
    mainScreen.hidden = false;
    mainScreen.classList.add('admin-screen--active');

    await refreshAdminData();

    renderProductsPanel();
    renderOrdersPanel();
    renderUsersPanel();
    renderAnnouncementPanel();
    renderAiConsultPanel();
    renderBookingsPanel();
  }

  function showLogin() {
    mainScreen.classList.remove('admin-screen--active');
    mainScreen.hidden = true;
    loginScreen.classList.add('admin-screen--active');
    loginScreen.hidden = false;
    if (adminPasswordInput) adminPasswordInput.value = '';
  }

  if (setupForm) setupForm.hidden = true;
  if (loginForm) loginForm.hidden = false;

  const adminEmailInput =
    document.getElementById('admin-email') ||
    (() => {
      const label = document.createElement('label');
      label.className = 'field';
      const caption = document.createElement('span');
      caption.className = 'field-label';
      caption.textContent = '管理员邮箱';
      const input = document.createElement('input');
      input.id = 'admin-email';
      input.type = 'email';
      input.className = 'field-input';
      input.placeholder = '请输入管理员邮箱';
      label.appendChild(caption);
      label.appendChild(input);
      loginForm?.insertBefore(label, loginForm.firstChild);
      return input;
    })();

  async function checkAdminAuth() {
    if (!supabaseClient) {
      alert('Supabase 未加载。请使用线上管理后台。');
      showLogin();
      return;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session?.user) {
      showLogin();
      return;
    }

    if (await checkAdminAccess()) {
      await showMain();
      return;
    }

    await supabaseClient.auth.signOut();
    alert('此账号没有管理员权限。');
    showLogin();
  }

  if (btnAdminLogin) {
    btnAdminLogin.addEventListener('click', async () => {
      const email = (adminEmailInput?.value || '').trim().toLowerCase();
      const password = (adminPasswordInput?.value || '').trim();

      if (!email || !password) {
        alert('请输入管理员邮箱和密码。');
        return;
      }

      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        alert('登录失败，请检查邮箱和密码。');
        return;
      }

      if (!(await checkAdminAccess())) {
        await supabaseClient.auth.signOut();
        alert('此账号没有管理员权限。');
        return;
      }

      await showMain();
    });
  }

  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', async () => {
      if (supabaseClient) await supabaseClient.auth.signOut();
      showLogin();
    });
  }


  const navBtns = document.querySelectorAll('.admin-nav-btn');
  const panels = document.querySelectorAll('.admin-panel');

  navBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.panel;
      navBtns.forEach((b) => b.classList.remove('admin-nav-btn--active'));
      btn.classList.add('admin-nav-btn--active');
      panels.forEach((p) => {
        p.classList.toggle('admin-panel--active', p.id === `panel-${target}`);
      });
      if (target === 'users') renderUsersPanel();
      if (target === 'orders') renderOrdersPanel();
    });
  });

  function renderProductsPanel() {
    const container = document.getElementById('product-list-admin');
    if (!container) return;

    const products = loadProducts();
    container.innerHTML = products
      .map(
        (p) => `
      <div class="product-item-admin" data-id="${p.id}">
        <div class="product-thumb-admin ${p.image ? '' : 'placeholder'}">
          ${p.image ? `<img src="${p.image}" alt="" />` : ''}
        </div>
        <div>
          <span class="name">${p.name}</span>
          <span class="price">￥${p.price}</span>
          <span class="stock">库存 ${p.stock ?? '—'}</span>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-ghost btn-small btn-edit-product">编辑</button>
          <button type="button" class="btn btn-ghost btn-small btn-delete-product">删除</button>
        </div>
      </div>
    `,
      )
      .join('');

    container.querySelectorAll('.btn-edit-product').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.product-item-admin');
        const id = item.dataset.id;
        const p = products.find((x) => x.id === id);
        if (!p) return;
        openProductModal(p);
      });
    });

    container.querySelectorAll('.btn-delete-product').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.product-item-admin');
        const id = item.dataset.id;
        if (!confirm('确定删除该商品？')) return;
        const newList = products.filter((x) => x.id !== id);
        saveProducts(newList);
        renderProductsPanel();
      });
    });
  }

  const modal = document.getElementById('product-modal');
  const modalName = document.getElementById('modal-product-name');
  const modalPrice = document.getElementById('modal-product-price');
  const modalStock = document.getElementById('modal-product-stock');
  const modalDesc = document.getElementById('modal-product-desc');
  const modalImageInput = document.getElementById('modal-product-image');
  const modalImagePreview = document.getElementById('modal-image-preview');
  const btnModalCancel = document.getElementById('btn-modal-cancel');
  const btnModalSave = document.getElementById('btn-modal-save');

  let editingProductId = null;
  let pendingImageData = null; // 新选中的图片 base64
  let imageClearedByUser = false; // 用户点击清除图片

  function setImagePreview(dataUrl) {
    if (!modalImagePreview) return;
    pendingImageData = dataUrl;
    imageClearedByUser = dataUrl === null;
    if (dataUrl) {
      modalImagePreview.innerHTML = `<img src="${dataUrl}" alt="预览" />`;
      modalImagePreview.classList.add('has-image');
    } else {
      modalImagePreview.innerHTML = '无图片';
      modalImagePreview.classList.remove('has-image');
    }
  }

  function openProductModal(product) {
    editingProductId = product ? product.id : null;
    modalName.value = product ? product.name : '';
    modalPrice.value = product ? product.price : '';
    modalStock.value = product && typeof product.stock === 'number' ? product.stock : '';
    modalDesc.value = product ? product.desc : '';
    if (modalImageInput) modalImageInput.value = '';
    imageClearedByUser = false;
    pendingImageData = product && product.image ? product.image : null;
    setImagePreview(pendingImageData);
    modal.hidden = false;
  }

  function closeProductModal() {
    modal.hidden = true;
    editingProductId = null;
    pendingImageData = null;
    imageClearedByUser = false;
  }

  const btnAddProduct = document.getElementById('btn-add-product');
  if (btnAddProduct) {
    btnAddProduct.addEventListener('click', () => openProductModal(null));
  }

  if (modal) {
    const backdrop = modal.querySelector('.modal-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeProductModal);
  }
  if (btnModalCancel) btnModalCancel.addEventListener('click', closeProductModal);

  if (modalImageInput) {
    modalImageInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      imageClearedByUser = false;
      try {
        const compressed = await compressImage(file, 400, 0.7);
        setImagePreview(compressed);
      } catch {
        const reader = new FileReader();
        reader.onload = () => setImagePreview(reader.result);
        reader.readAsDataURL(file);
      }
    });
  }
  if (modalImagePreview) {
    modalImagePreview.addEventListener('click', () => {
      setImagePreview(null);
      if (modalImageInput) modalImageInput.value = '';
    });
  }

  btnModalSave.addEventListener('click', () => {
    const name = modalName.value.trim();
    const price = parseFloat(modalPrice.value);
    const stockRaw = modalStock?.value;
    const stock = stockRaw === '' || stockRaw === undefined ? undefined : Math.max(0, parseInt(stockRaw, 10) || 0);
    const desc = modalDesc.value.trim();

    if (!name) {
      alert('请输入商品名称。');
      return;
    }
    if (isNaN(price) || price < 0) {
      alert('请输入有效价格。');
      return;
    }

    const products = loadProducts();
    let image;
    if (imageClearedByUser) {
      image = null;
    } else if (pendingImageData) {
      image = pendingImageData;
    } else if (editingProductId) {
      image = products.find((p) => p.id === editingProductId)?.image ?? null;
    } else {
      image = null;
    }

    if (editingProductId) {
      const idx = products.findIndex((p) => p.id === editingProductId);
      if (idx >= 0) {
        products[idx] = { ...products[idx], name, price, desc, image: image || undefined };
        if (stock !== undefined) products[idx].stock = stock;
      }
    } else {
      const maxId = products.reduce((max, p) => {
        const n = parseInt(String(p.id).replace(/\D/g, ''), 10) || 0;
        return Math.max(max, n);
      }, 0);
      const newId = `p${maxId + 1}`;
      products.push({ id: newId, name, price, stock: stock ?? 0, desc, image: image || undefined });
    }

    saveProducts(products);
    closeProductModal();
    renderProductsPanel();
  });

  function getDirectChildren(parentCode, users) {
    return users.filter((u) => u.parentReferral === parentCode);
  }

  function buildFullTree(parentCode, users, depth) {
    const children = getDirectChildren(parentCode, users);
    return children.map((u) => {
      const childTree = buildFullTree(u.referralCode, users, depth + 1);
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

  function parseSearchQuery(search) {
    const s = (search || '').trim();
    if (!s) return { value: '', exact: false };
    if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
      return { value: s.slice(1, -1).trim().toLowerCase(), exact: true };
    }
    return { value: s.toLowerCase(), exact: false };
  }

  function nodeMatchesSearch(node, search) {
    if (!search || !search.trim()) return true;
    const { value: q, exact } = parseSearchQuery(search);
    if (!q) return true;
    const code = (node.user.referralCode || '').toLowerCase();
    const email = (node.user.email || '').toLowerCase();
    if (exact) {
      return code === q || email === q;
    }
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

  function expandMatchingPaths(tree, search, set) {
    tree.forEach((node) => {
      if (nodeOrDescendantMatches(node, search)) {
        set.add(node.user.referralCode);
        expandMatchingPaths(node.children, search, set);
      }
    });
  }

  function renderTreeNode(node, depth, expandedSet, searchQuery) {
    const levelLabel = depth === 0 ? '根' : `第 ${depth} 级`;
    const hasChildren = node.children.length > 0;
    const directCount = node.directCount || 0;
    const totalCount = node.totalCount || 0;
    const isExpanded = expandedSet.has(node.user.referralCode);
    const stats = hasChildren ? `直推 ${directCount} 人 · 下级共 ${totalCount} 人` : '';
    const isMatch = searchQuery && nodeMatchesSearch(node, searchQuery);
    const matchClass = isMatch ? ' user-tree-node--match' : '';

    let html = `<div class="user-tree-node${matchClass}" data-depth="${depth}" data-code="${(node.user.referralCode || '').replace(/"/g, '&quot;')}">
      <div class="user-tree-content">
        <button type="button" class="user-tree-toggle" aria-label="${isExpanded ? '收起' : '展开'}" ${!hasChildren ? 'disabled' : ''}>
          <span class="user-tree-chevron ${isExpanded ? 'expanded' : ''}">${hasChildren ? '▸' : ''}</span>
        </button>
        <div class="user-tree-info">
          <span class="user-tree-code">${node.user.referralCode}</span>
          <span class="user-tree-email">${node.user.email}</span>
          <span class="user-tree-level">${levelLabel}</span>
          ${stats ? `<span class="user-tree-stats">${stats}</span>` : ''}
        </div>
      </div>`;
    if (hasChildren) {
      const childHtml = node.children.map((c) => renderTreeNode(c, depth + 1, expandedSet, searchQuery)).join('');
      html += `<div class="user-tree-children ${isExpanded ? '' : 'collapsed'}">${childHtml}</div>`;
    }
    return html + '</div>';
  }

  let userTreeExpandedSet = new Set();
  let userTreeSearchQuery = '';

  function renderUsersPanel() {
    const container = document.getElementById('user-tree-admin');
    if (!container) return;

    const users = loadUsers();
    const roots = users.filter((u) => !u.parentReferral || u.parentReferral === '');

    const totalEl = document.getElementById('user-stats-total') || document.querySelector('.user-stats-total');
    const emailsLabelEl = document.querySelector('.user-stats-emails-label');
    const emailsListEl = document.getElementById('user-emails-list');

    if (totalEl) totalEl.textContent = '总用户数：' + users.length + ' 人';
    if (emailsLabelEl) emailsLabelEl.style.display = 'none';
    if (emailsListEl) {
      emailsListEl.innerHTML = '';
      emailsListEl.style.display = 'none';
    }

    if (!users.length) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:0.84rem">暂无用户数据。</p>';
      return;
    }

    let tree = [];
    if (roots.length) {
      tree = roots.map((r) => {
        const children = buildFullTree(r.referralCode, users, 0);
        const directCount = children.length;
        const totalCount = directCount + children.reduce((sum, c) => sum + (c.totalCount || 0), 0);
        return { user: r, children, directCount, totalCount };
      });
    } else {
      tree = users.map((u) => ({ user: u, children: [], directCount: 0, totalCount: 0 }));
    }

    tree = filterTreeBySearch(tree, userTreeSearchQuery);

    if (!tree.length) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:0.84rem">暂无匹配的用户。</p>';
      return;
    }

    const parts = tree.map((node) => renderTreeNode(node, 0, userTreeExpandedSet, userTreeSearchQuery));
    container.innerHTML = parts.join('');

    container.querySelectorAll('.user-tree-toggle:not([disabled])').forEach((btn) => {
      btn.addEventListener('click', () => {
        const node = btn.closest('.user-tree-node');
        const code = node?.dataset?.code;
        if (!code) return;
        if (userTreeExpandedSet.has(code)) {
          userTreeExpandedSet.delete(code);
        } else {
          userTreeExpandedSet.add(code);
        }
        renderUsersPanel();
      });
    });

  }

  function handleUserTreeSearch() {
    const el = document.getElementById('user-tree-search');
    if (!el) return;
    userTreeSearchQuery = (el.value || '').trim();
    const users = loadUsers();
    const roots = users.filter((u) => !u.parentReferral || u.parentReferral === '');
    let tree = roots.length
      ? roots.map((r) => {
          const children = buildFullTree(r.referralCode, users, 0);
          const directCount = children.length;
          const totalCount = directCount + children.reduce((sum, c) => sum + (c.totalCount || 0), 0);
          return { user: r, children, directCount, totalCount };
        })
      : [];
    tree = filterTreeBySearch(tree, userTreeSearchQuery);
    userTreeExpandedSet = new Set();
    if (userTreeSearchQuery) {
      expandMatchingPaths(tree, userTreeSearchQuery, userTreeExpandedSet);
    }
    renderUsersPanel();
  }

  document.body.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'user-tree-search') handleUserTreeSearch();
  });
  document.body.addEventListener('keyup', (e) => {
    if (e.target && e.target.id === 'user-tree-search') handleUserTreeSearch();
  });

  function loadAnnouncement() {
    const raw = localStorage.getItem(STORAGE_ANNOUNCEMENT);
    if (!raw) return { text: '', image: null };
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.text === 'string') {
        return { text: parsed.text, image: parsed.image || null };
      }
    } catch {}
    return { text: raw, image: null };
  }

  function saveAnnouncement(data) {
    localStorage.setItem(STORAGE_ANNOUNCEMENT, JSON.stringify(data));
  }

  function renderAnnouncementPanel() {
    const input = document.getElementById('admin-announcement');
    const preview = document.getElementById('admin-announcement-preview');
    const imageInput = document.getElementById('admin-announcement-image');
    if (!input) return;

    const data = loadAnnouncement();
    input.value = data.text;
    announcementPendingImage = data.image;

    if (preview) {
      if (data.image) {
        preview.innerHTML = `<img src="${data.image}" alt="预览" />`;
        preview.classList.add('has-image');
      } else {
        preview.innerHTML = '无图片';
        preview.classList.remove('has-image');
      }
    }
    if (imageInput) imageInput.value = '';
    renderAnnouncementRecord();
  }

  const adminAnnouncementImageInput = document.getElementById('admin-announcement-image');
  const adminAnnouncementPreview = document.getElementById('admin-announcement-preview');
  if (adminAnnouncementImageInput) {
    adminAnnouncementImageInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      try {
        const compressed = await compressImage(file, 600, 0.7);
        announcementPendingImage = compressed;
        if (adminAnnouncementPreview) {
          adminAnnouncementPreview.innerHTML = '<img src="' + compressed + '" alt="预览" />';
          adminAnnouncementPreview.classList.add('has-image');
        }
      } catch {
        const reader = new FileReader();
        reader.onload = () => {
          announcementPendingImage = reader.result;
          if (adminAnnouncementPreview) {
            adminAnnouncementPreview.innerHTML = '<img src="' + reader.result + '" alt="预览" />';
            adminAnnouncementPreview.classList.add('has-image');
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }
  if (adminAnnouncementPreview) {
    adminAnnouncementPreview.addEventListener('click', () => {
      announcementPendingImage = null;
      adminAnnouncementPreview.innerHTML = '无图片';
      adminAnnouncementPreview.classList.remove('has-image');
      if (adminAnnouncementImageInput) adminAnnouncementImageInput.value = '';
    });
  }

  const btnClearAnnouncementImage = document.getElementById('btn-clear-announcement-image');
  if (btnClearAnnouncementImage) {
    btnClearAnnouncementImage.addEventListener('click', () => {
      const data = loadAnnouncement();
      saveAnnouncement({ text: data.text, image: null });
      announcementPendingImage = null;
      renderAnnouncementPanel();
      if (adminAnnouncementPreview) {
        adminAnnouncementPreview.innerHTML = '无图片';
        adminAnnouncementPreview.classList.remove('has-image');
      }
      alert('已清除公告图片，文字已保留。');
    });
  }
  const btnClearProductImages = document.getElementById('btn-clear-product-images');
  if (btnClearProductImages) {
    btnClearProductImages.addEventListener('click', () => {
      if (!confirm('确定清除所有商品的图片？商品名称、价格等会保留。')) return;
      const products = loadProducts();
      products.forEach((p) => { delete p.image; });
      saveProducts(products);
      renderProductsPanel();
      alert('已清除所有商品图片。');
    });
  }

  function renderAnnouncementRecord() {
    const container = document.getElementById('announcement-record-content');
    if (!container) return;
    const data = loadAnnouncement();
    if (!data.text && !data.image) {
      container.innerHTML = '<span class="announcement-record-empty">暂无公告</span>';
      return;
    }
    let html = '';
    if (data.image) {
      html += `<img src="${data.image}" alt="公告图片" class="announcement-record-img" />`;
    }
    if (data.text) {
      html += `<div class="announcement-record-text">${data.text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>`;
    }
    container.innerHTML = html || '<span class="announcement-record-empty">暂无公告</span>';
  }

  function renderVerificationConfigInputs() {
    const cfg = loadVerificationConfig();
    const urlEl = document.getElementById('verification-url');
    const paramEl = document.getElementById('verification-param');
    const apiEl = document.getElementById('verification-api');
    const apiKeyEl = document.getElementById('verification-apikey');
    if (urlEl) urlEl.value = cfg.url || '';
    if (paramEl) paramEl.value = cfg.param || 'code';
    if (apiEl) apiEl.value = cfg.api || '';
    if (apiKeyEl) apiKeyEl.value = cfg.apiKey || '';
  }

  function renderOrdersPanel() {
    const container = document.getElementById('order-list-admin');
    const badgeEl = document.getElementById('orders-pending-badge');
    if (!container) return;

    renderVerificationConfigInputs();

    const list = loadOrdersAdmin();

    const pendingCount = list.filter((o) => !o.shipped).length;
    if (badgeEl) {
      badgeEl.textContent = pendingCount > 0 ? `待发货 ${pendingCount}` : '';
      badgeEl.className = 'pending-badge' + (pendingCount > 0 ? ' has-pending' : '');
    }
    const navBadge = document.getElementById('nav-orders-badge');
    if (navBadge) {
      navBadge.textContent = pendingCount > 0 ? String(pendingCount) : '';
      navBadge.className = 'nav-badge' + (pendingCount > 0 ? ' has-pending' : '');
    }

    if (!list.length) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:0.84rem">暂无订单。</p>';
      return;
    }

    const fmt = (d) => {
      if (!d) return '';
      const x = new Date(d);
      return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') + ' ' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0');
    };

    const vCfg = loadVerificationConfig();
    const qrPayloadFor = (o) => {
      if (vCfg.url) {
        const base = vCfg.url.replace(/\?.*$/, '');
        const param = vCfg.param || 'code';
        const sep = base.includes('?') ? '&' : '?';
        return base + sep + param + '=' + encodeURIComponent(o.id);
      }
      const payload = {
        h: 'HUIWEN',
        o: o.id,
        n: o.buyerName || '',
        d: o.buyerDob || '',
        c: o.buyerCountry || '',
        g: o.buyerGender || '',
        t: o.createdAt || '',
      };
      return JSON.stringify(payload);
    };

    container.innerHTML = list.map((o) => {
      const qrPayload = qrPayloadFor(o);
      const statusClass = o.shipped ? 'order-shipped' : 'order-pending';
      const statusText = o.shipped ? '已发货' : '待制作';
      const buyerInfo = [o.buyerName, o.buyerDob, o.buyerCountry, o.buyerGender].filter(Boolean).join(' · ') || '—';
      return `<div class="order-item-admin ${statusClass}" data-order-id="${(o.id || '').replace(/"/g, '&quot;')}">
        <div class="order-qr-wrap">
          <div class="order-qr-code" data-qr-payload></div>
          <span class="order-qr-label">订单二维码</span>
        </div>
        <div class="order-details">
          <span class="order-product">${(o.productName || '商品').replace(/</g, '&lt;')}</span>
          <span class="order-buyer-info">${(buyerInfo || '—').replace(/</g, '&lt;')}</span>
          <span class="order-price">￥${(o.price || 0).toFixed(2)}</span>
          <span class="order-buyer">${(o.buyerEmail || '').replace(/</g, '&lt;')}</span>
          <span class="order-date">${fmt(o.createdAt)}</span>
          <span class="order-status">${statusText}</span>
          ${!o.shipped ? `<button type="button" class="btn btn-small btn-ship" data-order-id="${(o.id || '').replace(/"/g, '&quot;')}">发货</button>` : ''}
          <a href="mailto:${(o.buyerEmail || '').replace(/"/g, '&quot;')}" class="btn btn-ghost btn-small" title="发邮件给客户">邮件</a>
        </div>
      </div>`;
    }).join('');

    list.forEach((o) => {
      const item = container.querySelector(`[data-order-id="${o.id}"]`);
      const wrap = item?.querySelector('.order-qr-code[data-qr-payload]');
      if (wrap && typeof QRCode !== 'undefined') {
        wrap.innerHTML = '';
        wrap.removeAttribute('data-qr-payload');
        new QRCode(wrap, { text: qrPayloadFor(o), width: 120, height: 120 });
      }
    });

    container.querySelectorAll('.btn-ship').forEach((btn) => {
      btn.addEventListener('click', () => {
        const orderId = btn.dataset.orderId;
        if (!orderId) return;
        openShipModal(orderId);
      });
    });
  }

  const btnSaveVerification = document.getElementById('btn-save-verification');
  if (btnSaveVerification) {
    btnSaveVerification.addEventListener('click', () => {
      const url = (document.getElementById('verification-url')?.value || '').trim();
      const param = (document.getElementById('verification-param')?.value || 'code').trim() || 'code';
      const api = (document.getElementById('verification-api')?.value || '').trim();
      const apiKey = (document.getElementById('verification-apikey')?.value || '').trim();
      saveVerificationConfig({ url, param, api, apiKey });
      alert('防伪配置已保存。');
      renderOrdersPanel();
    });
  }

  let shipModalOrderId = null;
  let shipModalPendingImage = null;

  function openShipModal(orderId) {
    shipModalOrderId = orderId;
    shipModalPendingImage = null;
    const list = loadOrdersAdmin();
    const order = list.find((o) => o.id === orderId);
    const infoEl = document.getElementById('ship-modal-order-info');
    const previewEl = document.getElementById('ship-modal-preview');
    const inputEl = document.getElementById('ship-modal-image');
    const confirmBtn = document.getElementById('btn-ship-confirm');
    const modal = document.getElementById('ship-modal');
    if (!order || !infoEl || !previewEl || !inputEl || !confirmBtn || !modal) return;

    infoEl.textContent = `订单：${order.productName || '商品'} · 客户：${order.buyerEmail || ''}`;
    previewEl.innerHTML = '未选择';
    previewEl.classList.remove('has-image');
    inputEl.value = '';
    confirmBtn.disabled = true;
    modal.hidden = false;
  }

  function closeShipModal() {
    const modal = document.getElementById('ship-modal');
    if (modal) modal.hidden = true;
    shipModalOrderId = null;
    shipModalPendingImage = null;
  }

  (function initShipModal() {
    const inputEl = document.getElementById('ship-modal-image');
    const previewEl = document.getElementById('ship-modal-preview');
    const confirmBtn = document.getElementById('btn-ship-confirm');
    const cancelBtn = document.getElementById('btn-ship-cancel');
    const modal = document.getElementById('ship-modal');

    if (!inputEl || !previewEl || !confirmBtn || !modal) return;

    inputEl.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) {
        shipModalPendingImage = null;
        previewEl.innerHTML = '未选择';
        previewEl.classList.remove('has-image');
        confirmBtn.disabled = true;
        return;
      }
      compressImage(file, 1200, 0.8).then((dataUrl) => {
        shipModalPendingImage = dataUrl;
        previewEl.innerHTML = `<img src="${dataUrl}" alt="预览" />`;
        previewEl.classList.add('has-image');
        confirmBtn.disabled = false;
      });
    });

    previewEl.addEventListener('click', () => {
      if (previewEl.classList.contains('has-image')) {
        shipModalPendingImage = null;
        previewEl.innerHTML = '未选择';
        previewEl.classList.remove('has-image');
        confirmBtn.disabled = true;
        if (inputEl) inputEl.value = '';
      }
    });

    cancelBtn?.addEventListener('click', closeShipModal);
    modal?.querySelector('.modal-backdrop')?.addEventListener('click', closeShipModal);

    confirmBtn.addEventListener('click', async () => {
      if (!shipModalOrderId || !shipModalPendingImage) return;
      const list = loadOrdersAdmin();
      const idx = list.findIndex((o) => o.id === shipModalOrderId);
      if (idx < 0) {
        alert('订单不存在');
        return;
      }
      const order = list[idx];

      const { error: shipError } = await supabaseClient.rpc('admin_update_order_shipped', {
        p_order_id: order.id,
        p_shipped: true,
      });
      if (shipError) {
        alert('更新发货状态失败。');
        return;
      }

      order.deliveredImage = shipModalPendingImage;
      order.shipped = true;
      order.shippedAt = new Date().toISOString();

      const vCfg = loadVerificationConfig();
      if (vCfg.api) {
        const headers = { 'Content-Type': 'application/json' };
        if (vCfg.apiKey) headers['X-Api-Key'] = vCfg.apiKey;
        fetch(vCfg.api, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            orderId: order.id,
            productName: order.productName,
            buyerName: order.buyerName,
            buyerEmail: order.buyerEmail,
            buyerDob: order.buyerDob,
            buyerCountry: order.buyerCountry,
            createdAt: order.createdAt,
            shippedAt: order.shippedAt,
          }),
        }).catch(() => {});
      }

      const deliveryUrl = DELIVERY_API_URL || '';
      if (deliveryUrl) {
        fetch(deliveryUrl + '/api/deliver', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buyerEmail: order.buyerEmail,
            productName: order.productName,
            productImage: order.deliveredImage,
          }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.ok) {
              alert('已发货！电子图片已发送至客户邮箱。');
            } else {
              alert('已标记为已发货。邮件发送失败：' + (data.error || '未知错误') + '，请手动发邮件给客户。');
            }
            closeShipModal();
            renderOrdersPanel();
          })
          .catch(() => {
            alert('已标记为已发货。发货服务未连接，请手动将图片发送至客户邮箱。');
            closeShipModal();
            renderOrdersPanel();
          });
      } else {
        alert('已发货！客户可在「订单」页下载电子图片。');
        closeShipModal();
        renderOrdersPanel();
      }
    });
  })();

  const btnExportJson = document.getElementById('btn-export-json');
  if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
      const data = {
        products: loadProducts(),
        users: loadUsers(),
        orders: loadOrdersAdmin(),
        bookings: loadBookingsAdmin(),
        withdrawals: loadWithdrawalsAdmin(),
        announcement: localStorage.getItem(STORAGE_ANNOUNCEMENT) || '',
        aiFaq: loadAiFaq(),
        aiChatRecords: loadAiChatRecords(),
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'huiwen-demo-export-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
      alert('已导出 JSON 文件。');
    });
  }

  function loadAiFaq() {
    const raw = localStorage.getItem(STORAGE_AI_FAQ);
    if (!raw) return [];
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function saveAiFaq(list) {
    localStorage.setItem(STORAGE_AI_FAQ, JSON.stringify(list));
  }

  function loadAiChatRecords() {
    const raw = localStorage.getItem(STORAGE_AI_CHAT);
    if (!raw) return [];
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  let editingFaqIndex = -1;

  function renderAiConsultPanel() {
    const faqList = document.getElementById('ai-faq-list');
    const recordsList = document.getElementById('ai-chat-records-list');
    if (faqList) {
      const faq = loadAiFaq();
      if (!faq.length) {
        faqList.innerHTML = '<p style="color:var(--text-muted);font-size:0.84rem">暂无配置，将使用默认问答。点击下方添加。</p>';
      } else {
        faqList.innerHTML = faq.map((item, i) =>
          `<div class="ai-faq-item">
            <span class="ai-faq-q">${item.q || ''}</span>
            <span class="ai-faq-a">→ ${(item.a || '').slice(0, 50)}${(item.a || '').length > 50 ? '...' : ''}</span>
            <button type="button" class="btn btn-ghost btn-small btn-edit-faq" data-idx="${i}">编辑</button>
            <button type="button" class="btn btn-ghost btn-small btn-delete-faq" data-idx="${i}">删除</button>
          </div>`
        ).join('');
        faqList.querySelectorAll('.btn-edit-faq').forEach((btn) => {
          btn.addEventListener('click', () => openFaqModal(parseInt(btn.dataset.idx, 10)));
        });
        faqList.querySelectorAll('.btn-delete-faq').forEach((btn) => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            const list = loadAiFaq();
            list.splice(idx, 1);
            saveAiFaq(list);
            renderAiConsultPanel();
          });
        });
      }
    }
    if (recordsList) {
      const records = loadAiChatRecords().slice(0, 20);
      if (!records.length) {
        recordsList.innerHTML = '<p style="color:var(--text-muted);font-size:0.84rem">暂无咨询记录</p>';
      } else {
        const fmt = (d) => {
          if (!d) return '';
          const x = new Date(d);
          return x.getMonth() + 1 + '/' + x.getDate() + ' ' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0');
        };
        recordsList.innerHTML = records.map((r) =>
          `<div class="ai-record-item">
            <span class="ai-record-q">Q: ${(r.q || '').slice(0, 60)}${(r.q || '').length > 60 ? '...' : ''}</span>
            <span class="ai-record-time">${fmt(r.t)}</span>
          </div>`
        ).join('');
      }
    }
  }

  function openFaqModal(idx) {
    editingFaqIndex = idx;
    const faq = loadAiFaq();
    const item = idx >= 0 ? faq[idx] : null;
    const kw = document.getElementById('faq-keywords');
    const ans = document.getElementById('faq-answer');
    const modal = document.getElementById('ai-faq-modal');
    if (kw) kw.value = item ? item.q : '';
    if (ans) ans.value = item ? item.a : '';
    if (modal) modal.hidden = false;
  }

  function closeFaqModal() {
    editingFaqIndex = -1;
    const modal = document.getElementById('ai-faq-modal');
    if (modal) modal.hidden = true;
  }

  const btnAddFaq = document.getElementById('btn-add-faq');
  const btnFaqCancel = document.getElementById('btn-faq-cancel');
  const btnFaqSave = document.getElementById('btn-faq-save');
  const faqModal = document.getElementById('ai-faq-modal');
  if (btnAddFaq) btnAddFaq.addEventListener('click', () => openFaqModal(-1));
  if (btnFaqCancel) btnFaqCancel.addEventListener('click', closeFaqModal);
  if (faqModal) {
    const backdrop = faqModal.querySelector('.modal-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeFaqModal);
  }
  if (btnFaqSave) {
    btnFaqSave.addEventListener('click', () => {
      const kw = document.getElementById('faq-keywords');
      const ans = document.getElementById('faq-answer');
      const q = (kw && kw.value || '').trim();
      const a = (ans && ans.value || '').trim();
      if (!q || !a) {
        alert('请填写关键词和回答。');
        return;
      }
      const list = loadAiFaq();
      if (editingFaqIndex >= 0) {
        list[editingFaqIndex] = { q, a };
      } else {
        list.push({ q, a });
      }
      saveAiFaq(list);
      closeFaqModal();
      renderAiConsultPanel();
    });
  }

  function renderBookingsPanel() {
    const container = document.getElementById('booking-list-admin');
    if (!container) return;

    const list = [...loadBookingsAdmin()];

    if (!list.length) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:0.84rem">暂无预约记录。</p>';
      return;
    }

    const labels = {
      pending: '待确认',
      confirmed: '已确认',
      completed: '已完成',
      cancelled: '已取消',
    };

    container.innerHTML = list
      .map(
        (b) => `<div class="booking-item" data-booking-id="${b.id}">
          <div>${b.date || ''} ${b.slot || ''} · ${b.duration || 120}分钟${b.userEmail ? ' · ' + b.userEmail : ''}</div>
          <div style="margin-top:8px">
            <select class="field-input booking-status-select" data-booking-id="${b.id}">
              ${['pending', 'confirmed', 'completed', 'cancelled']
                .map(
                  (status) =>
                    `<option value="${status}" ${b.status === status ? 'selected' : ''}>${labels[status]}</option>`,
                )
                .join('')}
            </select>
          </div>
        </div>`,
      )
      .join('');

    container.querySelectorAll('.booking-status-select').forEach((select) => {
      select.addEventListener('change', async () => {
        const { error } = await supabaseClient.rpc('admin_update_booking_status', {
          p_booking_id: select.dataset.bookingId,
          p_status: select.value,
        });

        if (error) {
          alert('更新预约状态失败。');
          return;
        }

        await refreshAdminData();
        renderBookingsPanel();
      });
    });
  }

  await checkAdminAuth();
});
