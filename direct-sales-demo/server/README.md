# 电子图片发货服务

客户购买电子图片后，自动将图片发送到客户邮箱。

## 快速开始

1. 安装依赖：
   ```bash
   cd server
   npm install
   ```

2. 配置邮箱（复制 `.env.example` 为 `.env`）：
   ```
   SMTP_USER=your@qq.com
   SMTP_PASS=你的授权码
   ```

3. 启动服务：
   ```bash
   npm start
   ```

4. 在前端 `app.js` 中配置发货地址：
   ```javascript
   const DELIVERY_API_URL = 'http://localhost:3001';
   ```

## 邮箱配置说明

| 邮箱 | SMTP_HOST | 密码说明 |
|------|-----------|----------|
| QQ 邮箱 | smtp.qq.com | 在 QQ 邮箱设置 → 账户 → POP3/SMTP 中开启并获取授权码 |
| 163 邮箱 | smtp.163.com | 在网易邮箱设置中开启 SMTP 后获取授权码 |
| Gmail | smtp.gmail.com | 需开启两步验证，再生成「应用专用密码」 |

## 使用方式

- **不配置**：客户购买后，在「订单」页点击「下载」获取图片
- **配置后**：客户购买后，图片自动发到其注册邮箱，同时订单页仍可下载
