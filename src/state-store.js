import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function createStateStore(filename) {
  return {
    async read() {
      try {
        const contents = await readFile(filename, 'utf8');
        const state = JSON.parse(contents);
        return {
          seenPostIds: Array.isArray(state.seenPostIds) ? state.seenPostIds : [],
          lastCheckedAt: state.lastCheckedAt || null,
          creator: state.creator || null,
        };
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw new Error(`Cannot read state file: ${error.message}`);
      }
    },

    async write(state) {
      await mkdir(path.dirname(filename), { recursive: true });
      const temporaryFile = `${filename}.tmp`;
      await writeFile(temporaryFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
      await rename(temporaryFile, filename);
    },
  };
}

export function stateFileForCreator(directory, nickname) {
  const safeNickname = nickname.toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
  return path.join(directory, `${safeNickname}.json`);
}
