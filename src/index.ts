import { Plugin } from "@opencode/plugin"
import { realpath } from "node:fs/promises"
import path from "node:path"
import { resolveOptions } from "./config.js"
import { scanVault, updateProjectNote } from "./frontmatter.js"
import { OpenVaultRpc } from "./rpc.js"

export default Plugin.define({
  id: "openvault",
  async setup(context) {
    const options = resolveOptions(context.options as Record<string, unknown>, context.location.project.canonical)
    const registration = await context.rpc.register(OpenVaultRpc, {
      list: async () => scanVault(options),
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
        return { updated: true }
      },
    })
    return () => registration.dispose()
  },
})
