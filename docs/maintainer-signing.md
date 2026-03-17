# Maintainer Signing

AgentForge maintainers use SSH commit signing through 1Password.

## Expected Local Configuration

The canonical local Git settings are:

```bash
git config --global gpg.format ssh
git config --global gpg.ssh.program /Applications/1Password.app/Contents/MacOS/op-ssh-sign
git config --global user.signingkey "ssh-rsa AAAA..."
git config --global commit.gpgsign true
```

Maintain your normal `user.name` and `user.email` settings separately. GitHub must recognize the SSH signing key for commits to show as `Verified`.

If you also want local SSH signature verification through `git log --show-signature`, configure `gpg.ssh.allowedSignersFile` separately. That local verification file is optional for GitHub’s `Verified` status.

## Normal Maintainer Workflow

Use signed commits for normal branch work and pull requests. Do not disable signing for regular maintainer changes.

Recommended flow:

```bash
git checkout -b codex/example-change
# edit files
git add <files>
git commit -m "Describe the change"
git push -u origin codex/example-change
```

Open a pull request and confirm GitHub shows the commit as `Verified`.

## Rebase And Cherry-Pick Recovery

The most common failure during terminal automation is not the signer itself. It is Git trying to open an editor during `rebase --continue` in a noninteractive environment.

For maintainer rebases or cherry-picks driven from a terminal automation flow, use:

```bash
git -c core.editor=: rebase --continue
```

This keeps commit signing enabled while avoiding the editor prompt that blocks noninteractive rebases.

If you need to continue a cherry-pick in the same kind of environment, the same pattern applies:

```bash
git -c core.editor=: cherry-pick --continue
```

## Troubleshooting

### Editor Or Terminal Problem

Symptoms:

- `Terminal is dumb, but EDITOR unset`
- `Waiting for your editor to close the file...`

Meaning:

- Git is trying to open an editor for the rebased commit message
- this is not evidence that SSH signing is broken

Fix:

- rerun with `git -c core.editor=: rebase --continue`

### Genuine Signer Failure

Symptoms:

- `1Password: agent returned an error`
- `fatal: failed to write commit object`

Meaning:

- the SSH signing agent did not complete the signature request

Checks:

- confirm 1Password is unlocked
- confirm the Git SSH signing key is still available in 1Password
- retry a plain signed commit in a disposable temp repo before changing repo policy

### Local Verification File Missing

Symptoms:

- `gpg.ssh.allowedSignersFile needs to be configured and exist for ssh signature verification`
- `git log --show-signature` reports `No signature` or status `N` locally even though the commit was signed

Meaning:

- the commit may still be validly signed
- local Git cannot verify SSH signatures without an allowed signers file

Fix:

- treat GitHub’s `Verified` badge as the repo-level source of truth
- configure `gpg.ssh.allowedSignersFile` separately only if you want local SSH signature verification

### Acceptable Temporary Exceptions

For disposable local test repos or automated fixture repos, `--no-gpg-sign` is acceptable when the goal is only to create scratch commits for tests.

Do not use `--no-gpg-sign` for normal AgentForge maintainer work once required signed commits are enabled on `main`.
