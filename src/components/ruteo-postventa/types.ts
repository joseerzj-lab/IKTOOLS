export type Row = Record<string, string> & { _ikid: string }
export type TabKey = 'load' | 'dashboard' | 'export' | 'templates' | 'duplicates' | 'projects'

export interface Stats {
  total: number
  gestion: Record<string, number>
}
