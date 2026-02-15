# Test Organization

This directory contains all tests for the Vinyl Companion application, organized by type and purpose.

## Directory Structure

```
tests/
├── unit/                        # Unit tests for individual components/modules
│   ├── components/              # Component unit tests
│   ├── services/                # Service unit tests
│   ├── models/                  # Model unit tests
│   └── hooks/                   # Custom hook unit tests
├── integration/                 # Integration tests
│   ├── test-supabase.js        # Supabase connection test
│   ├── test-rls.js             # Row Level Security test
│   └── test-caching.js         # Caching service integration test
├── api/                        # API integration tests
│   ├── test-google-api.js      # Google Reverse Image Search API test
│   ├── test-serpapi.js         # SerpAPI integration test
│   ├── test-multiple-images.js # Multiple image testing
│   └── test-exact-readme-format.js # API format testing
├── fixtures/                   # Test data and mock responses
├── helpers/                    # Test utilities and helpers
└── README.md                   # This file
```

## Running Tests

### All Tests
```bash
npm test              # Run all unit tests with Vitest
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

### Unit Tests
```bash
npm run test:unit     # Run all unit tests
vitest tests/unit/components  # Run component tests only
vitest tests/unit/services    # Run service tests only
```

### Integration Tests
```bash
npm run test:integration  # Run all integration tests
node tests/integration/test-supabase.js  # Test Supabase connection
node tests/integration/test-rls.js       # Test Row Level Security
node tests/integration/test-caching.js   # Test caching service
```

### API Tests
```bash
npm run test:api      # Run all API tests
node tests/api/test-google-api.js   # Test Google API
node tests/api/test-serpapi.js      # Test SerpAPI
```

## Test Types

### Unit Tests
- Test individual components, functions, and modules in isolation
- Use mocks and stubs for dependencies
- Fast execution
- Run automatically in CI/CD

**Technologies:**
- Vitest (test runner)
- React Testing Library (component testing)
- jsdom (DOM simulation)

### Integration Tests
- Test interactions between multiple modules
- Test database operations
- Test authentication and security
- May require environment variables

**Requirements:**
- `.env` file with Supabase credentials
- Database schema deployed

### API Tests
- Test external API integrations
- Verify API response formats
- Test error handling and rate limiting
- Some may be mock-based for development

**Note:** Some API tests use mock responses to avoid rate limits during development.

## Writing Tests

### Unit Test Example
```javascript
// tests/unit/components/MyComponent.test.jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MyComponent from '../../../src/components/MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

### Integration Test Example
```javascript
// tests/integration/test-my-feature.js
import Database from '../../src/services/database/index.js'

async function testFeature() {
  const albums = await Database.getAllAlbums()
  console.log(`Found ${albums.length} albums`)
}

testFeature()
```

## Test Fixtures

Place reusable test data in `tests/fixtures/`:

```javascript
// tests/fixtures/albums.json
[
  {
    "title": "Test Album",
    "artist": "Test Artist",
    "year": 2023
  }
]
```

## Test Helpers

Place reusable test utilities in `tests/helpers/`:

```javascript
// tests/helpers/test-utils.js
export function createMockAlbum(overrides = {}) {
  return {
    id: '123',
    title: 'Test Album',
    artist: 'Test Artist',
    ...overrides
  }
}
```

## Coverage Goals

- **Overall:** 80%+ line coverage
- **Critical paths:** 100% coverage (scoring, ranking algorithms)
- **Edge cases:** All error conditions tested
- **Performance:** Response times under 200ms for cached requests

## CI/CD Integration

Tests are automatically run on:
- Pull requests
- Commits to main branch
- Pre-deployment checks

Unit tests must pass before deployment.

## Troubleshooting

### Integration Tests Failing

**Problem:** "Missing Supabase credentials"
**Solution:** Create `.env` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

**Problem:** "Table does not exist"
**Solution:** Run database schema in Supabase dashboard (`database/schema.sql`)

### API Tests Failing

**Problem:** Rate limit errors
**Solution:** Add delays between requests or use mock data during development

### Unit Tests Failing

**Problem:** Import path errors
**Solution:** Check relative paths - unit tests are in `tests/unit/`, source files in `src/`

## Migration Notes

**October 12, 2025:** Tests were reorganized from scattered locations:
- Root `test-*.js` files → `tests/api/` and `tests/integration/`
- `src/**/__tests__/` → `tests/unit/`

Old import paths have been updated. If you find any broken imports, update them relative to the new `tests/` directory structure.

## Contributing

When adding new tests:
1. Place unit tests in appropriate `tests/unit/` subdirectory
2. Place integration tests in `tests/integration/`
3. Place API tests in `tests/api/`
4. Add test fixtures to `tests/fixtures/`
5. Update this README if adding new test categories
6. Ensure tests are documented and have clear descriptions

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
