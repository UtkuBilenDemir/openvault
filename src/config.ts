import os from "node:os"
import path from "node:path"
import type { OpenVaultOptions } from "./types.js"

const strings = (value: unknown, fallback: string[]) =>
  Array.isArray(value) && value.every((item) => typeof item === "string") ? value : fallback

const text = (value: unknown, fallback: string) => (typeof value === "string" && value.trim() ? value : fallback)

const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback)

export function expandHome(value: string) {
  if (value === "~") return os.homedir()
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2))
  return value
}

export function resolveOptions(input: Record<string, unknown>, fallbackVault: string): OpenVaultOptions {
  const configuredVault = text(input.vault, process.env.OPENVAULT_VAULT ?? fallbackVault)
  return {
    vault: path.resolve(expandHome(configuredVault)),
    markerProperty: text(input.markerProperty, "kind"),
    markerValue: text(input.markerValue, "project"),
    directoryProperty: text(input.directoryProperty, "project_directory"),
    statusProperty: text(input.statusProperty, "status"),
    pinProperty: text(input.pinProperty, "openvault_pinned"),
    statuses: strings(input.statuses, ["open", "active", "detached", "done"]),
    exclude: strings(input.exclude, [
      ".git/**",
      ".obsidian/**",
      ".trash/**",
      "node_modules/**",
      "08_templates/**",
    ]),
    gitOnly: bool(input.gitOnly, true),
    statusAsArray: bool(input.statusAsArray, true),
  }
}
