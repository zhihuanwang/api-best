require('dotenv').config();

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { stringToHex, chunkToUtf8String, getRandomIDPro } = require('./utils.js');
const { generateCursorChecksum, generateHashed64Hex } = require('./generate.js');
const app = express();

// 在文件开头附近添加
const startTime = new Date();
const version = '1.0.0';
let totalRequests = 0;
let activeRequests = 0;

// 中间件配置
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 添加支持的模型列表
const SUPPORTED_MODELS = [
  {
    id: "claude-3-5-sonnet-20241022",
    created: 1706571819,
    object: "model",
    owned_by: "anthropic"
  },
  {
    id: "claude-3-opus",
    created: 1706571819,
    object: "model",
    owned_by: "anthropic"
  },
  {
    id: "claude-3-5-haiku",
    created: 1706571819,
    object: "model",
    owned_by: "anthropic"
  },
  {
    id: "claude-3-5-sonnet",
    created: 1706571819,
    object: "model",
    owned_by: "anthropic"
  },
  {
    id: "cursor-small",
    created: 1706571819,
    object: "model",
    owned_by: "cursor"
  },
  {
    id: "gemini-exp-1206",
    created: 1706571819,
    object: "model",
    owned_by: "google"
  },
  {
    id: "gemini-2.0-flash-exp",
    created: 1706571819,
    object: "model",
    owned_by: "google"
  },
  {
    id: "gemini-2.0-flash-thinking-exp",
    created: 1706571819,
    object: "model",
    owned_by: "google"
  },
  {
    id: "gpt-3.5-turbo",
    created: 1706571819,
    object: "model",
    owned_by: "openai"
  },
  {
    id: "gpt-4",
    created: 1706571819,
    object: "model",
    owned_by: "openai"
  },
  {
    id: "gpt-4-turbo-2024-04-09",
    created: 1706571819,
    object: "model",
    owned_by: "openai"
  },
  {
    id: "gpt-4o",
    created: 1706571819,
    object: "model",
    owned_by: "openai"
  },
  {
    id: "gpt-4o-mini",
    created: 1706571819,
    object: "model",
    owned_by: "openai"
  },
  {
    id: "o1-mini",
    created: 1706571819,
    object: "model",
    owned_by: "openai"
  },
  {
    id: "o1-preview",
    created: 1706571819,
    object: "model",
    owned_by: "openai"
  }
];

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
      '/v1/chat/completions',
      '/v1/models', 
      '/checksum',
      '/env-checksum'
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
app.get('/v1/models', (req, res) => {
  res.json({
    object: "list",
    data: SUPPORTED_MODELS
  });
});

app.get('/checksum', (req, res) => {
  const checksum = generateCursorChecksum(generateHashed64Hex(), generateHashed64Hex());
  res.json({
    checksum
  });
});

// 添加获取环境变量checksum的接口
app.get('/env-checksum', (req, res) => {
  const envChecksum = process.env['X_CURSOR_CHECKSUM'];
  res.json({
    status: envChecksum ? 'configured' : 'not_configured',
    checksum: envChecksum || null
  });
});

app.post('/v1/chat/completions', async (req, res) => {
  // o1开头的模型，不支持流式输出
  if (req.body.model.startsWith('o1-') && req.body.stream) {
    return res.status(400).json({
      error: 'Model not supported stream',
    });
  }

  let currentKeyIndex = 0;
  try {
    const { model, messages, stream = false } = req.body;
    let authToken = req.headers.authorization?.replace('Bearer ', '');
    // 处理逗号分隔的密钥
    const keys = authToken.split(',').map((key) => key.trim());
    if (keys.length > 0) {
      // 确保 currentKeyIndex 不会越界
      if (currentKeyIndex >= keys.length) {
        currentKeyIndex = 0;
      }
      // 使用当前索引获取密钥
      authToken = keys[currentKeyIndex];
    }
    if (authToken && authToken.includes('%3A%3A')) {
      authToken = authToken.split('%3A%3A')[1];
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0 || !authToken) {
      return res.status(400).json({
        error: 'Invalid request. Messages should be a non-empty array and authorization is required',
      });
    }

    const hexData = await stringToHex(messages, model);

    // 生成checksum
    const checksum = req.headers['x-cursor-checksum'] 
                  ?? process.env['x-cursor-checksum'] 
                  ?? generateCursorChecksum(generateHashed64Hex(), generateHashed64Hex());

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
