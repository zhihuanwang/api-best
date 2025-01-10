require('dotenv').config();

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { stringToHex, chunkToUtf8String, getRandomIDPro } = require('./utils.js');
const { generateCursorChecksum, generateHashed64Hex } = require('./generate.js');
const { CursorAPI } = require('./usage.js')
const app = express();

// 在文件开头附近添加
const startTime = new Date();
const version = '1.0.0';
let totalRequests = 0;
let activeRequests = 0;
let authTokenAndCheckSum = null;
let currentKeyIndex = 0;
try {
  authTokenAndCheckSum = JSON.parse(process.env.WORK_OS_CURSOR_SESSION_TOKEN)
}catch (e) {
  console.log("json 格式错误")
}


// 认证中间件
const authMiddleware = (req, res, next) => {
  try {
    // 获取 Authorization header
    const authHeader = req.headers.authorization;

    // 检查 header 是否存在
    if (!authHeader) {
      return res.status(401).json({
        message: 'Authorization header missing'
      });
    }

    // Bearer Token 格式检查
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Invalid authorization format'
      });
    }

    // 获取 token
    const token = authHeader.split(' ')[1];

    // 验证 token
    if (!isValidToken(token)) {
      return res.status(401).json({
        message: 'Invalid token'
      });
    }

    // 验证通过,继续处理请求
    next();

  } catch (error) {
    return res.status(500).json({
      message: 'Authorization failed'
    });
  }
};

// token 验证逻辑
function isValidToken(token) {
  return process.env['AUTH_TOKEN'] === token;
}

// 应用中间件到所有路由
app.use(authMiddleware);
// 中间件配置
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 添加支持的模型列表
const SUPPORTED_MODELS = [
  {
    id: "cursor2api/claude-3-5-sonnet-20241022",
    created: 1706571819,
    object: "model",
    owned_by: "anthropic"
  },
  {
    id: "cursor2api/claude-3-opus",
    created: 1706571819,
    object: "model",
    owned_by: "anthropic"
  },
  {
    id: "cursor2api/claude-3-5-haiku",
    created: 1706571819,
    object: "model",
    owned_by: "anthropic"
  },
  {
    id: "cursor2api/claude-3-5-sonnet",
    created: 1706571819,
    object: "model",
    owned_by: "anthropic"
  },
  {
    id: "cursor2api/cursor-small",
    created: 1706571819,
    object: "model",
    owned_by: "cursor"
  },
  {
    id: "cursor2api/gemini-exp-1206",
    created: 1706571819,
    object: "model",
    owned_by: "google"
  },
  {
    id: "cursor2api/gemini-2.0-flash-exp",
    created: 1706571819,
    object: "model",
    owned_by: "google"
  },
  {
    id: "cursor2api/gemini-2.0-flash-thinking-exp",
    created: 1706571819,
    object: "model",
    owned_by: "google"
  },
  {
    id: "cursor2api/gpt-3.5-turbo",
    created: 1706571819,
    object: "model",
    owned_by: "openai"
  },
  {
    id: "cursor2api/gpt-4",
    created: 1706571819,
    object: "model",
    owned_by: "openai"
  },
  {
    id: "cursor2api/gpt-4-turbo-2024-04-09",
    created: 1706571819,
    object: "model",
    owned_by: "openai"
  },
  {
    id: "cursor2api/gpt-4o",
    created: 1706571819,
    object: "model",
    owned_by: "openai"
  },
  {
    id: "cursor2api/gpt-4o-mini",
    created: 1706571819,
    object: "model",
    owned_by: "openai"
  },
  {
    id: "cursor2api/o1-mini",
    created: 1706571819,
    object: "model",
    owned_by: "openai"
  },
  {
    id: "cursor2api/o1-preview",
    created: 1706571819,
    object: "model",
    owned_by: "openai"
  }
];
// 模型映射
const MODELS = {
  "cursor2api/claude-3-5-sonnet-20241022": "claude-3-5-sonnet-20241022",
  "cursor2api/claude-3-opus": "claude-3-opus",
  "cursor2api/claude-3-5-haiku": "claude-3-5-haiku",
  "cursor2api/claude-3-5-sonnet": "claude-3-5-sonnet",
  "cursor2api/cursor-small": "cursor-small",
  "cursor2api/gemini-exp-1206": "gemini-exp-1206",
  "cursor2api/gemini-2.0-flash-exp": "gemini-2.0-flash-exp",
  "cursor2api/gemini-2.0-flash-thinking-exp": "gemini-2.0-flash-thinking-exp",
  "cursor2api/gpt-3.5-turbo": "gpt-3.5-turbo",
  "cursor2api/gpt-4": "gpt-4",
  "cursor2api/gpt-4-turbo-2024-04-09": "gpt-4-turbo-2024-04-09",
  "cursor2api/gpt-4o": "gpt-4o",
  "cursor2api/gpt-4o-mini": "gpt-4o-mini",
  "cursor2api/o1-mini": "o1-mini",
  "cursor2api/o1-preview": "o1-preview"
}


// 修改根路由
app.get('/', (req, res) => {
  const uptime = Math.floor((new Date() - startTime) / 1000); // 运行时间(秒)
  
  res.json({
    status: 'healthy',
    version,
    uptime,
    stats: {
      started: startTime.toISOString(),
      totalRequests,
      activeRequests,
      memory: process.memoryUsage()
    },
    models: SUPPORTED_MODELS.map(model => model.id),
    endpoints: [
      '/api/v1/chat/completions',
      '/api/v1/models', 
      '/api/api/checksum',
      '/api/env-checksum'
    ]
  });
});

// 添加请求计数中间件
app.use((req, res, next) => {
  totalRequests++;
  activeRequests++;
  
  res.on('finish', () => {
    activeRequests--;
  });
  
  next();
});

