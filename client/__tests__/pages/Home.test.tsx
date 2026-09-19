import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { Home } from '../../pages/Home.js'

const renderHome = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/form' element={<p>The label form</p>} />
      </Routes>
    </MemoryRouter>
  )

describe('the home page', () => {
  it('says what the tool does and for which carriers', () => {
    renderHome()

    expect(screen.getByRole('heading', { name: 'ShipBox' })).toBeInTheDocument()
    expect(screen.getByText('Bpost')).toBeInTheDocument()
    expect(screen.getByText('PostNL')).toBeInTheDocument()
  })

  it('leads straight to the form', async () => {
    renderHome()

    await userEvent.click(screen.getByRole('button', { name: /go to the form/i }))

    expect(screen.getByText('The label form')).toBeInTheDocument()
  })
})
