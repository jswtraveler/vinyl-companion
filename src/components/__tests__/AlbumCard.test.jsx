import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AlbumCard from '../AlbumCard.jsx'
import { createNewAlbum } from '../../models/Album.js'

describe('AlbumCard', () => {
  const mockAlbum = createNewAlbum({
    title: 'Test Album',
    artist: 'Test Artist',
    year: 2023,
    format: 'LP',
    condition: 'Near Mint',
    genre: ['Rock', 'Alternative']
  })

  it('renders album information correctly', () => {
    render(<AlbumCard album={mockAlbum} />)
    
    expect(screen.getByText('Test Album')).toBeInTheDocument()
    expect(screen.getByText('Test Artist')).toBeInTheDocument()
    expect(screen.getByText('2023')).toBeInTheDocument()
    expect(screen.getByText('LP')).toBeInTheDocument()
    expect(screen.getByText(/Near Mint/)).toBeInTheDocument()
  })

  it('displays genres correctly', () => {
    render(<AlbumCard album={mockAlbum} />)
    
    expect(screen.getByText('Rock, Alternative')).toBeInTheDocument()
  })

  it('handles missing cover image gracefully', () => {
    const albumWithoutImage = { ...mockAlbum, coverImage: null }
    render(<AlbumCard album={albumWithoutImage} />)
    
    // Should render without crashing
    expect(screen.getByText('Test Album')).toBeInTheDocument()
  })

  it('calls edit handler when edit button is clicked', () => {
    const mockEdit = vi.fn()
    render(
      <AlbumCard 
        album={mockAlbum} 
        onEdit={mockEdit}
        showActions={true}
      />
    )
    
    const editButton = screen.getByTitle('Edit album')
    fireEvent.click(editButton)
    
    expect(mockEdit).toHaveBeenCalledWith(mockAlbum)
  })

  it('calls delete handler when delete button is clicked', () => {
    const mockDelete = vi.fn()
    render(
      <AlbumCard 
        album={mockAlbum} 
        onDelete={mockDelete}
        showActions={true}
      />
    )
    
    const deleteButton = screen.getByTitle('Delete album')
    fireEvent.click(deleteButton)
    
    expect(mockDelete).toHaveBeenCalledWith(mockAlbum)
  })

  it('does not show action buttons when showActions is false', () => {
    render(
      <AlbumCard 
        album={mockAlbum} 
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        showActions={false}
      />
    )
    
    // Buttons should not be present
    expect(screen.queryByTitle('Edit album')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Delete album')).not.toBeInTheDocument()
  })
})