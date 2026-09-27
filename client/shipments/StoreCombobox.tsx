import { useEffect, useId, useState } from 'react'
import { fieldMarks } from '../components/Field.js'
import { searchStores } from '../api/shipments.js'
import type { StoreDto } from '../../shared/store.js'

const DEBOUNCE_MS = 250

type StoreComboboxProps = {
  id: string
  label: string
  value: string
  problem: string | undefined
  onChange: (value: string) => void
  onPick: (store: StoreDto) => void
}

export function StoreCombobox ({ id, label, value, problem, onChange, onPick }: StoreComboboxProps) {
  const listId = useId()
  const [suggestions, setSuggestions] = useState<StoreDto[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  useEffect(() => {
    const controller = new AbortController()

    const timer = setTimeout(() => {
      searchStores(value, controller.signal)
        .then((stores) => {
          if (controller.signal.aborted) return
          setSuggestions(stores)
          setActive(-1)
        })
        .catch(() => {
          if (!controller.signal.aborted) setSuggestions([])
        })
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value])

  const pick = (store: StoreDto) => {
    onChange(store.name)
    onPick(store)
    setOpen(false)
    setActive(-1)
  }

  const move = (step: number) => {
    if (suggestions.length === 0) return

    setOpen(true)
    setActive((current) => {
      const slots = suggestions.length + 1

      return (current + 1 + step + slots) % slots - 1
    })
  }

  const listOpen = open && suggestions.length > 0

  return (
    <div className='combobox'>
      <input
        id={id}
        {...fieldMarks(id, problem)}
        role='combobox'
        aria-label={label}
        autoComplete='off'
        aria-expanded={listOpen}
        aria-controls={listId}
        aria-autocomplete='list'
        aria-activedescendant={active < 0 ? undefined : `${listId}-${String(active)}`}
        value={value}
        onChange={(event) => { onChange(event.target.value); setOpen(true) }}
        onFocus={() => { setOpen(true) }}
        onBlur={() => { setOpen(false) }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); move(1) }
          if (event.key === 'ArrowUp') { event.preventDefault(); move(-1) }

          if (event.key === 'Escape' && listOpen) {
            event.stopPropagation()
            setOpen(false)
          }

          if (event.key === 'Enter' && listOpen && active >= 0) {
            event.preventDefault()
            pick(suggestions[active])
          }
        }}
      />

      {listOpen && (
        <ul className='combobox-list' id={listId} role='listbox'>
          {suggestions.map((store, index) => (
            <li
              key={store.name}
              id={`${listId}-${String(index)}`}
              role='option'
              aria-selected={index === active}
              className={index === active ? 'combobox-option combobox-option-active' : 'combobox-option'}
              onMouseDown={(event) => { event.preventDefault(); pick(store) }}
            >
              {store.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
