require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
app.use(express.json());
app.use(cors());

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

// Tools
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: 'Get the current date and time',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Perform a math calculation',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'Math expression like 2+2' },
        },
        required: ['expression'],
      },
    },
  },
];

function runTool(name, args) {
  if (name === 'get_current_time') return new Date().toLocaleString();
  if (name === 'calculate') {
    try {
      return String(eval(args.expression));
    } catch {
      return 'Error in expression';
    }
  }
  return 'Unknown tool';
}

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    const conversation = [
      {
        role: 'system',
        content: 'You are a helpful AI agent. Use tools when needed. Be concise and friendly.',
      },
      ...messages,
    ];

    // Agent loop
    while (true) {
      const response = await client.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: conversation,
        tools,
        tool_choice: 'auto',
      });

      const message = response.choices[0].message;
      conversation.push(message);

      // Tool calls?
      if (message.tool_calls) {
        for (const call of message.tool_calls) {
          const args = JSON.parse(call.function.arguments || '{}');
          const result = runTool(call.function.name, args);

          conversation.push({
            role: 'tool',
            tool_call_id: call.id,
            content: result,
          });
        }
        continue;
      }

      // Final answer
      return res.json({ reply: message.content });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.json({ message: 'AI Agent API is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API running on port ${PORT}`));