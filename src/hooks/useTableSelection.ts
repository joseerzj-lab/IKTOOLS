import { useEffect } from 'react'

export function useTableSelection(tableRef: React.RefObject<HTMLTableElement | null>) {
  useEffect(() => {
    const table = tableRef.current
    if (!table) return

    let anchor: HTMLTableCellElement | null = null
    let active: HTMLTableCellElement | null = null
    let isDragging = false

    // Inject glow div if not exists
    let glow = document.getElementById('ikCopyGlow')
    if (!glow) {
      glow = document.createElement('div')
      glow.className = 'ik-copy-glow'
      glow.id = 'ikCopyGlow'
      glow.textContent = '✓ Copiado'
      document.body.appendChild(glow)
    }

    let glowT: ReturnType<typeof setTimeout>
    const flashGlow = () => {
      glow?.classList.add('ik-glow-show')
      clearTimeout(glowT)
      glowT = setTimeout(() => { glow?.classList.remove('ik-glow-show') }, 1600)
    }

    const markSelectableCells = () => {
      table.querySelectorAll('tbody td').forEach((td) => {
        td.classList.add('ik-sel-cell')
      })
    }

    // Observe dynamic changes
    const mo = new MutationObserver(() => { markSelectableCells() })
    mo.observe(table, { childList: true, subtree: true })
    markSelectableCells()

    const getIdx = (td: HTMLTableCellElement) => {
      const tr = td.parentElement as HTMLTableRowElement
      const tbody = tr.parentElement as HTMLTableSectionElement
      const ri = Array.from(tbody.rows || tbody.children).indexOf(tr)
      const ci = Array.from(tr.cells || tr.children).indexOf(td)
      return { r: ri, c: ci }
    }

    const clearSel = () => {
      table.querySelectorAll('.ik-selected, .ik-anchor').forEach((el) => {
        el.classList.remove('ik-selected', 'ik-anchor')
      })
    }

    const selectRange = (a: HTMLTableCellElement | null, b: HTMLTableCellElement | null) => {
      if (!a || !b) return
      clearSel()
      const ia = getIdx(a)
      const ib = getIdx(b)
      const r1 = Math.min(ia.r, ib.r)
      const r2 = Math.max(ia.r, ib.r)
      const c1 = Math.min(ia.c, ib.c)
      const c2 = Math.max(ia.c, ib.c)
      
      const tbody = a.closest('tbody')
      if (!tbody) return
      
      Array.from(tbody.rows || tbody.querySelectorAll('tr')).slice(r1, r2 + 1).forEach((tr) => {
        Array.from((tr as HTMLTableRowElement).cells).slice(c1, c2 + 1).forEach((td) => {
          td.classList.add('ik-selected')
        })
      })
      a.classList.add('ik-anchor')
    }

    const getSelText = () => {
      const cells = Array.from(table.querySelectorAll('.ik-selected, .ik-anchor')) as HTMLTableCellElement[]
      if (!cells.length) return ''
      
      const byRow: Record<number, { c: number, text: string }[]> = {}
      cells.forEach((td) => {
        const i = getIdx(td)
        if (!byRow[i.r]) byRow[i.r] = []
        byRow[i.r].push({ c: i.c, text: (td.innerText || td.textContent || '').trim() })
      })
      
      return Object.keys(byRow).sort((a, b) => Number(a) - Number(b)).map((r) => {
        return byRow[Number(r)].sort((a, b) => a.c - b.c).map((x) => x.text).join('\t')
      }).join('\n')
    }

    const fallbackCopy = (text: string) => {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      flashGlow()
    }

    const copySelection = () => {
      const text = getSelText()
      if (!text) return
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(flashGlow).catch(() => { fallbackCopy(text) })
      } else {
        fallbackCopy(text)
      }
    }

    const onMouseDown = (e: MouseEvent) => {
      const td = (e.target as HTMLElement).closest('tbody td.ik-sel-cell') as HTMLTableCellElement
      if (!td || !table.contains(td)) return
      if (td.querySelector('[contenteditable]') || td.getAttribute('contenteditable')) return
      
      isDragging = true
      anchor = td
      active = td
      clearSel()
      td.classList.add('ik-anchor')
      e.preventDefault()
    }

    const onMouseOver = (e: MouseEvent) => {
      if (!isDragging || !anchor) return
      const td = (e.target as HTMLElement).closest('tbody td.ik-sel-cell') as HTMLTableCellElement
      if (!td || !table.contains(td)) return
      active = td
      selectRange(anchor, active)
    }

    const onMouseUp = () => {
      isDragging = false
    }
    
    const onKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
            const cells = Array.from(table.querySelectorAll('.ik-selected, .ik-anchor'))
            if (cells.length > 0) {
                e.preventDefault()
                copySelection()
            }
        }
    }
    
    const onClickOutside = (e: MouseEvent) => {
        if (!table.contains(e.target as Node)) {
            clearSel()
            anchor = null
            active = null
        }
    }

    document.addEventListener('mousedown', onMouseDown, true)
    document.addEventListener('mouseover', onMouseOver)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onClickOutside)

    return () => {
      mo.disconnect()
      document.removeEventListener('mousedown', onMouseDown, true)
      document.removeEventListener('mouseover', onMouseOver)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onClickOutside)
    }
  }, [tableRef])
}
