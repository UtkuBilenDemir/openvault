import { Plugin } from "@opencode/plugin/tui"
import { OpenVaultRpc } from "./rpc.js"
import type { OpenVaultProject, OpenVaultScanResult } from "./types.js"

type PendingAction =
  | { type: "pin"; project: OpenVaultProject }
  | { type: "status"; project: OpenVaultProject }
  | undefined

export default Plugin.define({
  id: "openvault.tui",
  setup(context) {
    const rpc = context.client.rpc(OpenVaultRpc)

    async function load(): Promise<OpenVaultScanResult> {
      return (await rpc.list({})) as OpenVaultScanResult
    }

    async function openProject(project: OpenVaultProject) {
      const session = await context.client.session.create({ location: { directory: project.directory } })
      context.ui.router.navigate({ type: "session", sessionID: session.id })
    }

    async function picker() {
      while (true) {
        const result = await load()
        let action: PendingAction
        const selected = await context.ui.dialog.select({
          title: "OpenVault projects",
          options: result.projects.map((project) => ({
            title: `${project.pinned ? "★ " : ""}${project.title}`,
            value: project,
            description: `${project.statuses.join(", ") || "no status"} · ${project.directory}`,
            category: project.pinned ? "Pinned" : (project.statuses[0] ?? "Other"),
          })),
          search: (query, options) => {
            const needle = query.trim().toLowerCase()
            if (!needle) return options
            return options.filter((option) => {
              const project = option.value
              return [project.title, project.directory, ...project.aliases, ...project.statuses]
                .join(" ")
                .toLowerCase()
                .includes(needle)
            })
          },
          actions: [
            {
              bind: "ctrl+p",
              title: "Pin/unpin",
              onTrigger: (project) => {
                action = { type: "pin", project }
                context.ui.dialog.clear()
              },
            },
            {
              bind: "ctrl+s",
              title: "Set status",
              onTrigger: (project) => {
                action = { type: "status", project }
                context.ui.dialog.clear()
              },
            },
          ],
        })

        if (selected) {
          await openProject(selected)
          return
        }
        if (!action) return

        if (action.type === "pin") {
          await rpc.update({ note: action.project.note, pinned: !action.project.pinned })
          context.ui.toast.show({ message: action.project.pinned ? "Project unpinned" : "Project pinned" })
          continue
        }

        const status = await context.ui.dialog.select({
          title: `Status for ${action.project.title}`,
          current: action.project.statuses[0],
          options: result.statuses.map((value) => ({ title: value, value })),
        })
        if (status) await rpc.update({ note: action.project.note, status })
      }
    }

    async function sync() {
      const result = await load()
      let registered = 0
      for (const project of result.projects) {
        await context.client.location.get({ location: { directory: project.directory } })
        registered++
      }
      await context.data.project.sync()
      context.ui.toast.show({
        title: "OpenVault",
        message: `Registered ${registered} project${registered === 1 ? "" : "s"}`,
        variant: "success",
      })
    }

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "openvault.projects",
          title: "Open an OpenVault project",
          group: "OpenVault",
          palette: true,
          slash: { name: "openvault", aliases: ["ov"] },
          suggested: true,
          run: () => picker().catch((error) => context.ui.toast.show({
            title: "OpenVault failed",
            message: error instanceof Error ? error.message : String(error),
            variant: "error",
          })),
        },
        {
          id: "openvault.sync",
          title: "Register OpenVault projects with OpenCode",
          group: "OpenVault",
          palette: true,
          slash: { name: "openvault-sync" },
          run: () => sync().catch((error) => context.ui.toast.show({
            title: "OpenVault sync failed",
            message: error instanceof Error ? error.message : String(error),
            variant: "error",
          })),
        },
      ],
    }))
  },
})
