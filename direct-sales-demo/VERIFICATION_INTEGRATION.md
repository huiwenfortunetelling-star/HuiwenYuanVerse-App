# 防伪验证对接说明

## 对接流程

1. **配置验证页 URL**：向防伪服务商获取「扫码后跳转的验证页地址」
   - 例如：`https://verify.example.com/check`
   - 系统会在二维码中生成：`https://verify.example.com/check?code=订单号`

2. **配置 URL 参数名**：确认验证页用哪个参数接收订单号
   - 常见：`code`、`id`、`sn` 等
   - 若验证页格式为 `?id=xxx`，则填 `id`

3. **配置注册 API**（若服务商要求先推送数据）：
   - 发货时，系统会 POST 订单数据到该 API
   - 推送字段：orderId, productName, buyerName, buyerEmail, buyerDob, buyerCountry, createdAt, shippedAt

4. **API Key**：若服务商要求认证，填写后会在请求头中加上 `X-Api-Key`

## 需向防伪服务商确认

- 验证页的完整 URL 格式（是否带参数、参数名）
- 是否需要先调用注册 API 推送订单数据
- 注册 API 的地址、请求方法（POST）、请求体格式
- 是否需要 API Key 或其它认证方式

## 配置位置

管理后台 → 订单记录 → 防伪验证对接
