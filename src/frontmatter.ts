import { lstat, readdir, readFile, realpath, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { minimatch } from "minimatch"
import { parse, parseDocument } from "yaml"
import type { OpenVaultOptions, OpenVaultProject, OpenVaultScanResult } from "./types.js"

interface FrontmatterFile {
  source: string
  yaml: string
  body: string
  data: Record<string, unknown>
}

function splitFrontmatter(source: string): FrontmatterFile | undefined {
  const normalized = source.replaceAll("\r\n", "\n")
  if (!normalized.startsWith("---\n")) return
  const end = normalized.indexOf("\n---", 4)
  if (end === -1) return
  const after = end + 4
  const yaml = normalized.slice(4, end)
  const body = normalized.slice(after).replace(/^\n/, "")
  const value = parse(yaml)
  if (!value || typeof value !== "object" || Array.isArray(value)) return
  return { source: normalized, yaml, body, data: value as Record<string, unknown> }
}

function values(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function matches(value: unknown, expected: string) {
  return values(value).some((item) => item.toLowerCase() === expected.toLowerCase())
}

async function exists(value: string) {
  try {
    await lstat(value)
    return true
  } catch {
    return false
  }
}

function excluded(relative: string, patterns: string[]) {
  const candidate = relative.split(path.sep).join("/")
  return patterns.some((pattern) => minimatch(candidate, pattern, { dot: true, nocase: true }))
}

async function markdownFiles(root: string, options: OpenVaultOptions, directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const found: string[] = []
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    const relative = path.relative(root, absolute)
    if (excluded(relative, options.exclude) || excluded(`${relative}/`, options.exclude)) continue
    if (entry.isDirectory()) found.push(...(await markdownFiles(root, options, absolute)))
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) found.push(absolute)
  }
  return found
}

function resolveDirectory(note: string, configured: unknown) {
  const parent = path.dirname(note)
  if (typeof configured !== "string" || !configured.trim() || configured.trim() === ".") return parent
  const value = configured.trim()
  return path.resolve(parent, value)
}

async function projectFromNote(note: string, options: OpenVaultOptions): Promise<OpenVaultProject | undefined> {
  const source = await readFile(note, "utf8")
  let frontmatter: FrontmatterFile | undefined
  try {
    frontmatter = splitFrontmatter(source)
  } catch {
    return
  }
  if (!frontmatter || !matches(frontmatter.data[options.markerProperty], options.markerValue)) return

  const unresolved = resolveDirectory(note, frontmatter.data[options.directoryProperty])
  if (!(await exists(unresolved))) return
  const directory = await realpath(unresolved)
  const git = await exists(path.join(directory, ".git"))
  if (options.gitOnly && !git) return

  const configuredTitle = frontmatter.data.title
  return {
    note,
    directory,
    title:
      typeof configuredTitle === "string" && configuredTitle.trim()
        ? configuredTitle.trim()
        : path.basename(note, path.extname(note)),
    aliases: values(frontmatter.data.aliases),
    statuses: values(frontmatter.data[options.statusProperty]),
    pinned: frontmatter.data[options.pinProperty] === true,
    git,
  }
}

export async function scanVault(options: OpenVaultOptions): Promise<OpenVaultScanResult> {
  const notes = await markdownFiles(options.vault, options)
  const discovered = await Promise.all(notes.map((note) => projectFromNote(note, options)))
  const unique = new Map<string, OpenVaultProject>()
  for (const project of discovered) {
    if (!project) continue
    const existing = unique.get(project.directory)
    if (!existing || (!existing.pinned && project.pinned)) unique.set(project.directory, project)
  }

  const statusOrder = new Map(options.statuses.map((status, index) => [status, index]))
  const projects = [...unique.values()].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
    const leftStatus = statusOrder.get(left.statuses[0] ?? "") ?? Number.MAX_SAFE_INTEGER
    const rightStatus = statusOrder.get(right.statuses[0] ?? "") ?? Number.MAX_SAFE_INTEGER
    if (leftStatus !== rightStatus) return leftStatus - rightStatus
    return left.title.localeCompare(right.title)
  })
  return { projects, statuses: options.statuses, scanned: notes.length }
}

export async function updateProjectNote(
  note: string,
  options: OpenVaultOptions,
  update: { pinned?: boolean; status?: string },
) {
  const source = await readFile(note, "utf8")
  const frontmatter = splitFrontmatter(source)
  if (!frontmatter) throw new Error(`No YAML frontmatter in ${note}`)
  if (!matches(frontmatter.data[options.markerProperty], options.markerValue)) {
    throw new Error(`Note is not marked as ${options.markerProperty}: ${options.markerValue}`)
  }

  const document = parseDocument(frontmatter.yaml)
  if (update.pinned !== undefined) {
    if (update.pinned) document.set(options.pinProperty, true)
    else document.delete(options.pinProperty)
  }
  if (update.status !== undefined) {
    const current = frontmatter.data[options.statusProperty]
    document.set(options.statusProperty, Array.isArray(current) || options.statusAsArray ? [update.status] : update.status)
  }

  const next = `---\n${document.toString().trimEnd()}\n---\n${frontmatter.body}`
  const temporary = `${note}.openvault-${process.pid}.tmp`
  await writeFile(temporary, next, "utf8")
  await rename(temporary, note)
}
