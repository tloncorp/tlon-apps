import assert from 'node:assert/strict'
import test from 'node:test'

import { PROVIDERS, providerOf } from './providers.mjs'

test('provider presets use the intended lightweight defaults', () => {
  assert.equal(PROVIDERS.openrouter.model, 'z-ai/glm-5.3-flash')
  assert.equal(PROVIDERS.openai.model, 'gpt-6-luna')
  assert.equal(PROVIDERS.openai.deviceModel, 'gpt-6-luna')
  assert.equal(PROVIDERS.anthropic.model, 'claude-haiku-4-5')
})

test('OpenAI API and subscription presets use distinct Responses endpoints', () => {
  assert.equal(PROVIDERS.openai.endpoint, 'https://api.openai.com/v1/responses')
  assert.equal(PROVIDERS.openai.deviceEndpoint, 'https://chatgpt.com/backend-api/codex/responses')
  assert.equal(providerOf(PROVIDERS.openai.endpoint), 'openai')
  assert.equal(providerOf(PROVIDERS.openai.deviceEndpoint), 'openai')
})

test('Anthropic selects the native Messages API', () => {
  assert.equal(PROVIDERS.anthropic.endpoint, 'https://api.anthropic.com/v1/messages')
  assert.equal(providerOf(PROVIDERS.anthropic.endpoint), 'anthropic')
})
