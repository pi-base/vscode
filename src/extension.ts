import * as path from 'path'
import * as vscode from 'vscode'

import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient'

let client: LanguageClient

export function activate(context: vscode.ExtensionContext) {
	function start() {
		vscode.window.showInformationMessage('pi-base starting up')

		const module = context.asAbsolutePath(
			path.join('out', 'server.js')
		)

		const serverOptions: ServerOptions = {
			run: { module, transport: TransportKind.ipc },
			debug: {
				module,
				transport: TransportKind.ipc,
				options: {
					execArgv: ['--nolazy', '--inspect=6009']
				}
			}
		}

		const clientOptions: LanguageClientOptions = {
			documentSelector: [{ scheme: 'file', language: 'markdown' }],
			synchronize: {
				fileEvents: vscode.workspace.createFileSystemWatcher('**/*.md')
			}
		}

		client = new LanguageClient(
			'pi-base',
			'Pi-Base Language Server',
			serverOptions,
			clientOptions
		)

		return client.start()
	}

	const restart = vscode.commands.registerCommand('pi-base.restart', () =>
		client.stop().then(start)
	)
	context.subscriptions.push(restart)

	start()

	client.onReady().then(scan)
}

async function pushFiles(pattern: string) {
	const files = await vscode.workspace.findFiles(pattern)
	for (const i in files) {
		const uri = files[i]
		const file = await vscode.workspace.fs.readFile(uri)
		client.sendNotification('file', { path: uri.path, body: file.toString() })
	}
}

async function scan() {
	await pushFiles('properties/*.md')
	await pushFiles('theorems/*.md')
	await pushFiles('spaces/*/README.md')
	// await pushFiles('spaces/**/README.md')
	client.sendNotification('scanComplete') // TODO: hold diagnostics for open files until these are done
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) { return undefined }

	return client.stop()
}
