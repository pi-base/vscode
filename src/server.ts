import * as ls from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import * as unified from 'unified'
import * as parse from 'remark-parse'
import * as frontmatter from 'remark-frontmatter'
import * as vfile from 'vfile'
import * as stringify from 'remark-stringify'

import DB from './db'

const connection = ls.createConnection(ls.ProposedFeatures.all)
const documents = new ls.TextDocuments(TextDocument)

connection.onInitialize((_: ls.InitializeParams): ls.InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: ls.TextDocumentSyncKind.Incremental,
      hoverProvider: true
    }
  }
})

const spaces: Map<string, string> = new Map()
const properties: Map<string, string> = new Map()

const db = new DB({
  sendDiagnostics: connection.sendDiagnostics
})

const processor = unified()
  .use(parse)
  .use(frontmatter, ['yaml'])
  .use(() => db.inspect())
  .use(stringify)

connection.onNotification('file', ({ path, body }: { path: string, body: string }) => {
  processor.process(vfile({ path, contents: body }))
})

documents.onDidChangeContent(change => {
  processor.process(vfile({ path: change.document.uri, contents: change.document.getText() }))
})

connection.onHover((params: ls.HoverParams): ls.Hover | null => {
  const path = params.textDocument.uri
  const document = documents.get(path)
  if (!document) {
    return null
  }

  const contents = document.getText()

  unified()
    .use(parse)
    .use(frontmatter, ['yaml'])
    // TODO: this will need to include pi-base parser extensions in order to be able
    // to hover over custom {{-}} tags
    .use(() => db.hover(params))
    .use(stringify)
    .process(vfile({ path, contents }))


  if (params.position.line !== 2) {
    return null
  }

  return {
    range: {
      start: ls.Position.create(2, 7),
      end: ls.Position.create(2, 100),
    },
    contents: {
      kind: 'plaintext',
      value: 'Discrete topology on a two-point set'
    }
  }
})

documents.listen(connection)
connection.listen()
