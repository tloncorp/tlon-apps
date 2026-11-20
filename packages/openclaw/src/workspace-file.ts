import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';

/** Replace a caller-selected workspace file while preserving its mode. */
export async function replaceWorkspaceFile(
  target: string,
  text: string,
  newFileMode?: number
): Promise<void> {
  const temporary = `${target}.${randomUUID()}.tmp`;
  // Replacing through a temporary file would otherwise reset the target to
  // Node's default 0666 filtered by the umask, so an owner edit of a 0600
  // prompt would publish it to every other local user. lstat, so a symlinked
  // name reports the link rather than whatever it points at; only a regular
  // file's mode is worth carrying over. For a new file, use the caller's
  // requested mode or the process default.
  let mode: number | null = null;
  try {
    const existing = await fs.lstat(target);
    if (existing.isFile()) {
      mode = existing.mode & 0o777;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  try {
    await fs.writeFile(temporary, text, {
      encoding: 'utf8',
      flag: 'wx',
      mode: mode ?? newFileMode,
    });
    // writeFile's mode is still masked by the umask; chmod is not.
    if (mode !== null) {
      await fs.chmod(temporary, mode);
    }
    await fs.rename(temporary, target);
  } catch (error) {
    await fs.unlink(temporary).catch(() => {});
    throw error;
  }
}
