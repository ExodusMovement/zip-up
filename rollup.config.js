import flow from 'rollup-plugin-flow'
import { dependencies } from './package.json'

export default {
  input: 'index.js',
  output: {
    file: 'bundle.js',
    format: 'cjs'
  },
  plugins: [flow()],
  external: Object.keys(dependencies).concat(['fs', 'path', 'zlib'])
}
