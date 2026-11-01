# Yarn and dependency workflow

The project pins **Yarn 4.18.1**, verified against the [official stable release index](https://repo.yarnpkg.com/tags) on **2026-11-01**. The version is declared in `package.json` and the official CLI is committed as `.yarn/releases/yarn-4.18.1.cjs`, with its upstream license beside it. `.yarnrc.yml` selects that file through `yarnPath`, keeps `nodeLinker: node-modules`, disables telemetry, and uses the public npm registry.

## Start with the pinned release

Use the repository's Node.js version, then install from its lockfile:

```sh
nvm install
nvm use
node .yarn/releases/yarn-4.18.1.cjs --version
node .yarn/releases/yarn-4.18.1.cjs install --immutable
```

An existing Yarn Classic launcher reads `.yarnrc.yml` and delegates to this release before running project commands. An enabled Corepack launcher can also use the `packageManager` pin. No global Yarn/Corepack installation is required for the direct Node commands above. Documentation uses `yarn` as shorthand; if no launcher is available, replace it with `node .yarn/releases/yarn-4.18.1.cjs`.

Run `yarn --version` from the project root: it must report `4.18.1`. `DEP0169` from the former Classic metadata parser was reproduced at its `url.parse(homepage)` call; the pinned release bypasses that code. If the old warning/version returns, check the current directory, committed `.yarnrc.yml`/release file, and overrides such as `YARN_IGNORE_PATH`. Do not remove valid package metadata or disable Node warnings to hide it.

## Installation and generated files

Use `yarn install --immutable` for existing lockfiles and CI. It fails if installation would change `yarn.lock`; the legacy `--frozen-lockfile` spelling is superseded. Intentional dependency changes use `yarn add` / `yarn remove` or a reviewed manifest change followed by `yarn install`, then commit the manifest and lockfile together.

Only the pinned CLI and its license are committed under `.yarn/`. Project-local caches and install state are ignored. Vendored tool code is excluded from ESLint/Prettier and must remain the unmodified upstream artifact. The application still uses ordinary `node_modules`; no Plug'n'Play loader or editor SDK setup is needed.

Local migration used `install --mode=skip-build`, which skips dependency lifecycle/build execution. This is different from a normal fresh installation: normal installation can run required native setup for bcrypt, sharp, esbuild, and platform packages. Skipping builds is useful for dependency review but does not qualify native runtime behavior. Tests are separate work; no test command is introduced.

### TypeScript compatibility note

The build uses TypeScript **7.0.2** through the pinned `@typescript/native` alias and `node_modules/@typescript/native/bin/tsc`. Bare `typescript` pins the complete JavaScript SDK **6.0.3** for ESLint/tools that need the previous compiler API. Do not replace the explicit build/typecheck compiler path with whichever `tsc` happens to occupy `.bin`.

The former `typescript: npm:@typescript/typescript6@6.0.2` dependency was a re-export shim whose actual SDK was already 6.0.3. Yarn identifies builtin compatibility-patch targets by dependency name, so it tried to patch this shim's missing `lib/_tsc.js`, producing **YN0066** ([upstream issue](https://github.com/microsoft/typescript-go/issues/4368)). The direct `typescript: 6.0.3` dependency contains the real compiler/API files, so Yarn's normal patch applies to the correct distribution. The shim and its indirect `@typescript/old` dependency are removed from the lockfile. TypeScript 7 compilation is unchanged.

An immutable installation with a separate empty package/global cache and mirroring disabled completed without warnings, with dependency lifecycle/build execution skipped. No warning filter, vendor edit, custom plugin, or global compatibility-disable setting is used. This project retains the node-modules linker; PnP runtime support is not claimed.

## Containers

The Docker dependency stage copies `package.json`, `yarn.lock`, `.yarnrc.yml`, and the committed release, then runs that exact CLI with `install --immutable`. The build stage uses the same CLI. The production-dependency stage starts from the installed dependency stage and runs `workspaces focus --all --production` with immutable installs enabled, then clears its package cache.

The final runtime image receives compiled output, production `node_modules`, package metadata, and the application license. The project-local Yarn release, caches, and compilers are not copied from build stages. Compose and container operations invoke `node dist/...` directly, independently of any global package manager in the base image; host checkouts may continue using the documented `yarn start` and `:prod` scripts. Docker/native platform acceptance is separate from the local lockfile migration.

## CI and future updates

Use the committed CLI directly when a CI runner has no configured launcher. After installation, the existing `typecheck`, `lint`, `format:check`, and `build` scripts remain available. Do not use Classic install flags such as `--production=true` or `--non-interactive`; [Yarn focus](https://yarnpkg.com/cli/workspaces/focus) handles production dependency selection.

To intentionally update Yarn later, use `yarn set version stable --yarn-path`, inspect the selected release, and update the Docker CLI paths and versioned instructions together. Review generated migration settings; this project does not need blanket Git-repository approvals or a disabled package-age policy. Regenerate the lockfile only when needed, then confirm an immutable install leaves it unchanged.

The migration retained dependency lifecycle/build skipping and ran no tests, API/worker processes, database commands, SMTP requests, or containers. A cached immutable install completed without lockfile changes; a separate temporary production-focus installation with scripts disabled retained the runtime packages, removed TypeScript/tsx/lint/format tools, and kept the lockfile unchanged. Its disabled-build notices are expected. Local tooling results are recorded in the [README](../README.md#validation-status).
