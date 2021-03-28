import DB from './db'

describe('DB', () => {
  it('can initialize without error', () => {
    const db = new DB({
      sendDiagnostics: () => {},
    })

    expect(db).toBeInstanceOf(DB)
  })
})
