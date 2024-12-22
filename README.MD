# cursor-api

## 获取key

1. 访问 [www.cursor.com](https://www.cursor.com) 并完成注册登录（赠送 250 次快速响应，可通过删除账号再注册重置）
2. 在浏览器中打开开发者工具（F12）
3. 找到 应用-Cookies 中名为 `WorkosCursorSessionToken` 的值并保存(相当于 openai 的密钥)

## 接口说明

### 基础对话（请求格式和响应格式参考 openai）

- 接口地址：`/v1/chat/completions`
- 请求方法：POST
- 认证方式：Bearer Token（使用 WorkosCursorSessionToken 的值，支持英文逗号分隔的 key 入参）

### 获取模型列表（在index.js中配置，参考cursor的模型列表）

- 接口地址：`/v1/models`
- 请求方法：GET

### 获取环境变量中的x-cursor-checksum

- 接口地址：`/env-checksum`
- 请求方法：GET

### 获取随机x-cursor-checksum

- 接口地址：`/checksum`
- 请求方法：GET

### 健康检查接口

- 接口地址：`/`
- 请求方法：GET

## 部署

### 本地部署

```bash
npm install
npm run start
```
接口地址：
- `http://localhost:3000/v1/chat/completions`
- `http://localhost:3000/v1/models`
- `http://localhost:3000/env-checksum`
- `http://localhost:3000/checksum`
- `http://localhost:3000/`


### huggingface部署

1. duplicate项目:
   [huggingface链接](https://huggingface.co/login?next=%2Fspaces%2Fstevenrk%2Fcursor%3Fduplicate%3Dtrue)
   - 调整git项目：
如果你fork了项目，可以在Dockerfile中调整git地址，调整为你的git地址
   - 调整接口地址：
   因为huggingface的限制，似乎无法直接访问`/v1/chat/completions`，所以在dockerfile中将接口调整为`/proxy/v1/chat/completions`。你可以根据需要调整。
   ```
   RUN sed -i 's/\/v1\/chat\/completions/\/proxy\/v1\/chat\/completions/g' src/index.js
   ```

2. 配置环境变量（一定要配置，一直随机会封号24小时）

   在你的space中，点击settings，找到`Variables and secrets`，添加Variables
   - name: `X_CURSOR_CHECKSUM`
   - value: 通过`/checksum`接口获取的随机checksum

3. 重新部署
   
   点击`Factory rebuild`，等待部署完成

4. 接口地址（`Embed this Space`中查看：

   Hugging Face Spaces的接口地址命名规则：
   ```
   {username}-{space-name}.hf.space
    ```
   
   举例：如果用户名是test，空间名是cursor，则接口地址为：
   ```
   https://test-cursor.hf.space/v1/models
   ```

## 注意事项
1. 请妥善保管您的 WorkosCursorSessionToken，不要泄露给他人
2. 请在部署的项目中，添加x-cursor-checksum到环境变量中，避免触发cursor的24小时多设备警告
3. 本项目仅供学习研究使用，请遵守 Cursor 的使用条款

---

## 鸣谢

- [cursor-api](https://github.com/zhx47/cursor-api) 基于该项目进行修改
- [cursor](https://huggingface.co/spaces/wIK5Ez2o/cursor/) (已删除) 基于该项目进行huggingface部署

## 许可证

MIT License