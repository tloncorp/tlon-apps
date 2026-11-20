// Bounded UTF-8 SSE decoder. IDs are delivered only with complete events.
export async function* readSSE(stream, { maxBytes = 2 * 1024 * 1024, onActivity = () => {} } = {}) {
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let buffer = '', data = [], id = '', event = '', size = 0, skipLF = false
  for await (const chunk of stream) {
    onActivity()
    buffer += decoder.decode(chunk, { stream: true })
    while (buffer.length) {
      if (skipLF) { if (buffer[0] === '\n') buffer = buffer.slice(1); skipLF = false }
      const end = buffer.search(/[\r\n]/)
      if (end < 0) break
      const line = buffer.slice(0, end)
      skipLF = buffer[end] === '\r'
      buffer = buffer.slice(end + 1)
      size += Buffer.byteLength(line) + 1
      if (size > maxBytes) throw new Error('SSE event exceeds its size limit.')
      if (!line) {
        if (data.length) yield { id, event: event || 'message', data: data.join('\n') }
        data = []; id = ''; event = ''; size = 0
        continue
      }
      if (line.startsWith(':')) continue
      const colon = line.indexOf(':')
      const field = colon < 0 ? line : line.slice(0, colon)
      const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '')
      if (field === 'data') data.push(value)
      if (field === 'id' && !value.includes('\0')) id = value
      if (field === 'event') event = value
    }
    if (Buffer.byteLength(buffer) + size > maxBytes) throw new Error('SSE event exceeds its size limit.')
  }
  decoder.decode()
  // An unterminated frame is not acknowledged or executed.
}
