/*
 * Huiwen YuanVerse - Customer Frontend English UI Layer
 * ------------------------------------------------------
 * Purpose:
 *   Translate ONLY known customer-facing structural/interface text to English.
 *   Product names/descriptions and announcement content are intentionally left
 *   unchanged so they can be authored bilingually by the site administrator.
 *
 * Notes:
 *   - Does not alter IDs, URLs, data-* attributes, referral codes, emails,
 *     database values, PayPal/Supabase values, or user-entered text.
 *   - Unknown Chinese text is left unchanged rather than machine-translated.
 *   - Default language is Traditional Chinese. The visitor can choose 中 | En.
 *   - The language choice is remembered in this browser.
 *   - Never runs on /admin/.
 */

(() => {
  'use strict';

  if (/\/admin(?:\/|$)/i.test(window.location.pathname)) return;

  const STORAGE_KEY = 'huiwen_ui_language';
  const ENGLISH = 'en';
  const CHINESE = 'zh';

  const SKIP_SELECTOR = [
    'script',
    'style',
    'noscript',
    'code',
    'pre',
    'textarea',
    'iframe',
    '[contenteditable="true"]',
    '[data-no-english]',
    '.ignore-english',

    // Boss-authored product content must remain exactly as entered.
    '.product-info-title',
    '.product-info-desc',
    '.cart-item-title',
    '.order-product',
    '.product-name',
    '.product-description',

    // Boss-authored announcement content must remain exactly as entered.
    '.announcement-text',
    '.announcement-content',
    '.announcement-body',
    '.announcement-detail-content',
    '.announcement-detail-body',
    '#announcement-content',
    '[data-announcement-content]',

    // Never rewrite what a visitor typed into the AI chat.
    '.ai-msg-user',
  ].join(',');

  const TEXT_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'];

  // Curated UI translations only. Unknown text is deliberately left untouched.
  const BASE_TRANSLATIONS = new Map(Object.entries({
    '慧文国际善缘界': 'Huiwen YuanVerse',
    '电子图片 · 多级分销 ·': 'Digital Images · Referrals ·',
    '电子图片 · 多级分销 · 佣金与善缘值': 'Digital Images · Referrals · Commission & Goodwill Points',
    '佣金与善缘值': 'Commission & Goodwill Points',
    '首页': 'Home',
    '最新公告': 'Latest Announcements',
    '社区掠影': 'Community Highlights',
    '正在载入...': 'Loading...',
    '暂无公告': 'No announcements yet.',
    '向左': 'Previous',
    '向右': 'Next',
    '查看公告': 'View announcement',
    '公告图片': 'Announcement image',

    '登录 / 注册': 'Sign In / Register',
    '先用一个简单账号体验完整流程，后面我们再接正式后端与支付。': 'Sign in or register to continue.',
    '邮箱': 'Email',
    '密码': 'Password',
    '至少 6 位': 'At least 6 characters',
    '显示密码': 'Show password',
    '隐藏密码': 'Hide password',
    '显示': 'Show',
    '隐藏': 'Hide',
    '忘记密码？': 'Forgot password?',
    '推荐码（可选）': 'Referral Code (optional)',
    '来自上级的邀请码 / 链接参数': 'Referral code from your inviter',
    '登录 / 注册并进入系统': 'Sign In / Register',
    '重置密码': 'Reset Password',
    '正式版将向邮箱发送重置链接。Demo 中：输入已注册邮箱，可直接设置新密码。': 'Enter your registered email to receive a password reset link.',
    '新密码': 'New Password',
    '确认新密码': 'Confirm New Password',
    '再次输入': 'Enter again',
    '确认重置': 'Send Reset Link',
    '返回登录': 'Back to Sign In',
    '清空本地数据（Demo 测试用）': 'Clear Local Test Data',

    '商品': 'Products',
    '订单': 'Orders',
    '团队': 'Team',
    '分享': 'Share',
    '客服预约': 'Bookings',
    '电子图片商品': 'Digital Products',
    '这里先用几款示例图片。后续可以替换成你的真实作品和价格。': 'Browse the available digital products below.',
    '我的订单': 'My Orders',
    '模拟购买记录，仅保存在本地。': 'Your purchase history.',
    '我的团队结构（树形）': 'My Team',
    '默认只显示直推，点击展开查看下级。最多 5 级，再往下仅管理员可见。': 'Direct referrals are shown first. Expand to view up to 5 levels.',
    '搜索': 'Search',
    '邀请码或邮箱': 'Referral code or email',

    '我的邀请码 & 账户概览': 'Referral & Account Overview',
    '下面的数据全部保存在本地浏览器中，用于演示多级分销下的佣金与善缘值累积。': 'View your referral, commission, balance, and goodwill information.',
    '我的邀请码': 'My Referral Code',
    '上级邀请码（如果有）': 'Referrer Code (if any)',
    '累计获得佣金': 'Total Commission Earned',
    '当前可提现金额（Demo：满 ￥100 可提现）': 'Available Balance (minimum ¥100 to withdraw)',
    '当前善缘值': 'Current Goodwill Points',
    '邀请统计': 'Referral Statistics',
    '申请提现': 'Request Withdrawal',
    '满 ￥100 可提现（Demo 仅扣减余额）': 'Minimum withdrawal: ¥100',
    '提现记录': 'Withdrawal History',
    '暂无提现记录': 'No withdrawal history.',

    '我的分享链接': 'My Referral Link',
    '专属分享链接': 'Your Referral Link',
    '复制': 'Copy',
    '建议在新窗口中打开该链接，以模拟新用户从你的分享进入系统的效果。': 'Share this link with people you invite.',

    'AI 咨询 & 真人预约': 'AI Help & Live Consultation',
    '先试试 AI 咨询，常见问题可即时解答。如需真人顾问，再预约即可。': 'Try the AI assistant for common questions, or book a live consultation.',
    'AI 咨询': 'AI Help',
    '输入问题，如：如何提现？佣金怎么算？': 'Type a question...',
    '发送': 'Send',
    'AI 回答不够？需要真人顾问？': 'Need help from a live advisor?',
    '真人咨询仅对购买客户开放。请先': 'Live consultations are available to customers who have made a purchase. Please ',
    '购买商品': 'purchase a product',
    '后再预约。': ' before booking.',
    '真人咨询预约': 'Live Consultation Booking',
    '咨询规则': 'Consultation Rules',
    '单次咨询不超过 2 小时，超时需再次预约': 'Each consultation is limited to 2 hours.',
    '可预约时间：每天 10:00–18:00，需提前至少 3 天': 'Available daily from 10:00–18:00; book at least 3 days in advance.',
    '请注意，预订时间为太平洋夏令时 (UTC-7)': 'Please note: booking times are in Pacific Daylight Time (UTC-7).',
    '预约日期': 'Booking Date',
    '预约时间': 'Booking Time',
    '请选择时间段': 'Select a time',
    '预约时长': 'Duration',
    '30 分钟': '30 minutes',
    '1 小时': '1 hour',
    '1.5 小时': '1.5 hours',
    '2 小时（上限）': '2 hours (maximum)',
    '提交预约': 'Submit Booking',
    '我的预约': 'My Bookings',
    '咨询进行中': 'Consultation in Progress',
    '结束咨询': 'End Consultation',

    '填写信息': 'Your Information',
    '请填写以下信息，用于制作专属电子图片。': 'Please provide the information needed to prepare your personalized digital item.',
    '姓名': 'Name',
    '请输入姓名': 'Enter your name',
    '出生年月日': 'Date of Birth',
    '出生年份': 'Birth year',
    '出生月份': 'Birth month',
    '出生日期': 'Birth date',
    '来自的国家': 'Country',
    '如：中国、加拿大': 'e.g. Canada',
    '取消': 'Cancel',
    '确认购买': 'Continue to Payment',
    '性别': 'Gender',
    '请选择': 'Select',
    '男': 'Male',
    '女': 'Female',
    '月': 'Month',
    '日': 'Day',

    '购物车': 'Cart',
    '已加入购物车的商品会保存在您的账号中。': 'Items in your cart are saved to your account.',
    '合计': 'Total',
    '购物车服务暂时不可用。': 'The cart is temporarily unavailable.',
    '请先登录，再加入购物车。': 'Please sign in before adding items to your cart.',
    '加入购物车失败，请稍后重试。': 'Could not add the item to your cart. Please try again.',
    '已加入购物车。': 'Added to cart.',
    '删除失败，请稍后重试。': 'Could not remove the item. Please try again.',
    '已从购物车删除。': 'Removed from cart.',
    '购物车还是空的。': 'Your cart is empty.',
    '立即购买': 'Buy Now',
    '加入购物车': 'Add to Cart',
    '删除': 'Remove',
    '已售罄': 'Sold Out',

    '当前：': 'Current: ',
    '邀请码': 'Referral Code',

    '请输入邮箱和密码。': 'Please enter your email and password.',
    '登录服务暂时不可用，请稍后重试。': 'Sign-in service is temporarily unavailable. Please try again.',
    '该邮箱已经注册。请检查密码后重试，或使用“忘记密码”。': 'This email is already registered. Check your password or use “Forgot password?”.',
    '注册失败，请稍后重试。': 'Registration failed. Please try again.',
    '请先完成邮箱验证，然后再登录。': 'Please verify your email before signing in.',
    '无法读取用户资料，请稍后重试。': 'Could not load your account. Please try again.',
    '推荐码无效或不存在，请确认后再填写。': 'The referral code is invalid or does not exist.',
    '创建用户资料失败，请稍后重试。': 'Could not create your account profile. Please try again.',
    '无法载入用户资料，请稍后重试。': 'Could not load your account profile. Please try again.',
    '登录或注册失败，请稍后重试。': 'Sign in or registration failed. Please try again.',

    '提现申请已提交，当前状态为待审核。': 'Withdrawal request submitted and is pending review.',
    '佣金余额需满 ￥100 才能申请提现。': 'Your commission balance must reach ¥100 before you can request a withdrawal.',
    '你已有一笔待审核的提现申请，请等待处理。': 'You already have a withdrawal request pending review.',
    '目前没有可提现余额。': 'There is currently no available balance to withdraw.',
    '提现申请提交失败，请稍后重试。': 'Could not submit the withdrawal request. Please try again.',

    '正在加载 PayPal…': 'Loading PayPal…',
    '请使用 PayPal 完成付款。': 'Please complete your payment with PayPal.',
    '正在确认付款…': 'Confirming payment…',
    '付款成功，正在保存订单和佣金…': 'Payment successful. Saving your order and commission…',
    '付款成功，订单和佣金已保存。': 'Payment successful. Your order has been saved.',
    '付款已取消，您可以重新尝试。': 'Payment cancelled. You can try again.',
    'PayPal 付款出现问题，请稍后重试。': 'There was a problem with PayPal. Please try again.',
    'PayPal 无法加载，请稍后重试。': 'PayPal could not load. Please try again.',
    '请填写姓名。': 'Please enter your name.',
    '请选择有效的出生年月日。年份必须为 4 位数字，且日期不能晚于今天。': 'Please enter a valid date of birth. The year must have 4 digits and the date cannot be in the future.',
    '出生年份必须是 4 位数字。': 'Birth year must be a 4-digit number.',
    '出生年份不能晚于当前年份。': 'Birth year cannot be later than the current year.',
    '请填写来自的国家。': 'Please enter your country.',
    '请选择性别。': 'Please select a gender.',
    '未找到商品信息，请重新选择商品。': 'Product information could not be found. Please select the product again.',
    '请先登录，再进行购买。': 'Please sign in before making a purchase.',
    '该商品已售罄。': 'This product is sold out.',
    '当前用户信息未找到，请重新登录。': 'Your account information could not be found. Please sign in again.',
    '购买成功！订单已生成。管理员会在制作完成并确认后，通过邮件向您发送专属符。': 'Purchase successful! Your order has been created. The completed personalized item will be sent to you by email.',

    '联系电话（含国家 / 地区代码）': 'Phone Number (include country/region code)',
    '例如：+1 604 555 1234': 'e.g. +1 604 555 1234',
    '仅用于本次预约联系与提醒。': 'Used only for this booking and related reminders.',
    '预约年份': 'Booking year',
    '预约年份必须是 4 位数字。': 'Booking year must be a 4-digit number.',
    '预约年份不能早于可预约年份。': 'Booking year cannot be earlier than the earliest available year.',
    '预约年份必须在注册后 3 至 30 天的可预约范围内。': 'The booking year must fall within the 3-to-30-day window after registration.',
    '预约月份': 'Booking month',
    '请先登录。': 'Please sign in first.',
    '请填写有效联系电话，并包含国家 / 地区代码，例如 +1 604 555 1234。': 'Enter a valid phone number including the country/region code, e.g. +1 604 555 1234.',
    '请选择预约日期和时间段。': 'Please select a booking date and time.',
    '预约已提交，当前状态为待确认。': 'Booking submitted and pending confirmation.',
    '这个时间段已经预约过了。': 'This time slot has already been booked.',
    '预约日期必须是今天之后。': 'The booking date must be after today.',
    '预约日期无效。': 'The booking date is invalid.',
    '预约时间必须在注册满 3 天后至注册后 30 天内。': 'The appointment must be at least 3 days and no more than 30 days after registration.',
    '预约提交失败，请稍后重试。': 'Could not submit the booking. Please try again.',
    '暂无预约': 'No bookings yet.',
    '待确认': 'Pending Confirmation',
    '已确认': 'Confirmed',
    '已完成': 'Completed',
    '已取消': 'Cancelled',
    '开始咨询': 'Start Consultation',
    '预约不存在。': 'This booking does not exist.',
    '该预约已过期或未到开始时间。': 'This booking has expired or has not reached its start time.',
    '本次咨询已达 2 小时上限，需再次预约。': 'This consultation has reached the 2-hour limit. Please book another session.',
    '免费咨询中（购买客户首 30 分钟免费）': 'Free consultation in progress (first 30 minutes free for customers).',
    '咨询中（30 分钟后需付费继续）': 'Consultation in progress (payment required after 30 minutes).',

    '待审核': 'Pending Review',
    '已批准': 'Approved',
    '已支付': 'Paid',
    '已拒绝': 'Rejected',

    '暂无订单': 'No orders yet.',
    '已复制分享链接，可以粘贴给好友。': 'Referral link copied. You can now share it.',
    '复制失败，请手动选择文本后复制。': 'Copy failed. Please select and copy the link manually.',
    '已尝试复制分享链接，如未成功，请手动选择文本复制。': 'Copy attempted. If it did not work, please select and copy the link manually.',
    '暂无下线，分享链接邀请好友注册即可。': 'No referrals yet. Share your referral link to invite someone.',
    '仅展示你下面最多 5 级，再往下仅管理员可见。': 'Your team is shown up to 5 levels. Deeper levels are visible only to administrators.',
    '直推': 'Direct',
    '收起': 'Collapse',
    '展开': 'Expand',

    '确定要清空所有本地 Demo 数据吗？将清除用户、订单、预约等，无法恢复。': 'Clear all local test data? This removes local users, orders, bookings, and other test data and cannot be undone.',
    '已清空本地数据，页面即将刷新。': 'Local test data cleared. The page will now refresh.',
    '请输入邮箱。': 'Please enter your email.',
    '密码重置服务暂时不可用。': 'Password reset service is temporarily unavailable.',
    '发送失败，请稍后重试。': 'Could not send the request. Please try again.',
    '密码重置邮件已发送，请检查邮箱。': 'Password reset email sent. Please check your inbox.',

    '你好，我是 AI 咨询助手。请问有什么可以帮您？': 'Hello! I’m the AI assistant. How can I help?',
    '感谢您的提问。若以上未解答，可尝试：1) 在「团队」页查看邀请规则；2) 在「佣金与善缘值」页查看提现说明；3) 需要真人顾问时，请点击下方预约。': 'Thanks for your question. You can check your Team for referral information, your Wallet for withdrawal information, or book a live consultation below.',
    '累计佣金满 ￥100 可申请提现。在「佣金与善缘值」页点击「申请提现」即可。Demo 仅做本地模拟。': 'You can request a withdrawal once your commission balance reaches ¥100. Go to Wallet and select “Request Withdrawal”.',
    '分享你的专属链接给好友，对方通过链接注册即成为你的下线。在「团队」页可查看下级结构。': 'Share your referral link. Anyone who registers through it will be added to your team, which you can view under Team.',
    '善缘值可用于参与不同类型及不同等级的专属活动，具体资格以相关活动规则为准。': 'Goodwill Points may be used to qualify for selected activities. Eligibility depends on the rules of each activity.',
    '如需真人顾问，可在此页下方选择日期和时间段提交预约。': 'To speak with a live advisor, choose a date and time below and submit a booking.',
  }));

  const translationAliases = new Map(BASE_TRANSLATIONS);

  function currentLanguage() {
    try {
      return localStorage.getItem(STORAGE_KEY) === ENGLISH ? ENGLISH : CHINESE;
    } catch {
      return CHINESE;
    }
  }

  function buildTraditionalAliases() {
    const helper = window.HuiwenTraditional;
    if (!helper || typeof helper.convert !== 'function') return;

    for (const [source, english] of BASE_TRANSLATIONS) {
      try {
        const traditional = helper.convert(source);
        if (traditional && traditional !== source) {
          translationAliases.set(traditional, english);
        }
      } catch {
        // Ignore a single alias failure and keep the base dictionary working.
      }
    }
  }

  function translatePattern(core) {
    let match;

    match = core.match(/^(?:库存|庫存)\s*(\d+)$/);
    if (match) return `Stock: ${match[1]}`;

    match = core.match(/^(?:直推)\s*(\d+)\s*人\s*·\s*(?:下级共|下級共)\s*(\d+)\s*人(?:\s*·\s*(?:本月新增)\s*(\d+)\s*人)?$/);
    if (match) {
      return `Direct: ${match[1]} · Total team: ${match[2]}${match[3] ? ` · New this month: ${match[3]}` : ''}`;
    }

    match = core.match(/^第\s*(\d+)\s*(?:级|級)$/);
    if (match) return `Level ${match[1]}`;

    match = core.match(/^(.+?)（(\d+)(?:级|級)）$/);
    if (match) return `${match[1]} (Level ${match[2]})`;

    match = core.match(/^(\d+)\s*(?:分钟|分鐘)$/);
    if (match) return `${match[1]} minutes`;

    match = core.match(/^(\d+)\s*(?:日)$/);
    if (match) return match[1];

    match = core.match(/^(\d+)\s*(?:月)$/);
    if (match) return match[1];

    match = core.match(/^(\d+)\s*(?:缘|緣)$/);
    if (match) return `${match[1]} pts`;

    match = core.match(/^(?:咨询中|諮詢中)\s*·\s*(?:已付费|已付費)\s*(\d+)\s*个半小时$/);
    if (match) return `Consultation in progress · ${match[1]} paid half-hour${match[1] === '1' ? '' : 's'}`;

    match = core.match(/^(?:需满|需滿)\s*￥([\d.]+)\s*(?:可申请提现|可申請提現)，(?:当前余额|當前餘額)\s*￥([\d.]+)。$/);
    if (match) return `A minimum balance of ¥${match[1]} is required. Current balance: ¥${match[2]}.`;

    match = core.match(/^(?:确定申请提现全部可用余额|確定申請提現全部可用餘額)\s*￥([\d.]+)？(?:提交后将进入审核|提交後將進入審核)。$/);
    if (match) return `Request withdrawal of the full available balance of ¥${match[1]}? It will be submitted for review.`;

    match = core.match(/^(?:免费时间已到|免費時間已到)。(?:继续需支付|繼續需支付)\s*\$([\d.]+)\s*(?:加币|加幣)\/(?:半小时|半小時)。\n\n(?:点击|點擊)「(?:确定|確定)」(?:继续|繼續)（Demo (?:模拟支付|模擬支付)），「取消」(?:结束咨询|結束諮詢)。$/);
    if (match) return `Your free time has ended. Continuing costs CAD $${match[1]} per half hour.\n\nSelect “OK” to continue (test payment) or “Cancel” to end the consultation.`;

    match = core.match(/^(?:已咨询|已諮詢)\s*30\s*(?:分钟|分鐘)。(?:继续需支付|繼續需支付)\s*\$([\d.]+)\s*(?:加币|加幣)\/(?:半小时|半小時)。\n\n(?:点击|點擊)「(?:确定|確定)」(?:继续|繼續)（Demo (?:模拟支付|模擬支付)），「取消」(?:结束咨询|結束諮詢)。$/);
    if (match) return `30 minutes have elapsed. Continuing costs CAD $${match[1]} per half hour.\n\nSelect “OK” to continue (test payment) or “Cancel” to end the consultation.`;

    match = core.match(/^(?:免费时间已到|免費時間已到)。(?:继续需支付|繼續需支付)\s*\$([\d.]+)\s*(?:加币|加幣)\/(?:半小时|半小時)。$/);
    if (match) return `Your free time has ended. Continuing costs CAD $${match[1]} per half hour.`;

    match = core.match(/^(?:已咨询|已諮詢)\s*30\s*(?:分钟|分鐘)。(?:继续需支付|繼續需支付)\s*\$([\d.]+)\s*(?:加币|加幣)\/(?:半小时|半小時)。$/);
    if (match) return `30 minutes have elapsed. Continuing costs CAD $${match[1]} per half hour.`;

    match = core.match(/^(?:购买成功|購買成功)！《(.+)》(?:已发送到您的邮箱|已發送到您的郵箱)\s+(.+)，(?:请查收|請查收)。$/);
    if (match) return `Purchase successful! “${match[1]}” has been sent to ${match[2]}. Please check your email.`;

    match = core.match(/^(?:购买成功|購買成功)！《(.+)》(?:已生成订单|已生成訂單)。(?:管理员制作完成并确认后|管理員製作完成並確認後)，(?:会通过邮件向您发送专属符|會通過郵件向您發送專屬符)，(?:请留意查收|請留意查收)。$/);
    if (match) return `Purchase successful! Your order for “${match[1]}” has been created. The completed personalized item will be sent to you by email.`;

    match = core.match(/^(?:购买成功|購買成功)！《(.+)》(?:已生成订单|已生成訂單)，(?:管理员将根据订单制作电子图片并发送至您的邮箱|管理員將根據訂單製作電子圖片並發送至您的郵箱)。$/);
    if (match) return `Purchase successful! Your order for “${match[1]}” has been created and will be prepared and sent to your email.`;

    match = core.match(/^￥([\d.]+)\s*·\s*(.+?)\s*·\s*(.+)$/);
    if (match) {
      const translatedStatus = translationAliases.get(match[2]) || match[2];
      return `¥${match[1]} · ${translatedStatus} · ${match[3]}`;
    }

    return null;
  }

  function translateCore(core) {
    if (!core) return core;

    const direct = translationAliases.get(core);
    if (direct !== undefined) return direct;

    const patterned = translatePattern(core);
    return patterned !== null ? patterned : core;
  }

  function translateText(value) {
    if (currentLanguage() !== ENGLISH || value == null) return value;

    const original = String(value);
    if (!original) return original;

    const match = original.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!match) return original;

    const [, leading, core, trailing] = match;
    if (!core) return original;

    return leading + translateCore(core) + trailing;
  }

  function shouldSkipNode(node) {
    if (!node) return true;
    const element =
      node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!element) return false;
    return Boolean(element.closest(SKIP_SELECTOR));
  }

  function translateTextNode(textNode) {
    if (
      !textNode ||
      textNode.nodeType !== Node.TEXT_NODE ||
      shouldSkipNode(textNode)
    ) {
      return;
    }

    const before = textNode.nodeValue;
    const after = translateText(before);
    if (after !== before) textNode.nodeValue = after;
  }

  function translateElementAttributes(element) {
    if (
      !element ||
      element.nodeType !== Node.ELEMENT_NODE ||
      shouldSkipNode(element)
    ) {
      return;
    }

    for (const attr of TEXT_ATTRIBUTES) {
      if (!element.hasAttribute(attr)) continue;
      const before = element.getAttribute(attr);
      const after = translateText(before);
      if (after !== before) element.setAttribute(attr, after);
    }

    if (
      element instanceof HTMLInputElement &&
      /^(button|submit|reset)$/i.test(element.type)
    ) {
      const before = element.value;
      const after = translateText(before);
      if (after !== before) element.value = after;
    }
  }

  function applySpecialEnglishLabels() {
    if (currentLanguage() !== ENGLISH) return;

    // IMPORTANT:
    // Only mutate the DOM when a label actually needs changing.
    // MutationObserver watches the page, so repeatedly assigning the same
    // innerHTML/textContent can create an endless observer -> mutation loop.
    const logout = document.getElementById('btn-logout');
    if (logout) {
      const expectedLogout = 'Log<br>out';
      if (logout.innerHTML !== expectedLogout) {
        logout.innerHTML = expectedLogout;
      }
    }

    // Short navigation labels keep the existing one-line mobile menu usable.
    const navLabels = {
      home: 'Home',
      products: 'Products',
      cart: 'Cart',
      orders: 'Orders',
      network: 'Team',
      wallet: 'Wallet',
      share: 'Share',
      support: 'Bookings',
    };

    for (const [tab, label] of Object.entries(navLabels)) {
      const button = document.querySelector(`.tab-bar [data-tab="${tab}"]`);
      if (!button) continue;

      if (tab === 'cart') {
        let count = button.querySelector('#cart-tab-count');

        if (!count) {
          const numberMatch = String(button.textContent || '').match(/(\d+)/);
          const number = numberMatch ? numberMatch[1] : '0';

          button.textContent = '';
          button.appendChild(document.createTextNode('Cart '));

          count = document.createElement('span');
          count.id = 'cart-tab-count';
          count.className = 'cart-tab-count';
          count.textContent = number;
          button.appendChild(count);
        } else {
          const firstNode = button.firstChild;
          if (
            !firstNode ||
            firstNode.nodeType !== Node.TEXT_NODE ||
            firstNode.nodeValue !== 'Cart '
          ) {
            if (firstNode && firstNode.nodeType === Node.TEXT_NODE) {
              firstNode.nodeValue = 'Cart ';
            } else {
              button.insertBefore(document.createTextNode('Cart '), count);
            }
          }
        }
      } else if (button.textContent !== label) {
        button.textContent = label;
      }
    }

    if (document.documentElement.lang !== 'en') {
      document.documentElement.lang = 'en';
    }
  }

  function translateDocumentTitle() {
    if (currentLanguage() !== ENGLISH) return;
    const translated = translateText(document.title);
    if (translated !== document.title) document.title = translated;
  }

  function translateSubtree(root) {
    if (currentLanguage() !== ENGLISH || !root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }

    if (
      root.nodeType !== Node.ELEMENT_NODE &&
      root.nodeType !== Node.DOCUMENT_NODE &&
      root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE
    ) {
      return;
    }

    if (root.nodeType === Node.ELEMENT_NODE && shouldSkipNode(root)) return;

    if (root.nodeType === Node.ELEMENT_NODE) {
      translateElementAttributes(root);
    }

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (shouldSkipNode(node)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        translateTextNode(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        translateElementAttributes(node);
      }
      node = walker.nextNode();
    }

    applySpecialEnglishLabels();
    translateDocumentTitle();
  }

  let observer = null;
  const pendingRoots = new Set();
  let flushScheduled = false;

  function scheduleTranslation(root) {
    if (currentLanguage() !== ENGLISH || !root) return;

    pendingRoots.add(root);
    if (flushScheduled) return;
    flushScheduled = true;

    requestAnimationFrame(() => {
      flushScheduled = false;
      const roots = Array.from(pendingRoots);
      pendingRoots.clear();

      for (const item of roots) translateSubtree(item);

      applySpecialEnglishLabels();
      translateDocumentTitle();
    });
  }

  function installObserver() {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
      if (currentLanguage() !== ENGLISH) return;

      for (const mutation of mutations) {
        if (mutation.type === 'characterData' || mutation.type === 'attributes') {
          scheduleTranslation(mutation.target);
          continue;
        }

        for (const addedNode of mutation.addedNodes) {
          scheduleTranslation(addedNode);
        }
      }
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TEXT_ATTRIBUTES, 'value'],
    });
  }

  function installDialogHooks() {
    if (window.__huiwenEnglishDialogsInstalled) return;
    window.__huiwenEnglishDialogsInstalled = true;

    const originalAlert = window.alert.bind(window);
    const originalConfirm = window.confirm.bind(window);
    const originalPrompt = window.prompt.bind(window);

    window.alert = (message) => originalAlert(translateText(message));
    window.confirm = (message) => originalConfirm(translateText(message));
    window.prompt = (message, defaultValue) =>
      originalPrompt(translateText(message), defaultValue);
  }

  function injectLanguageSelector() {
    if (document.getElementById('huiwen-language-wrap')) return;

    const header = document.querySelector('.app-header');
    const logout = document.getElementById('btn-logout');
    if (!header || !logout) return;

    const wrap = document.createElement('div');
    wrap.id = 'huiwen-language-wrap';
    wrap.dataset.noEnglish = '1';

    header.insertBefore(wrap, logout);
    wrap.appendChild(logout);

    const selector = document.createElement('div');
    selector.id = 'huiwen-language-selector';
    selector.setAttribute('aria-label', 'Language');
    selector.innerHTML = `
      <button type="button" class="huiwen-lang-btn" data-lang="zh" aria-label="中文">中</button>
      <span class="huiwen-lang-divider">|</span>
      <button type="button" class="huiwen-lang-btn" data-lang="en" aria-label="English">En</button>
    `;
    wrap.appendChild(selector);

    if (!document.getElementById('huiwen-language-style')) {
      const style = document.createElement('style');
      style.id = 'huiwen-language-style';
      style.textContent = `
        #huiwen-language-wrap{
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          gap:3px;
          flex:0 0 auto;
          margin-left:auto;
          min-width:36px;
        }
        #huiwen-language-wrap .header-logout{
          margin-left:0!important;
        }
        #huiwen-language-selector{
          display:flex;
          align-items:center;
          justify-content:center;
          gap:3px;
          white-space:nowrap;
          line-height:1;
          font-size:clamp(.48rem,1.15vw,.68rem);
          color:rgba(240,230,207,.55);
          user-select:none;
        }
        .huiwen-lang-btn{
          appearance:none;
          border:0;
          padding:1px 2px;
          margin:0;
          background:transparent;
          color:rgba(240,230,207,.58);
          font:inherit;
          line-height:1;
          cursor:pointer;
        }
        .huiwen-lang-btn:hover{
          color:#f0e6cf;
        }
        .huiwen-lang-btn.is-active{
          color:#e7bd62;
          font-weight:700;
        }
        .huiwen-lang-divider{
          opacity:.45;
        }
        @media (max-width:700px){
          #huiwen-language-wrap{
            min-width:30px;
            gap:2px;
          }
          #huiwen-language-selector{
            font-size:clamp(.43rem,1.65vw,.56rem);
            gap:2px;
          }
          .huiwen-lang-btn{
            padding:1px;
          }
        }
      `;
      document.head.appendChild(style);
    }

    selector.addEventListener('click', (event) => {
      const button = event.target.closest('[data-lang]');
      if (!button) return;

      const requested = button.dataset.lang === ENGLISH ? ENGLISH : CHINESE;
      if (requested === currentLanguage()) return;

      try {
        localStorage.setItem(STORAGE_KEY, requested);
      } catch {
        // If storage is blocked, reload still safely falls back to Chinese.
      }

      window.location.reload();
    });

    updateSelectorState();
  }

  function updateSelectorState() {
    const active = currentLanguage();
    document.querySelectorAll('.huiwen-lang-btn').forEach((button) => {
      const selected = button.dataset.lang === active;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  function refreshEnglish() {
    buildTraditionalAliases();

    if (currentLanguage() === ENGLISH) {
      translateSubtree(document.documentElement);
      applySpecialEnglishLabels();
      translateDocumentTitle();
    }

    updateSelectorState();
  }

  function startEnglishLayer() {
    injectLanguageSelector();
    installDialogHooks();
    installObserver();
    refreshEnglish();

    // traditional.js loads OpenCC asynchronously. Once it is ready, add
    // Traditional-Chinese aliases and make sure English remains the page lang.
    document.addEventListener('huiwen:traditional-ready', refreshEnglish);

    window.HuiwenEnglish = Object.freeze({
      get language() {
        return currentLanguage();
      },
      refresh: refreshEnglish,
      version: '1.0.3',
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startEnglishLayer, { once: true });
  } else {
    startEnglishLayer();
  }
})();
