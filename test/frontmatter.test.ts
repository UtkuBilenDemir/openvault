import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, realpath, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { resolveOptions } from "../src/config.js"
import { scanVault, updateProjectNote } from "../src/frontmatter.js"

test("discovers, orders, and updates frontmatter projects", async () => {
  const vault = await mkdtemp(path.join(os.tmpdir(), "openvault-"))
  const active = path.join(vault, "Active")
  const done = path.join(vault, "Done")
  await Promise.all([
    mkdir(path.join(active, ".git"), { recursive: true }),
    mkdir(path.join(done, ".git"), { recursive: true }),
  ])
  await writeFile(
    path.join(active, "Active.md"),
    "---\ntitle: Active project\nkind: project\nstatus:\n  - active\n---\nBody\n",
  )
  await writeFile(
    path.join(done, "Done.md"),
    "---\ntitle: Done project\nkind: project\nstatus: done\nopenvault_pinned: true\n---\nBody\n",
  )

  const options = resolveOptions({ vault }, vault)
  const initial = await scanVault(options)
  assert.deepEqual(initial.projects.map((item) => item.title), ["Done project", "Active project"])

  await updateProjectNote(path.join(active, "Active.md"), options, { pinned: true, status: "detached" })
  const updated = await scanVault(options)
  assert.equal(updated.projects[0]?.title, "Active project")
  assert.deepEqual(updated.projects[0]?.statuses, ["detached"])
  assert.match(await readFile(path.join(active, "Active.md"), "utf8"), /openvault_pinned: true/)
})

test("supports an explicit project directory", async () => {
  const vault = await mkdtemp(path.join(os.tmpdir(), "openvault-"))
  const notes = path.join(vault, "Notes")
  const repository = path.join(vault, "Code")
  await mkdir(notes, { recursive: true })
  await mkdir(path.join(repository, ".git"), { recursive: true })
  await writeFile(
    path.join(notes, "Code.md"),
    "---\nkind: project\nproject_directory: ../Code\n---\n",
  )

  const result = await scanVault(resolveOptions({ vault }, vault))
  assert.equal(result.projects[0]?.directory, await realpath(repository))
})

test("discovers ordinary directories by default", async () => {
  const vault = await mkdtemp(path.join(os.tmpdir(), "openvault-"))
  const project = path.join(vault, "Notes")
  await mkdir(project, { recursive: true })
  await writeFile(path.join(project, "Notes.md"), "---\nkind: project\nstatus: open\n---\n")

  const result = await scanVault(resolveOptions({ vault }, vault))
  assert.equal(result.projects[0]?.title, "Notes")
  assert.equal(result.projects[0]?.git, false)
})
