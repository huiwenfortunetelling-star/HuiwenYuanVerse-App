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
    products: [],
    announcements: [],
  };

  const STORAGE_ANNOUNCEMENT = 'huiwen_demo_announcement';
  const STORAGE_ANNOUNCEMENT_MIGRATED = 'huiwen_announcements_migrated_v1';
  const ANNOUNCEMENT_BUCKET = 'announcement-images';
  let announcementPendingImage = null;
  let announcementEditingId = null;
  let announcementEditingImageUrl = '';
  let announcementEditingImagePath = null;

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

  window.saveAnnouncementClick = async function () {
    const button = document.getElementById('btn-save-announcement');
    if (button) button.disabled = true;
    try {
      await saveAnnouncementFromCms();
    } catch (error) {
      console.error('Save announcement error:', error);
      alert(error?.message || '公告保存失败，请稍后重试。');
    } finally {
      if (button) button.disabled = false;
    }
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
      verificationToken: o.verification_token || '',
      talismanImageUrl: o.talisman_image_url || '',
      talismanImagePath: o.talisman_image_path || '',
      talismanUploadedAt: o.talisman_uploaded_at || '',
      createdAt: o.created_at,
    }));

    adminCache.bookings = (payload.bookings || []).map((b) => ({
      id: b.id,
      userEmail: b.user_email,
      date: b.booking_date,
      slot: b.booking_slot,
      duration: Number(b.duration_minutes || 120),
      status: b.status || 'pending',
      phoneNumber: b.phone_number || '',
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

  const STORAGE_PRODUCTS_MIGRATED = 'huiwen_products_supabase_migrated_v1';

  function loadLocalProductsForMigration() {
    const raw = localStorage.getItem(STORAGE_PRODUCTS);
    if (!raw) return null;
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) && list.length ? list : null;
    } catch {
      return null;
    }
  }

  function loadProducts() {
    return adminCache.products;
  }

  function mapSupabaseProduct(p) {
    return {
      id: p.id,
      name: p.name || '',
      price: Number(p.price || 0),
      stock: Number.isFinite(Number(p.stock)) ? Number(p.stock) : 0,
      desc: p.description || '',
      image: p.image_url || undefined,
      active: p.active !== false,
      createdAt: p.created_at || null,
      updatedAt: p.updated_at || null,
      sortOrder: Number(p.sort_order || 0),
    };
  }

  async function refreshProductsFromSupabase() {
    if (!supabaseClient) throw new Error('Supabase unavailable');

    const { data, error } = await supabaseClient.rpc('admin_get_products');
    if (error) throw error;

    adminCache.products = (Array.isArray(data) ? data : []).map(mapSupabaseProduct);
    return adminCache.products;
  }

  async function upsertProductToSupabase(product) {
    const { data, error } = await supabaseClient.rpc('admin_upsert_product', {
      p_id: product.id || null,
      p_name: product.name || '',
      p_description: product.desc || '',
      p_price: Number(product.price || 0),
      p_stock: Number.isFinite(Number(product.stock)) ? Number(product.stock) : 0,
      p_image_url: product.image || null,
    });
    if (error) throw error;
    return data;
  }

  async function archiveProductInSupabase(productId) {
    const { error } = await supabaseClient.rpc('admin_archive_product', {
      p_id: productId,
    });
    if (error) throw error;
  }

  async function initializeCentralProducts() {
    await refreshProductsFromSupabase();

    const migrated = localStorage.getItem(STORAGE_PRODUCTS_MIGRATED) === '1';
    const localProducts = loadLocalProductsForMigration();

    // One-time migration of the boss's existing browser-local product list.
    if (!migrated && localProducts && localProducts.length) {
      for (const product of localProducts) {
        await upsertProductToSupabase(product);
      }
      localStorage.setItem(STORAGE_PRODUCTS_MIGRATED, '1');
      await refreshProductsFromSupabase();
    }
  }

  async function showMain() {
    loginScreen.classList.remove('admin-screen--active');
    loginScreen.hidden = true;
    mainScreen.classList.remove('admin-screen--active');
    mainScreen.hidden = false;
    mainScreen.classList.add('admin-screen--active');

    await refreshAdminData();
    await initializeCentralProducts();
    await initializeAnnouncementsCms();

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
      btn.addEventListener('click', async () => {
        const item = btn.closest('.product-item-admin');
        const id = item.dataset.id;
        if (!confirm('确定删除该商品？')) return;

        btn.disabled = true;
        try {
          await archiveProductInSupabase(id);
          await refreshProductsFromSupabase();
          renderProductsPanel();
        } catch (error) {
          console.error('Delete product error:', error);
          alert('删除商品失败，请稍后重试。');
          btn.disabled = false;
        }
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

  btnModalSave.addEventListener('click', async () => {
    const name = modalName.value.trim();
    const price = parseFloat(modalPrice.value);
    const stockRaw = modalStock?.value;
    const stock = stockRaw === '' || stockRaw === undefined ? 0 : Math.max(0, parseInt(stockRaw, 10) || 0);
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

    const product = {
      id: editingProductId || null,
      name,
      price,
      stock,
      desc,
      image,
    };

    btnModalSave.disabled = true;
    try {
      await upsertProductToSupabase(product);
      await refreshProductsFromSupabase();
      closeProductModal();
      renderProductsPanel();
      alert(editingProductId ? '商品已更新。' : '商品已新增。');
    } catch (error) {
      console.error('Save product error:', error);
      alert('保存商品失败，请稍后重试。');
    } finally {
      btnModalSave.disabled = false;
    }
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

  function escapeAnnouncementHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function loadLegacyAnnouncement() {
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

  function ensureAnnouncementCmsShell() {
    const panel = document.getElementById('panel-announcement');
    const imageInput = document.getElementById('admin-announcement-image');
    if (!panel || !imageInput) return;

    const tip = panel.querySelector('.panel-tip');
    if (tip) {
      tip.textContent = '上传图片、选择分类并填写正文。发布后会自动显示在前台首页对应分类中。';
    }

    if (!document.getElementById('admin-announcement-category')) {
      const imageField = imageInput.closest('.field');
      const categoryField = document.createElement('label');
      categoryField.className = 'field';
      categoryField.innerHTML = `
        <span class="field-label">公告分类</span>
        <select id="admin-announcement-category" class="field-input">
          <option value="category1">Category 1 · 16:9</option>
          <option value="category2">Category 2 · 9:16</option>
        </select>
      `;
      imageField?.insertAdjacentElement('beforebegin', categoryField);
    }

    const recordLabel = document.querySelector('#announcement-record .announcement-record-label');
    if (recordLabel) recordLabel.textContent = '公告列表：';

    const button = document.getElementById('btn-save-announcement');
    if (button && !announcementEditingId) button.textContent = '发布公告';

    if (!document.getElementById('huiwen-announcement-cms-styles')) {
      const style = document.createElement('style');
      style.id = 'huiwen-announcement-cms-styles';
      style.textContent = `
        .announcement-cms-list{display:grid;gap:.75rem;margin-top:.65rem}
        .announcement-cms-item{display:grid;grid-template-columns:120px minmax(0,1fr) auto;gap:.85rem;align-items:center;padding:.8rem;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(0,0,0,.12)}
        .announcement-cms-thumb{width:120px;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:#09090b}
        .announcement-cms-thumb img{width:100%;height:100%;display:block;object-fit:cover}
        .announcement-cms-meta{min-width:0}
        .announcement-cms-category{display:inline-block;color:#e0b14e;font-size:.78rem;margin-bottom:.25rem}
        .announcement-cms-text{color:#e8edf6;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .announcement-cms-date{color:var(--text-muted,#9aa3b5);font-size:.75rem;margin-top:.25rem}
        .announcement-cms-actions{display:flex;gap:.45rem;flex-wrap:wrap;justify-content:flex-end}
        .announcement-cms-actions button{border-radius:999px;padding:.45rem .75rem;border:1px solid rgba(224,177,78,.5);background:transparent;color:#e0b14e;cursor:pointer}
        .announcement-cms-actions .announcement-delete-btn{color:#f1a5a5;border-color:rgba(241,165,165,.4)}
        @media(max-width:700px){.announcement-cms-item{grid-template-columns:88px minmax(0,1fr)}.announcement-cms-thumb{width:88px}.announcement-cms-actions{grid-column:1/-1;justify-content:flex-start}}
      `;
      document.head.appendChild(style);
    }
  }

  async function refreshAnnouncementsFromSupabase() {
    if (!supabaseClient) throw new Error('Supabase 未连接。');
    const { data, error } = await supabaseClient.rpc('admin_get_announcements');
    if (error) throw error;
    adminCache.announcements = Array.isArray(data) ? data : [];
    return adminCache.announcements;
  }

  async function uploadAnnouncementImage(dataUrl) {
    if (!supabaseClient || !dataUrl) throw new Error('公告图片不可用。');
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const type = blob.type || 'image/jpeg';
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('gif') ? 'gif' : 'jpg';
    const path = `announcements/${Date.now()}-${Math.random().toString(36).slice(2,10)}.${ext}`;
    const { error } = await supabaseClient.storage
      .from(ANNOUNCEMENT_BUCKET)
      .upload(path, blob, { contentType: type, upsert: false });
    if (error) throw error;
    const { data } = supabaseClient.storage.from(ANNOUNCEMENT_BUCKET).getPublicUrl(path);
    const url = data?.publicUrl || '';
    if (!url) throw new Error('无法生成公告图片地址。');
    return { url, path };
  }

  async function removeAnnouncementStorageImage(path) {
    if (!supabaseClient || !path) return;
    const { error } = await supabaseClient.storage.from(ANNOUNCEMENT_BUCKET).remove([path]);
    if (error) console.warn('Announcement image cleanup failed:', error);
  }

  function resetAnnouncementEditor() {
    announcementPendingImage = null;
    announcementEditingId = null;
    announcementEditingImageUrl = '';
    announcementEditingImagePath = null;

    const input = document.getElementById('admin-announcement');
    const category = document.getElementById('admin-announcement-category');
    const preview = document.getElementById('admin-announcement-preview');
    const imageInput = document.getElementById('admin-announcement-image');
    const button = document.getElementById('btn-save-announcement');

    if (input) input.value = '';
    if (category) category.value = 'category1';
    if (imageInput) imageInput.value = '';
    if (preview) {
      preview.innerHTML = '无图片';
      preview.classList.remove('has-image');
    }
    if (button) button.textContent = '发布公告';
  }

  function renderAnnouncementRecord() {
    const container = document.getElementById('announcement-record-content');
    if (!container) return;
    const list = adminCache.announcements || [];
    if (!list.length) {
      container.innerHTML = '<span class="announcement-record-empty">暂无公告</span>';
      return;
    }

    container.innerHTML = `<div class="announcement-cms-list">${list.map((item) => {
      const categoryNum = String(item.category || 'category1').replace('category','');
      const date = item.created_at ? new Date(item.created_at).toLocaleString() : '';
      return `
        <div class="announcement-cms-item" data-announcement-id="${escapeAnnouncementHtml(item.id)}">
          <div class="announcement-cms-thumb"><img src="${escapeAnnouncementHtml(item.image_url)}" alt="公告图片" /></div>
          <div class="announcement-cms-meta">
            <span class="announcement-cms-category">Category ${escapeAnnouncementHtml(categoryNum)}</span>
            <div class="announcement-cms-text">${escapeAnnouncementHtml(item.content)}</div>
            <div class="announcement-cms-date">${escapeAnnouncementHtml(date)}</div>
          </div>
          <div class="announcement-cms-actions">
            <button type="button" class="announcement-edit-btn">编辑</button>
            <button type="button" class="announcement-delete-btn">删除</button>
          </div>
        </div>
      `;
    }).join('')}</div>`;
  }

  function renderAnnouncementPanel() {
    ensureAnnouncementCmsShell();
    resetAnnouncementEditor();
    renderAnnouncementRecord();
  }

  async function saveAnnouncementFromCms() {
    ensureAnnouncementCmsShell();
    if (!supabaseClient) throw new Error('Supabase 未连接。');

    const text = String(document.getElementById('admin-announcement')?.value || '').trim();
    const category = String(document.getElementById('admin-announcement-category')?.value || 'category1');
    if (!text) throw new Error('请填写公告内容。');

    let imageUrl = announcementEditingImageUrl;
    let imagePath = announcementEditingImagePath;
    let newlyUploadedPath = null;

    if (announcementPendingImage) {
      const uploaded = await uploadAnnouncementImage(announcementPendingImage);
      imageUrl = uploaded.url;
      imagePath = uploaded.path;
      newlyUploadedPath = uploaded.path;
    }

    if (!imageUrl) throw new Error('请上传公告图片。');

    const oldImagePath = announcementEditingImagePath;
    const { error } = await supabaseClient.rpc('admin_save_announcement', {
      p_id: announcementEditingId || null,
      p_category: category,
      p_content: text,
      p_image_url: imageUrl,
      p_image_path: imagePath || null,
      p_published: true,
    });

    if (error) {
      if (newlyUploadedPath) await removeAnnouncementStorageImage(newlyUploadedPath);
      throw error;
    }

    if (newlyUploadedPath && oldImagePath && oldImagePath !== newlyUploadedPath) {
      await removeAnnouncementStorageImage(oldImagePath);
    }

    const wasEditing = !!announcementEditingId;
    await refreshAnnouncementsFromSupabase();
    resetAnnouncementEditor();
    renderAnnouncementRecord();
    alert(wasEditing ? '公告修改成功！' : '公告发布成功！');
  }

  async function initializeAnnouncementsCms() {
    ensureAnnouncementCmsShell();
    await refreshAnnouncementsFromSupabase();

    const migrated = localStorage.getItem(STORAGE_ANNOUNCEMENT_MIGRATED) === '1';
    if (!migrated) {
      const legacy = loadLegacyAnnouncement();
      const alreadyExists = adminCache.announcements.some((item) =>
        String(item.content || '').trim() === String(legacy.text || '').trim() && String(legacy.text || '').trim() !== ''
      );

      if (!alreadyExists && legacy.text && legacy.image) {
        try {
          let imageUrl = legacy.image;
          let imagePath = null;
          if (String(legacy.image).startsWith('data:image/')) {
            const uploaded = await uploadAnnouncementImage(legacy.image);
            imageUrl = uploaded.url;
            imagePath = uploaded.path;
          }
          const { error } = await supabaseClient.rpc('admin_save_announcement', {
            p_id: null,
            p_category: 'category1',
            p_content: legacy.text,
            p_image_url: imageUrl,
            p_image_path: imagePath,
            p_published: true,
          });
          if (error) throw error;
        } catch (error) {
          console.warn('Legacy announcement migration skipped:', error);
        }
      }
      localStorage.setItem(STORAGE_ANNOUNCEMENT_MIGRATED, '1');
      await refreshAnnouncementsFromSupabase();
    }
  }

  const adminAnnouncementImageInput = document.getElementById('admin-announcement-image');
  const adminAnnouncementPreview = document.getElementById('admin-announcement-preview');
  if (adminAnnouncementImageInput) {
    adminAnnouncementImageInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      try {
        const compressed = await compressImage(file, 1400, 0.82);
        announcementPendingImage = compressed;
        if (adminAnnouncementPreview) {
          adminAnnouncementPreview.innerHTML = '<img src="' + compressed + '" alt="预览" />';
          adminAnnouncementPreview.classList.add('has-image');
        }
      } catch (error) {
        console.error('Announcement image preparation error:', error);
        alert('图片读取失败，请换一张图片后重试。');
      }
    });
  }

  if (adminAnnouncementPreview) {
    adminAnnouncementPreview.addEventListener('click', () => {
      announcementPendingImage = null;
      if (adminAnnouncementImageInput) adminAnnouncementImageInput.value = '';
      if (announcementEditingImageUrl) {
        adminAnnouncementPreview.innerHTML = '<img src="' + escapeAnnouncementHtml(announcementEditingImageUrl) + '" alt="预览" />';
        adminAnnouncementPreview.classList.add('has-image');
      } else {
        adminAnnouncementPreview.innerHTML = '无图片';
        adminAnnouncementPreview.classList.remove('has-image');
      }
    });
  }

  const btnClearAnnouncementImage = document.getElementById('btn-clear-announcement-image');
  if (btnClearAnnouncementImage) {
    btnClearAnnouncementImage.textContent = '清除待上传图片';
    btnClearAnnouncementImage.addEventListener('click', () => {
      announcementPendingImage = null;
      if (adminAnnouncementImageInput) adminAnnouncementImageInput.value = '';
      if (adminAnnouncementPreview) {
        if (announcementEditingImageUrl) {
          adminAnnouncementPreview.innerHTML = '<img src="' + escapeAnnouncementHtml(announcementEditingImageUrl) + '" alt="预览" />';
          adminAnnouncementPreview.classList.add('has-image');
        } else {
          adminAnnouncementPreview.innerHTML = '无图片';
          adminAnnouncementPreview.classList.remove('has-image');
        }
      }
    });
  }

  const announcementRecordContent = document.getElementById('announcement-record-content');
  if (announcementRecordContent) {
    announcementRecordContent.addEventListener('click', async (event) => {
      const itemEl = event.target.closest('[data-announcement-id]');
      if (!itemEl) return;
      const item = adminCache.announcements.find((row) => String(row.id) === String(itemEl.dataset.announcementId));
      if (!item) return;

      if (event.target.closest('.announcement-edit-btn')) {
        announcementEditingId = item.id;
        announcementEditingImageUrl = item.image_url || '';
        announcementEditingImagePath = item.image_path || null;
        announcementPendingImage = null;
        const text = document.getElementById('admin-announcement');
        const category = document.getElementById('admin-announcement-category');
        const imageInput = document.getElementById('admin-announcement-image');
        const button = document.getElementById('btn-save-announcement');
        if (text) text.value = item.content || '';
        if (category) category.value = item.category || 'category1';
        if (imageInput) imageInput.value = '';
        if (adminAnnouncementPreview) {
          adminAnnouncementPreview.innerHTML = item.image_url
            ? '<img src="' + escapeAnnouncementHtml(item.image_url) + '" alt="预览" />'
            : '无图片';
          adminAnnouncementPreview.classList.toggle('has-image', !!item.image_url);
        }
        if (button) button.textContent = '保存修改';
        document.getElementById('panel-announcement')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      if (event.target.closest('.announcement-delete-btn')) {
        if (!confirm('确定删除这条公告吗？前台将立即不再显示。')) return;
        const { error } = await supabaseClient.rpc('admin_delete_announcement', { p_id: item.id });
        if (error) {
          alert(error.message || '删除失败。');
          return;
        }
        if (item.image_path) await removeAnnouncementStorageImage(item.image_path);
        await refreshAnnouncementsFromSupabase();
        if (announcementEditingId === item.id) resetAnnouncementEditor();
        renderAnnouncementRecord();
        alert('公告已删除。');
      }
    });
  }

  const btnClearProductImages = document.getElementById('btn-clear-product-images');
  if (btnClearProductImages) {
    btnClearProductImages.addEventListener('click', async () => {
      if (!confirm('确定清除所有商品的图片？商品名称、价格等会保留。')) return;

      btnClearProductImages.disabled = true;
      try {
        const products = loadProducts();
        for (const p of products) {
          await upsertProductToSupabase({ ...p, image: null });
        }
        await refreshProductsFromSupabase();
        renderProductsPanel();
        alert('已清除所有商品图片。');
      } catch (error) {
        console.error('Clear product images error:', error);
        alert('清除商品图片失败，请稍后重试。');
      } finally {
        btnClearProductImages.disabled = false;
      }
    });
  }

  // The old external anti-counterfeit service configuration is no longer needed.
  // Huiwen now uses its own verification center at /verification.html.
  const legacyVerificationConfig = document.querySelector('.verification-config');
  if (legacyVerificationConfig) legacyVerificationConfig.remove();
  const ordersPanelTip = document.querySelector('#panel-orders .panel-tip');
  if (ordersPanelTip) {
    ordersPanelTip.textContent = '每个订单都有专属验证二维码。先上传为客户制作的符图，确认全部处理完成后再手动点击「发货」。';
  }

  const TALISMAN_BUCKET = 'talisman-images';

  function verificationUrlFor(order) {
    const token = String(order?.verificationToken || '').trim();
    if (!token) return '';
    return `${window.location.origin}/verification.html?code=${encodeURIComponent(token)}`;
  }

  function safeFilePart(value) {
    return String(value || 'order')
      .trim()
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'order';
  }

  async function downloadVerificationQr(order) {
    const payload = verificationUrlFor(order);
    if (!payload) {
      alert('此订单缺少验证编号，请刷新后台后重试。');
      return;
    }
    if (typeof QRCode === 'undefined') {
      alert('二维码组件尚未加载，请刷新页面后重试。');
      return;
    }

    const holder = document.createElement('div');
    holder.style.position = 'fixed';
    holder.style.left = '-10000px';
    holder.style.top = '-10000px';
    holder.style.width = '840px';
    holder.style.height = '840px';
    document.body.appendChild(holder);

    try {
      new QRCode(holder, {
        text: payload,
        width: 840,
        height: 840,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.H : undefined,
      });

      await new Promise((resolve) => setTimeout(resolve, 80));
      const source = holder.querySelector('canvas') || holder.querySelector('img');
      if (!source) throw new Error('QR render failed');

      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1000, 1000);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source, 80, 80, 840, 840);

      const a = document.createElement('a');
      const shortToken = String(order.verificationToken || '').slice(0, 8);
      a.download = `Huiwen-QR-${safeFilePart(order.productName)}-${shortToken}.png`;
      a.href = canvas.toDataURL('image/png');
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      console.error('QR download error:', error);
      alert('二维码下载失败，请稍后重试。');
    } finally {
      holder.remove();
    }
  }

  function renderOrdersPanel() {
    const container = document.getElementById('order-list-admin');
    const badgeEl = document.getElementById('orders-pending-badge');
    if (!container) return;

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

    container.innerHTML = list.map((o) => {
      const statusClass = o.shipped ? 'order-shipped' : 'order-pending';
      const statusText = o.shipped ? '已发货' : '待发货';
      const buyerInfo = [o.buyerName, o.buyerDob, o.buyerCountry, o.buyerGender].filter(Boolean).join(' · ') || '—';
      const imageStatus = o.talismanImageUrl ? '符图已上传' : '符图未上传';
      const imageStatusStyle = o.talismanImageUrl ? 'color:#d8b45a' : 'color:var(--text-muted)';
      return `<div class="order-item-admin ${statusClass}" data-order-id="${(o.id || '').replace(/"/g, '&quot;')}">
        <div class="order-qr-wrap">
          <div class="order-qr-code" data-qr-payload></div>
          <span class="order-qr-label">验证二维码</span>
          <button type="button" class="btn btn-ghost btn-small btn-download-qr" data-order-id="${(o.id || '').replace(/"/g, '&quot;')}">下载QR</button>
          <div class="verification-token-block" style="margin-top:8px;width:100%;max-width:170px;text-align:center">
            <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:4px">验证编号</div>
            <div class="verification-token-value" style="font-size:.68rem;line-height:1.35;word-break:break-all;color:#d8b45a">${String(o.verificationToken || '—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}</div>
            <button type="button" class="btn btn-ghost btn-small btn-copy-verification-token" data-order-id="${(o.id || '').replace(/"/g, '&quot;')}" style="margin-top:6px">复制编号</button>
          </div>
        </div>
        <div class="order-details">
          <span class="order-product">${(o.productName || '商品').replace(/</g, '&lt;')}</span>
          <span class="order-buyer-info">${(buyerInfo || '—').replace(/</g, '&lt;')}</span>
          <span class="order-price">￥${(o.price || 0).toFixed(2)}</span>
          <span class="order-buyer">${(o.buyerEmail || '').replace(/</g, '&lt;')}</span>
          <span class="order-date">${fmt(o.createdAt)}</span>
          <span class="order-talisman-status" style="${imageStatusStyle}">${imageStatus}</span>
          <span class="order-status">${statusText}</span>
          <button type="button" class="btn btn-ghost btn-small btn-upload-talisman" data-order-id="${(o.id || '').replace(/"/g, '&quot;')}">${o.talismanImageUrl ? '替换符图' : '上传'}</button>
          ${!o.shipped ? `<button type="button" class="btn btn-small btn-ship" data-order-id="${(o.id || '').replace(/"/g, '&quot;')}">发货</button>` : ''}
        </div>
      </div>`;
    }).join('');

    list.forEach((o) => {
      const item = container.querySelector(`[data-order-id="${o.id}"]`);
      const wrap = item?.querySelector('.order-qr-code[data-qr-payload]');
      const qrUrl = verificationUrlFor(o);
      if (wrap && typeof QRCode !== 'undefined' && qrUrl) {
        wrap.innerHTML = '';
        wrap.removeAttribute('data-qr-payload');
        new QRCode(wrap, {
          text: qrUrl,
          width: 120,
          height: 120,
          colorDark: '#000000',
          colorLight: '#ffffff',
        });
      } else if (wrap && !qrUrl) {
        wrap.textContent = '缺少验证码';
      }
    });

    container.querySelectorAll('.btn-download-qr').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const order = list.find((o) => o.id === btn.dataset.orderId);
        if (!order) return;
        btn.disabled = true;
        try {
          await downloadVerificationQr(order);
        } finally {
          btn.disabled = false;
        }
      });
    });

    container.querySelectorAll('.btn-copy-verification-token').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const order = list.find((o) => o.id === btn.dataset.orderId);
        const token = String(order?.verificationToken || '').trim();
        if (!token) {
          alert('此订单缺少验证编号。');
          return;
        }

        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(token);
          } else {
            const temp = document.createElement('textarea');
            temp.value = token;
            temp.setAttribute('readonly', '');
            temp.style.position = 'fixed';
            temp.style.left = '-10000px';
            document.body.appendChild(temp);
            temp.select();
            const ok = document.execCommand('copy');
            temp.remove();
            if (!ok) throw new Error('copy command failed');
          }

          const oldText = btn.textContent;
          btn.textContent = '已复制';
          setTimeout(() => {
            btn.textContent = oldText;
          }, 1200);
        } catch (error) {
          console.error('Copy verification token error:', error);
          window.prompt('请复制验证编号：', token);
        }
      });
    });

    container.querySelectorAll('.btn-upload-talisman').forEach((btn) => {
      btn.addEventListener('click', () => {
        const orderId = btn.dataset.orderId;
        if (!orderId) return;
        openTalismanUploadModal(orderId);
      });
    });

    container.querySelectorAll('.btn-ship').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const orderId = btn.dataset.orderId;
        const order = list.find((o) => o.id === orderId);
        if (!order) return;
        const warning = order.talismanImageUrl
          ? '确认将此订单标记为「已发货」吗？'
          : '此订单尚未上传专属符图。仍要将订单标记为「已发货」吗？';
        if (!confirm(warning)) return;
        btn.disabled = true;
        try {
          const { error } = await supabaseClient.rpc('admin_update_order_shipped', {
            p_order_id: order.id,
            p_shipped: true,
          });
          if (error) throw error;
          await refreshAdminData();
          renderOrdersPanel();
          alert('订单已标记为已发货。');
        } catch (error) {
          console.error('Manual ship error:', error);
          alert('更新发货状态失败，请稍后重试。');
          btn.disabled = false;
        }
      });
    });
  }

  let talismanUploadOrderId = null;
  let talismanUploadPendingFile = null;
  let talismanPreviewObjectUrl = null;

  function clearTalismanPreviewObjectUrl() {
    if (talismanPreviewObjectUrl) {
      URL.revokeObjectURL(talismanPreviewObjectUrl);
      talismanPreviewObjectUrl = null;
    }
  }

  function openTalismanUploadModal(orderId) {
    talismanUploadOrderId = orderId;
    talismanUploadPendingFile = null;
    clearTalismanPreviewObjectUrl();

    const list = loadOrdersAdmin();
    const order = list.find((o) => o.id === orderId);
    const infoEl = document.getElementById('ship-modal-order-info');
    const previewEl = document.getElementById('ship-modal-preview');
    const inputEl = document.getElementById('ship-modal-image');
    const confirmBtn = document.getElementById('btn-ship-confirm');
    const modal = document.getElementById('ship-modal');
    if (!order || !infoEl || !previewEl || !inputEl || !confirmBtn || !modal) return;

    const titleEl = modal.querySelector('.modal-title');
    const labelEl = modal.querySelector('.field-label');
    if (titleEl) titleEl.textContent = '上传专属符图片';
    if (labelEl) labelEl.textContent = '选择制作好的符图片';
    confirmBtn.textContent = '确认上传';

    infoEl.textContent = `订单：${order.productName || '商品'} · 客户：${order.buyerEmail || ''}`;
    previewEl.innerHTML = order.talismanImageUrl
      ? `<img src="${String(order.talismanImageUrl).replace(/"/g, '&quot;')}" alt="当前符图" />`
      : '未选择';
    previewEl.classList.toggle('has-image', Boolean(order.talismanImageUrl));
    previewEl.dataset.pending = '0';
    inputEl.value = '';
    confirmBtn.disabled = true;
    modal.hidden = false;
  }

  function closeTalismanUploadModal() {
    const modal = document.getElementById('ship-modal');
    if (modal) modal.hidden = true;
    talismanUploadOrderId = null;
    talismanUploadPendingFile = null;
    clearTalismanPreviewObjectUrl();
  }

  (function initTalismanUploadModal() {
    const inputEl = document.getElementById('ship-modal-image');
    const previewEl = document.getElementById('ship-modal-preview');
    const confirmBtn = document.getElementById('btn-ship-confirm');
    const cancelBtn = document.getElementById('btn-ship-cancel');
    const modal = document.getElementById('ship-modal');
    if (!inputEl || !previewEl || !confirmBtn || !modal) return;

    inputEl.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      talismanUploadPendingFile = null;
      clearTalismanPreviewObjectUrl();
      if (!file || !file.type.startsWith('image/')) {
        confirmBtn.disabled = true;
        return;
      }
      talismanUploadPendingFile = file;
      talismanPreviewObjectUrl = URL.createObjectURL(file);
      previewEl.innerHTML = `<img src="${talismanPreviewObjectUrl}" alt="预览" />`;
      previewEl.classList.add('has-image');
      previewEl.dataset.pending = '1';
      confirmBtn.disabled = false;
    });

    previewEl.addEventListener('click', () => {
      if (previewEl.dataset.pending !== '1') return;
      talismanUploadPendingFile = null;
      clearTalismanPreviewObjectUrl();
      const order = loadOrdersAdmin().find((o) => o.id === talismanUploadOrderId);
      previewEl.innerHTML = order?.talismanImageUrl
        ? `<img src="${String(order.talismanImageUrl).replace(/"/g, '&quot;')}" alt="当前符图" />`
        : '未选择';
      previewEl.classList.toggle('has-image', Boolean(order?.talismanImageUrl));
      previewEl.dataset.pending = '0';
      confirmBtn.disabled = true;
      inputEl.value = '';
    });

    cancelBtn?.addEventListener('click', closeTalismanUploadModal);
    modal.querySelector('.modal-backdrop')?.addEventListener('click', closeTalismanUploadModal);

    confirmBtn.addEventListener('click', async () => {
      if (!talismanUploadOrderId || !talismanUploadPendingFile) return;
      const order = loadOrdersAdmin().find((o) => o.id === talismanUploadOrderId);
      if (!order) {
        alert('订单不存在。');
        return;
      }

      confirmBtn.disabled = true;
      const originalText = confirmBtn.textContent;
      confirmBtn.textContent = '上传中...';
      let newPath = '';
      try {
        const file = talismanUploadPendingFile;
        const nameParts = String(file.name || '').split('.');
        let ext = nameParts.length > 1 ? nameParts.pop().toLowerCase() : '';
        ext = ext.replace(/[^a-z0-9]/g, '').slice(0, 8);
        if (!ext) {
          const mime = String(file.type || '').toLowerCase();
          ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg';
        }
        const unique = (window.crypto && typeof window.crypto.randomUUID === 'function')
          ? window.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        newPath = `orders/${order.id}/${unique}.${ext}`;

        const { error: uploadError } = await supabaseClient.storage
          .from(TALISMAN_BUCKET)
          .upload(newPath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || undefined,
          });
        if (uploadError) throw uploadError;

        const { data: publicData } = supabaseClient.storage
          .from(TALISMAN_BUCKET)
          .getPublicUrl(newPath);
        const publicUrl = publicData?.publicUrl || '';
        if (!publicUrl) throw new Error('Unable to create talisman public URL');

        const { error: rpcError } = await supabaseClient.rpc('admin_set_talisman_image', {
          p_order_id: order.id,
          p_image_url: publicUrl,
          p_image_path: newPath,
        });
        if (rpcError) throw rpcError;

        if (order.talismanImagePath && order.talismanImagePath !== newPath) {
          const { error: removeError } = await supabaseClient.storage
            .from(TALISMAN_BUCKET)
            .remove([order.talismanImagePath]);
          if (removeError) console.warn('Old talisman image cleanup failed:', removeError);
        }

        await refreshAdminData();
        closeTalismanUploadModal();
        renderOrdersPanel();
        alert('符图上传成功。订单仍保持原来的发货状态。');
      } catch (error) {
        console.error('Talisman upload error:', error);
        if (newPath) {
          supabaseClient.storage.from(TALISMAN_BUCKET).remove([newPath]).catch(() => {});
        }
        alert('符图上传失败：' + (error?.message || '请稍后重试。'));
        confirmBtn.disabled = false;
        confirmBtn.textContent = originalText;
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

  function escapeBookingText(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
          <div>
            ${escapeBookingText(b.date || '')} ${escapeBookingText(b.slot || '')}
            · ${Number(b.duration || 120)}分钟
            ${b.userEmail ? ' · ' + escapeBookingText(b.userEmail) : ''}
          </div>
          <div style="margin-top:5px;color:var(--text-muted);font-size:.82rem">
            联系电话：${b.phoneNumber ? escapeBookingText(b.phoneNumber) : '未填写'}
          </div>
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
