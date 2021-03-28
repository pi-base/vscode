import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

export default [
  {
    input: 'src/extension.ts',
    output: {
      file: 'dist/main.js',
      format: 'cjs',
      sourcemap: true
    },
    external: [
      'vscode'
    ],
    plugins: [
      typescript(),
      nodeResolve(),
      commonjs()
    ],
  },
  {
    input: 'src/server.ts',
    output: {
      file: 'dist/server.js',
      format: 'cjs',
      sourcemap: true
    },
    external: [
      'vscode'
    ],
    plugins: [
      json(),
      typescript(),
      nodeResolve(),
      commonjs()
    ],
  }
]
