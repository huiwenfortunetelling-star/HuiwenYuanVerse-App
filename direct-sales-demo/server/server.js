/**
 * 慧文国际善缘界 - 电子图片发货服务
 *
 * 购买完成后，调用本接口可将电子图片发送到客户邮箱。
 *
 * 配置方式：复制 .env.example 为 .env，填写邮箱 SMTP 信息
 *
 * 支持的邮箱：
 * - Gmail: 需开启「应用专用密码」
 * - QQ 邮箱: 使用授权码
 * - 163 邮箱: 使用授权码
 * - 企业邮箱: 按服务商说明配置
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // 图片 base64 可能较大

const PORT = process.env.PORT || 3001;

// 从环境变量读取 SMTP 配置
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.qq.com',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: process.env.SMTP_SECURE !== 'false',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * POST /api/deliver
 * 发货接口：将电子图片发送到客户邮箱
 *
 * Body: {
 *   buyerEmail: string,   // 客户邮箱
 *   productName: string,   // 商品名称
 *   productImage: string  // base64 图片，如 data:image/jpeg;base64,xxx
 * }
 */
app.post('/api/deliver', async (req, res) => {
  const { buyerEmail, productName, productImage } = req.body;

  if (!buyerEmail || !productName) {
    return res.status(400).json({ ok: false, error: '缺少 buyerEmail 或 productName' });
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(500).json({
      ok: false,
      error: '未配置邮箱：请在 .env 中设置 SMTP_USER 和 SMTP_PASS',
    });
  }

  const fromName = process.env.MAIL_FROM_NAME || '慧文国际善缘界';

  const mailOptions = {
    from: `"${fromName}" <${process.env.SMTP_USER}>`,
    to: buyerEmail,
    subject: `【${fromName}】您购买的电子图片：${productName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">感谢您的购买</h2>
        <p>您购买的电子图片《${productName}》已随本邮件送达，请查收附件。</p>
        <p>如有问题，请联系客服。</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">${fromName}</p>
      </div>
    `,
    attachments: [],
  };

  if (productImage) {
    const match = productImage.match(/^data:image\/(\w+);base64,(.+)$/);
    if (match) {
      const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      mailOptions.attachments.push({
        filename: `${(productName || '电子图片').replace(/[/\\?%*:|"<>]/g, '_')}.${ext}`,
        content: match[2],
        encoding: 'base64',
      });
    }
  }

  try {
    await transporter.sendMail(mailOptions);
    res.json({ ok: true, message: '已发送到客户邮箱' });
  } catch (err) {
    console.error('发送邮件失败:', err);
    res.status(500).json({
      ok: false,
      error: err.message || '发送失败',
    });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    configured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
  });
});

app.listen(PORT, () => {
  console.log(`发货服务已启动: http://localhost:${PORT}`);
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('⚠ 未配置 SMTP，请创建 .env 并填写 SMTP_USER、SMTP_PASS');
  }
});
