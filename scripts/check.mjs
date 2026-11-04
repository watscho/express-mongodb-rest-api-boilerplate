import { runNode } from './testing/process.mjs'

// test:coverage builds once; compilation also checks all application types.
for (const script of ['format:check', 'lint', 'test:coverage']) {
  console.log(`\n> ${script}`)
  const status = runNode(['.yarn/releases/yarn-4.18.1.cjs', script])
  if (status) {
    process.exitCode = status
    break
  }
}