// 添加新的路由处理模型列表请求
app.get('/api/v1/models', (req, res) => {
  res.json({
    object: "list",
    data: SUPPORTED_MODELS
  });
});

app.get('/api/checksum', (req, res) => {
  const checksum = generateCursorChecksum(generateHashed64Hex(), generateHashed64Hex());
  res.json({
    checksum
  });
});

// 添加获取环境变量checksum的接口
app.get('/api/env-checksum', (req, res) => {
  const envChecksum = process.env['X_CURSOR_CHECKSUM'];
  res.json({
    status: envChecksum ? 'configured' : 'not_configured',
    checksum: envChecksum || null
  });
});
app.get('/api/usage', async (req, res) => {
  try {
    // 首先检查数组是否有内容
    if (!authTokenAndCheckSum || authTokenAndCheckSum.length === 0) {
      return res.json([]);
    }

    let usage = [];
    // 修正循环条件
    for (let i = 0; i < authTokenAndCheckSum.length; i++) {
      const currentItem = authTokenAndCheckSum[i];

      // 检查当前项及其token是否存在
      if (currentItem && currentItem.token && currentItem.token.includes('%3A%3A')) {
        const usageArr = currentItem.token.split('%3A%3A');

        if (usageArr.length === 2) {
          try {
            const cursor = new CursorAPI(usageArr[1]);
            const status = await cursor.getUsage();

            usage.push({
              user: usageArr[0],
              status: status,
            });
          } catch (error) {
            console.error(`Error processing item ${i}:`, error);
            // 继续处理下一项

          }
        }
      }
    }

    res.json(usage);
  } catch (error) {
    console.error('Error in /api/usage:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.post('/api/v1/chat/completions', async (req, res) => {
  // o1开头的模型，不支持流式输出
  if (req.body.model.startsWith('o1-') && req.body.stream) {
    return res.status(400).json({
      error: 'Model not supported stream',
    });
  }


  try {
    const { model, messages, stream = false } = req.body;
    let authToken = req.headers.authorization?.replace('Bearer ', '');
    // let authToken = process.env['WORK_OS_CURSOR_SESSION_TOKEN'];
    // 处理逗号分隔的密钥
    // const keys = authToken.split(',').map((key) => key.trim());
    // if (keys.length > 0) {
    //   // 确保 currentKeyIndex 不会越界
    //   if (currentKeyIndex >= keys.length) {
    //     currentKeyIndex = 0;
    //   }
    //   // 使用当前索引获取密钥
    //   authToken = keys[currentKeyIndex];
    //   // todo 等这个session token用量使用完毕 currentKeyIndex ++
    // }
    let checksum = "";
    if (authTokenAndCheckSum.length > 0){
      currentKeyIndex = currentKeyIndex % authTokenAndCheckSum.length;
      authToken = authTokenAndCheckSum[currentKeyIndex].token;
      checksum = authTokenAndCheckSum[currentKeyIndex].checksum;
      console.log(`Using token index: ${currentKeyIndex}`);
      currentKeyIndex ++;
    }
    if (authToken && authToken.includes('%3A%3A')) {
      authToken = authToken.split('%3A%3A')[1];
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0 || !authToken) {
      return res.status(400).json({
        error: 'Invalid request. Messages should be a non-empty array and authorization is required',
      });
    }

    const hexData = await stringToHex(messages, MODELS[model]);

    // 生成checksum
    // const checksum = req.headers['x-cursor-checksum']
    //               ?? process.env['X_CURSOR_CHECKSUM']
    //               ?? generateCursorChecksum(generateHashed64Hex(), generateHashed64Hex());
    console.log("checksum is" + checksum)
    console.log("model is " + MODELS[model])
    console.log("model is " + model)

    const response = await fetch('https://api2.cursor.sh/aiserver.v1.AiService/StreamChat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/connect+proto',
        authorization: `Bearer ${authToken}`,
        'connect-accept-encoding': 'gzip,br',
        'connect-protocol-version': '1',
        'user-agent': 'connect-es/1.4.0',
        'x-amzn-trace-id': `Root=${uuidv4()}`,
        'x-cursor-checksum': checksum,
        'x-cursor-client-version': '0.42.3',
        'x-cursor-timezone': 'Asia/Shanghai',
        'x-ghost-mode': 'false',
        'x-request-id': uuidv4(),
        Host: 'api2.cursor.sh',
      },
      body: hexData,
    });

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const responseId = `chatcmpl-${uuidv4()}`;

      // 使用封装的函数处理 chunk
      for await (const chunk of response.body) {
        const text = await chunkToUtf8String(chunk);

        if (text.length > 0) {
          res.write(
            `data: ${JSON.stringify({
              id: responseId,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [
                {
                  index: 0,
                  delta: {
                    content: text,
                  },
                },
              ],
            })}\n\n`,
          );
        }
      }

      res.write('data: [DONE]\n\n');
      return res.end();
    } else {
      let text = '';
      // 在非流模式下也使用封装的函数
      for await (const chunk of response.body) {
        text += await chunkToUtf8String(chunk);
      }
      // 对解析后的字符串进行进一步处理
      text = text.replace(/^.*<\|END_USER\|>/s, '');
      text = text.replace(/^\n[a-zA-Z]?/, '').trim();
      // console.log(text)

      return res.json({
        id: `chatcmpl-${uuidv4()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: text,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      });
    }
  } catch (error) {
    console.error('Error:', error);
    if (!res.headersSent) {
      if (req.body.stream) {
        res.write(`data: ${JSON.stringify({ error: 'Internal server error' })}\n\n`);
        return res.end();
      } else {
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});
