import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function patchPath(p) {
  if (typeof p !== 'string') return p
  const uncPattern = /[/\\]+cselab-server[/\\]+shiva[/\\]+shiva217[/\\]+skin disease classification - 17 aiml/i
  if (uncPattern.test(p)) {
    const fixed = p.replace(/^[A-Za-z]:[/\\]+cselab-server[/\\]+shiva[/\\]+shiva217[/\\]+skin disease classification - 17 aiml/i, 'Z:/skin disease classification - 17 aiml')
                   .replace(/^[/\\]+cselab-server[/\\]+shiva[/\\]+shiva217[/\\]+skin disease classification - 17 aiml/i, 'Z:/skin disease classification - 17 aiml')
    return fixed
  }
  return p
}

// Monkey-patch path.relative and path.posix.relative
const origRelative = path.relative
path.relative = function(from, to) {
  return origRelative.call(this, patchPath(from), patchPath(to))
}
if (path.posix && path.posix.relative) {
  const origPosixRelative = path.posix.relative
  path.posix.relative = function(from, to) {
    return origPosixRelative.call(this, patchPath(from), patchPath(to))
  }
}
if (path.win32 && path.win32.relative) {
  const origWin32Relative = path.win32.relative
  path.win32.relative = function(from, to) {
    return origWin32Relative.call(this, patchPath(from), patchPath(to))
  }
}

// Monkey-patch fs
const origOpen = fs.promises.open
fs.promises.open = function(p, ...args) {
  return origOpen.call(this, patchPath(p), ...args)
}

const origReadFile = fs.promises.readFile
fs.promises.readFile = function(p, ...args) {
  return origReadFile.call(this, patchPath(p), ...args)
}

const origStat = fs.promises.stat
fs.promises.stat = function(p, ...args) {
  return origStat.call(this, patchPath(p), ...args)
}

const origAccess = fs.promises.access
fs.promises.access = function(p, ...args) {
  return origAccess.call(this, patchPath(p), ...args)
}

const origRealpathPromise = fs.promises.realpath
fs.promises.realpath = function(p, ...args) {
  return origRealpathPromise.call(this, patchPath(p), ...args)
}

const origSyncRead = fs.readFileSync
fs.readFileSync = function(p, ...args) {
  return origSyncRead.call(this, patchPath(p), ...args)
}

const origSyncStat = fs.statSync
fs.statSync = function(p, ...args) {
  return origSyncStat.call(this, patchPath(p), ...args)
}

const origRealpath = fs.realpathSync
fs.realpathSync = function(p, ...args) {
  return origRealpath.call(this, patchPath(p), ...args)
}
if (origRealpath.native) {
  fs.realpathSync.native = function(p, ...args) {
    return origRealpath.native.call(this, patchPath(p), ...args)
  }
}

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 3000,
    host: true,
    watch: {
      usePolling: true,
      interval: 1000
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
