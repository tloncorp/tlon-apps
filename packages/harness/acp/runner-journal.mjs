import { mkdir, open, readFile, rename, lstat, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

export class RunnerJournal {
  static async open(path, identity) {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    const journal = new RunnerJournal()
    journal.path = path
    journal.serial = Promise.resolve()
    journal.lockPath = `${path}.lock`
    try { journal.lock = await open(journal.lockPath, 'wx', 0o600) } catch (error) {
      if (error.code === 'EEXIST') throw new Error('Runner journal is locked. Inspect its recorded PID before removing a stale lock.')
      throw error
    }
    try {
      await journal.lock.writeFile(JSON.stringify({ pid: process.pid }))
      await journal.lock.sync()
      try {
        const stat = await lstat(path)
        if (!stat.isFile() || stat.mode & 0o077 || stat.size > 32 * 1024 * 1024) throw new Error('Runner journal must be a private regular file, at most 32 MiB.')
        const data = JSON.parse(await readFile(path, 'utf8'))
        if (data.version !== 1 || data.identity !== identity || !Number.isSafeInteger(data.cursor) || data.cursor < 0 || !Number.isSafeInteger(data.sequence) || data.sequence < 0 || !data.attempts || Array.isArray(data.attempts) || typeof data.attempts !== 'object' || Object.keys(data.attempts).length > 4096 || (data.outbox !== null && (!data.outbox || data.outbox.sequence !== data.sequence + 1))) {
          throw new Error('Runner journal does not match this connection and execution policy.')
        }
        for (const attempt of Object.values(data.attempts)) {
          if (!attempt || !['reserved', 'running', 'settled', 'cancelled'].includes(attempt.status) || !attempt.event || typeof attempt.event.attemptId !== 'string') throw new Error('Invalid runner attempt journal.')
        }
        journal.data = data
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
        journal.data = { version: 1, identity, cursor: 0, sequence: 0, outbox: null, attempts: {} }
        await journal.save()
      }
      return journal
    } catch (error) { await journal.close(); throw error }
  }

  async save() {
    const text = JSON.stringify(this.data)
    if (Buffer.byteLength(text) > 32 * 1024 * 1024) throw new Error('Runner journal capacity reached; inspect and retain this journal.')
    const temporary = `${this.path}.${randomUUID()}.tmp`
    const file = await open(temporary, 'wx', 0o600)
    try { await file.writeFile(text); await file.sync() } finally { await file.close() }
    try {
      await rename(temporary, this.path)
      const directory = await open(dirname(this.path), 'r')
      try { await directory.sync() } finally { await directory.close() }
    } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error }) }
  }

  change(fn) {
    const operation = this.serial.then(async () => { const result = fn(this.data); await this.save(); return result })
    // Disk failures fence every subsequent change, including execution claims.
    this.serial = operation
    return operation
  }

  async close() {
    await this.serial?.catch(() => {})
    if (!this.lock) return
    await this.lock.close()
    this.lock = null
    await unlink(this.lockPath)
  }
}
