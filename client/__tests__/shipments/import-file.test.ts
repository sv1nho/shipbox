import { describe, it, expect } from 'vitest'
import { parseImportFile, toShipmentInput } from '../../shipments/import-file.js'

describe('parseImportFile', () => {
  it('refuses an empty file rather than importing nothing', () => {
    expect(parseImportFile('returns.csv', '   ')).toEqual({ rows: [], problem: 'This file is empty.' })
  })

  it('reads a csv by its header', () => {
    const parsed = parseImportFile('returns.csv', 'trackingNumber,store\r\n3232,Zalando')

    expect(parsed.problem).toBeNull()
    expect(parsed.rows).toEqual([{ trackingNumber: '3232', store: 'Zalando' }])
  })

  it('says so when a csv carries a header and nothing else', () => {
    expect(parseImportFile('returns.csv', 'trackingNumber,store').problem)
      .toBe('This file holds a header but no returns.')
  })

  it('reads a json list', () => {
    const parsed = parseImportFile('returns.json', '[{"store":"Zalando"}]')

    expect(parsed.rows).toEqual([{ store: 'Zalando' }])
  })

  it('reads the items list an export writes', () => {
    const parsed = parseImportFile('returns.json', '{"items":[{"store":"Zara"}],"total":1}')

    expect(parsed.rows).toEqual([{ store: 'Zara' }])
  })

  it('refuses json that is not valid', () => {
    expect(parseImportFile('returns.json', '{oops').problem).toBe('This file is not valid JSON.')
  })

  it('refuses json that is neither a list nor an items object', () => {
    expect(parseImportFile('returns.json', '{"store":"Zalando"}').problem)
      .toContain('Expected a list of returns')
  })

  it('refuses a list holding something that is not a return', () => {
    expect(parseImportFile('returns.json', '["Zalando"]').problem)
      .toBe('Every entry must be an object.')
  })

  it('reads an unnamed extension as csv, the format an export writes', () => {
    expect(parseImportFile('returns.txt', 'store\r\nZalando').rows).toEqual([{ store: 'Zalando' }])
  })
})

describe('toShipmentInput', () => {
  it('drops the empty cells a csv is full of, rather than sending blanks', () => {
    expect(toShipmentInput({ store: 'Zalando', orderNumber: '', note: '' }))
      .toEqual({ store: 'Zalando' })
  })

  it('reads the cents an export wrote as a number', () => {
    expect(toShipmentInput({ amountCents: '4999' })).toEqual({ amountCents: 4999 })
  })

  it('reads a decimal amount a person typed, in either notation', () => {
    expect(toShipmentInput({ amount: '49.99' })).toEqual({ amountCents: 4999 })
    expect(toShipmentInput({ amount: '49,99' })).toEqual({ amountCents: 4999 })
  })

  it('prefers the decimal amount when a file carries both', () => {
    expect(toShipmentInput({ amount: '10.00', amountCents: '9999' })).toEqual({ amountCents: 1000 })
  })

  it('leaves an unreadable amount for the api to refuse, rather than guessing', () => {
    expect(toShipmentInput({ amount: 'free', amountCents: '4999' })).toEqual({ amountCents: 4999 })
    expect(Number.isNaN(toShipmentInput({ amountCents: 'free' }).amountCents)).toBe(true)
  })

  it('leaves a number that came from json alone', () => {
    expect(toShipmentInput({ amountCents: 4999 })).toEqual({ amountCents: 4999 })
  })
})
