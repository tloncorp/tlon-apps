// Client-side format validation for Tlawn provider API keys.
// Matches the rules applied by the Horizon dashboard so bad keys get caught
// before we round-trip to hosting.
export function validateProviderKey(
  provider: string,
  value: string
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter an API key.';
  switch (provider) {
    case 'anthropic':
      if (!trimmed.startsWith('sk-ant-') && !trimmed.startsWith('anthropic-'))
        return 'Key must start with "sk-ant-" or "anthropic-".';
      if (trimmed.length < 80) return 'Key must be at least 80 characters.';
      break;
    case 'openai':
      if (!trimmed.startsWith('sk-')) return 'Key must start with "sk-".';
      break;
    case 'openrouter':
      if (!trimmed.startsWith('sk-or-')) return 'Key must start with "sk-or-".';
      break;
  }
  return null;
}
