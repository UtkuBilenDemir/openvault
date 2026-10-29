export interface OpenVaultProject {
  note: string
  directory: string
  title: string
  aliases: string[]
  statuses: string[]
  pinned: boolean
  git: boolean
}

export interface OpenVaultScanResult {
  projects: OpenVaultProject[]
  statuses: string[]
  scanned: number
}

export interface OpenVaultOptions {
  vault: string
  markerProperty: string
  markerValue: string
  directoryProperty: string
  statusProperty: string
  pinProperty: string
  statuses: string[]
  exclude: string[]
  gitOnly: boolean
  statusAsArray: boolean
}
