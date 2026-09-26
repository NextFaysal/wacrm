import type { AiConfig, AiUsage, ChatMessage } from '@/lib/ai/types';
import { aiRequestTimeoutMs } from '@/lib/ai/defaults';
import type { ToolContext, ToolDefinition } from './tools';

interface RunLlmAgentArgs {
  config: AiConfig;
  systemPrompt: string;
  messages: ChatMessage[];
  tools: Record<string, ToolDefinition>;
  toolContext: ToolContext;
  maxTurns?: number;
}

export interface LlmAgentResult {
  text: string;
  toolsExecuted: string[];
  usage?: AiUsage;
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export async function runLlmAgentWithTools(args: RunLlmAgentArgs): Promise<LlmAgentResult> {
  const { config, systemPrompt, messages, tools, toolContext, maxTurns = 5 } = args;

  if (config.provider === 'anthropic') {
    return runAnthropicToolLoop({
      apiKey: config.apiKey,
      model: config.model || 'claude-3-5-haiku-20241022',
      systemPrompt,
      messages,
      tools,
      toolContext,
      maxTurns,
    });
  }

  if (config.provider === 'gemini') {
    return runOpenAiToolLoop({
      endpoint: GEMINI_URL,
      providerName: 'Google Gemini',
      apiKey: config.apiKey,
      model: config.model || 'gemini-2.5-flash',
      systemPrompt,
      messages,
      tools,
      toolContext,
      maxTurns,
    });
  }

  // Default: OpenAI
  return runOpenAiToolLoop({
    endpoint: OPENAI_URL,
    providerName: 'OpenAI',
    apiKey: config.apiKey,
    model: config.model || 'gpt-4o-mini',
    systemPrompt,
    messages,
    tools,
    toolContext,
    maxTurns,
  });
}

// -------------------------------------------------------------
// OpenAI & Gemini Tool-Calling Runner
// -------------------------------------------------------------
async function runOpenAiToolLoop(params: {
  endpoint?: string;
  providerName?: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
  tools: Record<string, ToolDefinition>;
  toolContext: ToolContext;
  maxTurns: number;
}): Promise<LlmAgentResult> {
  const {
    endpoint = OPENAI_URL,
    providerName = 'OpenAI',
    apiKey,
    model,
    systemPrompt,
    messages,
    tools,
    toolContext,
    maxTurns,
  } = params;
  const timeoutMs = aiRequestTimeoutMs();
  const toolsExecuted: string[] = [];

  const formattedTools = Object.values(tools).map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  // Build OpenAI message chain
  const conversationChain: any[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  let accumulatedUsage: AiUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let finalReplyText = '';

  for (let turn = 0; turn < maxTurns; turn++) {
    const requestBody: Record<string, unknown> = {
      model,
      messages: conversationChain,
      tools: formattedTools,
      tool_choice: 'auto',
    };
    if (providerName === 'OpenAI') {
      requestBody.max_completion_tokens = 1024;
    } else {
      requestBody.max_tokens = 1024;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`${providerName} API error [${res.status}]: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    const choice = data?.choices?.[0];
    const message = choice?.message;

    if (data?.usage) {
      accumulatedUsage.promptTokens += data.usage.prompt_tokens || 0;
      accumulatedUsage.completionTokens += data.usage.completion_tokens || 0;
      accumulatedUsage.totalTokens += data.usage.total_tokens || 0;
    }

    if (!message) break;

    // Check if the LLM invoked any tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      // Append assistant's tool-calls turn to context
      conversationChain.push(message);

      for (const call of message.tool_calls) {
        const toolName = call.function?.name;
        toolsExecuted.push(toolName);

        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(call.function?.arguments || '{}');
        } catch {
          parsedArgs = {};
        }

        const tool = tools[toolName];
        let toolOutput: unknown;

        if (tool) {
          try {
            toolOutput = await tool.handler(parsedArgs, toolContext);
          } catch (e: any) {
            toolOutput = { error: e?.message || 'Tool execution failed' };
          }
        } else {
          toolOutput = { error: `Tool "${toolName}" not found.` };
        }

        conversationChain.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(toolOutput),
        });
      }
    } else {
      // Final message text
      finalReplyText = message.content?.trim() || '';
      break;
    }
  }

  return {
    text: finalReplyText,
    toolsExecuted,
    usage: accumulatedUsage,
  };
}

// -------------------------------------------------------------
// Anthropic Tool-Calling Runner
// -------------------------------------------------------------
async function runAnthropicToolLoop(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
  tools: Record<string, ToolDefinition>;
  toolContext: ToolContext;
  maxTurns: number;
}): Promise<LlmAgentResult> {
  const { apiKey, model, systemPrompt, messages, tools, toolContext, maxTurns } = params;
  const timeoutMs = aiRequestTimeoutMs();
  const toolsExecuted: string[] = [];

  const formattedTools = Object.values(tools).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));

  // Anthropic messages format
  const conversationChain: any[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Ensure first message is user
  if (conversationChain.length === 0 || conversationChain[0].role !== 'user') {
    conversationChain.unshift({ role: 'user', content: 'Hello' });
  }

  let accumulatedUsage: AiUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let finalReplyText = '';

  for (let turn = 0; turn < maxTurns; turn++) {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages: conversationChain,
        tools: formattedTools,
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Anthropic API error [${res.status}]: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    if (data?.usage) {
      accumulatedUsage.promptTokens += data.usage.input_tokens || 0;
      accumulatedUsage.completionTokens += data.usage.output_tokens || 0;
      accumulatedUsage.totalTokens = accumulatedUsage.promptTokens + accumulatedUsage.completionTokens;
    }

    const contentBlocks = data?.content || [];
    conversationChain.push({ role: 'assistant', content: contentBlocks });

    const toolUseBlocks = contentBlocks.filter((b: any) => b.type === 'tool_use');

    if (toolUseBlocks.length > 0) {
      const toolResults: any[] = [];

      for (const block of toolUseBlocks) {
        const toolName = block.name;
        toolsExecuted.push(toolName);
        const tool = tools[toolName];
        let toolOutput: unknown;

        if (tool) {
          try {
            toolOutput = await tool.handler(block.input || {}, toolContext);
          } catch (e: any) {
            toolOutput = { error: e?.message || 'Tool execution failed' };
          }
        } else {
          toolOutput = { error: `Tool "${toolName}" not found.` };
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(toolOutput),
        });
      }

      conversationChain.push({ role: 'user', content: toolResults });
    } else {
      const textBlock = contentBlocks.find((b: any) => b.type === 'text');
      finalReplyText = textBlock?.text?.trim() || '';
      break;
    }
  }

  return {
    text: finalReplyText,
    toolsExecuted,
    usage: accumulatedUsage,
  };
}
