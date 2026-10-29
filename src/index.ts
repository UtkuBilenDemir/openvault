import { Plugin } from "@opencode/plugin"
import { realpath } from "node:fs/promises"
import path from "node:path"
import { resolveOptions } from "./config.js"
import { scanVault, updateProjectNote } from "./frontmatter.js"
import { OpenVaultRpc } from "./rpc.js"
import type { OpenVaultScanResult } from "./types.js"

const CACHE_TTL_MS = 30_000

interface CacheState {
  cached?: { result: OpenVaultScanResult; time: number }
  pending?: Promise<OpenVaultScanResult>
}

// OpenCode creates one server-plugin instance per active location. Share vault
// indexes across those instances so they do not all scan the same vault.
const indexes = new Map<string, CacheState>()

export default Plugin.define({
  id: "openvault",
  async setup(context) {
    const options = resolveOptions(context.options as Record<string, unknown>, context.location.project.canonical)
    const cacheKey = JSON.stringify(options)
    const state = indexes.get(cacheKey) ?? {}
    indexes.set(cacheKey, state)

    const refresh = () => {
      if (state.pending) return state.pending
      state.pending = scanVault(options)
        .then((result) => {
          state.cached = { result, time: Date.now() }
          return result
        })
        .finally(() => {
          state.pending = undefined
        })
      return state.pending
    }

    const list = async () => {
      if (!state.cached) return refresh()
      if (Date.now() - state.cached.time > CACHE_TTL_MS) void refresh().catch(() => undefined)
      return state.cached.result
    }

    // Build the index when the plugin loads instead of making the picker wait.
    void refresh().catch(() => undefined)

    const registration = await context.rpc.register(OpenVaultRpc, {
      list,
      update: async (input) => {
        const value = input as { note: string; pinned?: boolean; status?: string }
        const note = await realpath(value.note)
        const relative = path.relative(options.vault, note)
        if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Note is outside the configured vault")
        if (value.status !== undefined && !options.statuses.includes(value.status)) {
          throw new Error(`Unsupported project status: ${value.status}`)
        }
        await updateProjectNote(note, options, {
          ...(value.pinned === undefined ? {} : { pinned: value.pinned }),
          ...(value.status === undefined ? {} : { status: value.status }),
        })
        await refresh()
        return { updated: true }
      },
    })
    return () => registration.dispose()
  },
})
