export const PROVIDERS = {
  openai: {
    title: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/responses',
    modelsEndpoint: 'https://api.openai.com/v1/models',
    model: 'gpt-6-luna',
    deviceEndpoint: 'https://chatgpt.com/backend-api/codex/responses',
    deviceModelsEndpoint: 'https://chatgpt.com/backend-api/codex/models?client_version=0.159.2',
    deviceModel: 'gpt-6-luna',
    placeholder: 'sk-…',
    copy: 'Use an API key or your ChatGPT device login. Authentication selects the model service.',
  },
  openrouter: {
    title: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    modelsEndpoint: 'https://openrouter.ai/api/v1/models',
    model: 'z-ai/glm-5.3-flash',
    placeholder: 'sk-or-…',
    copy: 'OpenAI-compatible Chat Completions with OpenRouter model routing.',
  },
  anthropic: {
    title: 'Anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    modelsEndpoint: 'https://api.anthropic.com/v1/models?limit=1000',
    model: 'claude-haiku-4-5',
    placeholder: 'sk-ant-…',
    copy: 'Anthropic’s native Messages API, including tools and thinking.',
  },
  xai: {
    title: 'xAI',
    endpoint: 'https://api.x.ai/v1/chat/completions',
    modelsEndpoint: 'https://api.x.ai/v1/models',
    deviceEndpoint: 'https://cli-chat-proxy.grok.com/v1/responses',
    deviceModelsEndpoint: 'https://cli-chat-proxy.grok.com/v1/models',
    model: 'grok-4.3',
    placeholder: 'xai-…',
    copy: 'Use an API key or sign in with your Grok subscription.',
  },
  connected: {
    title: 'Connected agent', endpoint: 'connected://', modelsEndpoint: '', model: '',
    copy: 'Use an agent on your computer. The runner connects to your ship; no inbound port is needed.',
  },
  custom: {
    title: 'Custom', endpoint: '', modelsEndpoint: '', model: '',
    placeholder: 'optional bearer token', copy: 'Any OpenAI-compatible Chat Completions endpoint.',
  },
}

export function providerOf(url = '') {
  if (url.startsWith('connected://')) return 'connected'
  return Object.entries(PROVIDERS).find(([id, provider]) => id !== 'custom' && (provider.endpoint === url || provider.deviceEndpoint === url))?.[0] || 'custom'
}
