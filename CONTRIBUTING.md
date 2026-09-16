# Contributing to Multi-Track Audio Visualizer

Thanks for taking an interest. This project is developed inside a private
mono repo and published here as a snapshot, which shapes a couple of the
rules below — please read the last section before opening a PR.

## Getting set up

**Stack:** Node.js.

```bash
git clone https://github.com/geoffmyers/multitrack-audio-visualizer.git
cd multitrack-audio-visualizer
npm install
npm run dev
```

## Checks

<!-- CHECKS:START -->
Every push and pull request runs these checks in GitHub Actions
([`.github/workflows/checks.yml`](.github/workflows/checks.yml)), and every release has passed them.
To run one yourself, use the same commands from the directory shown.

**lint, typecheck, test and build** (Node.js 22, from the repository root):

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

<!-- CHECKS:END -->

## Before you open a pull request

- Keep the change focused. One concern per PR is much easier to review.
- Match the surrounding style rather than introducing a new one. There is no
  separate style guide; the existing code is the guide.
- Update the README if you change behaviour a user can see.
- Explain **why** in the commit message, not just what. The diff already says
  what changed.

## Reporting a bug

Open an issue with what you did, what you expected, and what happened instead.
Version numbers and the exact command or steps help more than anything else.
If it is a crash, include the full error rather than a summary of it.

## Security

Please do **not** open a public issue for a security problem. Report it
privately through GitHub's *Report a vulnerability* button on the Security tab.

## How this repo is published

This project lives in a private mono repo. Each publish adds **one commit** on
top of the history here, so the history grows with every release, but one
commit here can stand for many upstream changes. Two consequences:

- Pull requests are reviewed here and applied upstream, then arrive back in the
  next published commit, which credits your authorship in its message. The pull
  request is closed with a link to that commit rather than merged, because the
  next publish is built from the upstream tree and would undo a change made
  only here.
- Operator configuration (`*.tpl` and similar) is deliberately excluded from
  the snapshot. If a config file looks missing, look for the matching
  `.example` file instead.

## Licence

By contributing you agree that your contribution is licensed under the same
terms as this project — see [LICENSE.md](LICENSE.md).
