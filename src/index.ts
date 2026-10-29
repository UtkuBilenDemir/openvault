import { Plugin } from "@opencode/plugin"
import { realpath } from "node:fs/promises"
import path from "node:path"
import { resolveOptions } from "./config.js"
import { scanVault, updateProjectNote } from "./frontmatter.js"
import { OpenVaultRpc } from "./rpc.js"
import type { OpenVaultScanResult } from "./types.js"

const CACHE_TTL_MS = 30_000

export default Plugin.define({
  id: "openvault",
  async setup(context) {
    const options = resolveOptions(context.options as Record<string, unknown>, context.location.project.canonical)
    let cached: { result: OpenVaultScanResult; time: number } | undefined
    let pending: Promise<OpenVaultScanResult> | undefined

    const refresh = () => {
      if (pending) return pending
      pending = scanVault(options)
        .then((result) => {
          cached = { result, time: Date.now() }
          return result
        })
        .finally(() => {
          pending = undefined
        })
      return pending
    }

    const list = async () => {
      if (!cached) return refresh()
      if (Date.now() - cached.time > CACHE_TTL_MS) void refresh().catch(() => undefined)
      return cached.result
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
