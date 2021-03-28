import * as ls from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'

import unist from 'unist'
import * as vfile from 'vfile'
import visit from 'unist-util-visit'
import * as y from 'yaml-language-server-parser'

export default class DB {
  properties: Map<string, string>
  spaces: Map<string, string>
  sendDiagnostics: (params: ls.PublishDiagnosticsParams) => void

  constructor({
    properties = new Map(),
    spaces = new Map(),
    sendDiagnostics,
  }: {
    properties?: Map<string, string>
    spaces?: Map<string, string>
    sendDiagnostics: (params: ls.PublishDiagnosticsParams) => void
  }) {
    this.properties = properties
    this.spaces = spaces
    this.sendDiagnostics = sendDiagnostics
  }

  hover({ position }: ls.HoverParams) {
    return (tree: unist.Node, file: vfile.VFile) => {
      const path = file.path
      if (!path) {
        return
      }

      const doc = TextDocument.create(
        path,
        'markdown',
        0,
        file.contents.toString(),
      )

      const node = focus(tree, doc, position)
      console.log(node)
    }
  }

  inspect() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this

    return (tree: unist.Node, file: vfile.VFile) => {
      const diagnostics: ls.Diagnostic[] = []

      const path = file.path
      if (!path) {
        return
      }

      const doc = TextDocument.create(
        path,
        'markdown',
        0,
        file.contents.toString(),
      )

      const classification = classify(path)
      if (!classification) {
        return
      } // TODO: diagnostic for entire file?

      const { kind, uid } = classification

      visit(tree, 'yaml', node => {
        if (!('value' in node) || typeof node.value !== 'string') {
          return
        }

        const nodeStart = node.position?.start
        const nodeOffset = nodeStart
          ? doc.offsetAt(
              ls.Position.create(nodeStart.line, nodeStart.column - 1),
            )
          : 0

        function warn(n: y.YAMLNode, message: string) {
          diagnostics.push({
            severity: ls.DiagnosticSeverity.Warning,
            range: {
              start: doc.positionAt(n.startPosition + nodeOffset),
              end: doc.positionAt(n.endPosition + nodeOffset),
            },
            message,
          })
        }

        const loaded: y.YAMLNode = y.safeLoad(node.value)
        ;(loaded as y.YamlMap).mappings.forEach(mapping => {
          const { key, value } = mapping

          const k: string = (key as y.YAMLScalar).value

          if (k === 'uid') {
            // warn(mapping, 'Uid will be read from the file path. Setting a `uid` field is deprecated.')
          } else if (k === 'slug') {
            // warn(mapping, '`slug` is deprecated')
          } else if (k === 'name') {
            const name = (value as y.YAMLScalar).value
            switch (kind) {
              case 'space':
                self.spaces.set(uid, name)
                break
              case 'property':
                self.properties.set(uid, name)
                break
              default:
                break
            }
          } else if (k === 'if' || k === 'then') {
            formulaKeys(value, (node, value) => {
              if (!self.properties.has(value)) {
                warn(node, `Could not find property: ${value}`)
              }
            })
          } else if (k === 'space') {
            const v = reify(value)
            if (!self.spaces.has(v)) {
              warn(value, `Could not find space: ${v}`)
            }
          } else if (k === 'property') {
            const v = reify(value)
            if (!self.properties.has(v)) {
              warn(value, `Could not find property: ${v}`)
            }
          }
        })
      })

      self.sendDiagnostics({ uri: path, diagnostics })
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reify(node: y.YAMLNode): any {
  switch (node.kind) {
    case y.Kind.SEQ:
      const seq = node as y.YAMLSequence
      return seq.items.map(node => reify(node))
    case y.Kind.MAP:
      const map = node as y.YamlMap
      return new Map(
        map.mappings.map(value => [reify(value.key), reify(value.value)]),
      )
    case y.Kind.SCALAR:
      return (node as y.YAMLScalar).value
  }
}

function formulaKeys(
  node: y.YAMLNode,
  cb: (node: y.YAMLNode, value: string) => void,
) {
  let queue = [node]
  let target: y.YAMLNode | undefined
  while ((target = queue.shift())) {
    switch (target.kind) {
      case y.Kind.SEQ:
        const seq = target as y.YAMLSequence
        queue = queue.concat(seq.items)
        continue
      case y.Kind.MAP:
        const map = target as y.YamlMap
        queue = queue.concat(map.mappings)
        continue
      case y.Kind.MAPPING:
        const mapping = target as y.YAMLMapping
        if (mapping.key.kind === y.Kind.SCALAR) {
          const k = (mapping.key as y.YAMLScalar).value
          if (typeof k === 'string' && k !== 'and' && k !== 'or') {
            cb(mapping.key, k)
          }
        }
        queue.push(mapping.value)
        continue
    }
  }
}

const matchers: Record<string, RegExp> = {
  property: /\/properties\/(\w+)\.md$/,
  space: /\/spaces\/(\w+)\/README\.md$/,
  theorem: /\/theorems\/(\w+)\.md$/,
}

function classify(path: string) {
  for (const kind in matchers) {
    const match = path.match(matchers[kind])
    if (match) {
      return { kind, uid: match[1] }
    }
  }
  return
}

function focus(tree: unist.Node, doc: TextDocument, position: ls.Position) {
  const offset = doc.offsetAt(position)

  console.log('focusing', JSON.stringify({ offset, position }, null, 2))

  let current = tree
  while (true) {
    if ('children' in current) {
      const child = (current.children as unist.Node[]).find(c => {
        console.log(JSON.stringify(c, null, 2))
        if (!c.position?.start?.offset || !c.position?.end?.offset) {
          return false
        }

        return (
          c.position.start.offset <= offset && offset <= c.position.end.offset
        )
      })

      if (child) {
        console.log('found child', JSON.stringify(child, null, 2))
        current = child
        continue
      }
    }

    return current
  }
}
