import { Rpc } from "@opencode/plugin/rpc"

const project = {
  type: "object",
  properties: {
    note: { type: "string" },
    directory: { type: "string" },
    title: { type: "string" },
    aliases: { type: "array", items: { type: "string" } },
    statuses: { type: "array", items: { type: "string" } },
    pinned: { type: "boolean" },
    git: { type: "boolean" },
  },
  required: ["note", "directory", "title", "aliases", "statuses", "pinned", "git"],
  additionalProperties: false,
} as const

export const OpenVaultRpc = Rpc.define({
  id: "openvault",
  methods: {
    list: {
      input: {
        type: "object",
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          projects: { type: "array", items: project },
          statuses: { type: "array", items: { type: "string" } },
          scanned: { type: "integer", minimum: 0 },
        },
        required: ["projects", "statuses", "scanned"],
        additionalProperties: false,
      },
    },
    update: {
      input: {
        type: "object",
        properties: {
          note: { type: "string" },
          pinned: { type: "boolean" },
          status: { type: "string" },
        },
        required: ["note"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: { updated: { type: "boolean" } },
        required: ["updated"],
        additionalProperties: false,
      },
    },
  },
  events: {},
} as const satisfies Rpc.PortableDefinition)
