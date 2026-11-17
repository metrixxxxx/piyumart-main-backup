# Remove private backups from GitHub

## Local protection completed

- `.gitignore` now excludes `/backups/` and `/scripts/backups/`.
- All 238 backup files were removed from the Git index. These are staged Git
  deletions, not deletions from your computer. Every local file's SHA-256 was
  checked before and after; all files are unchanged.
- `.env.local` remains ignored. Application changes are still present.

The backup commits are referenced by the locally recorded `origin/main`, so a
normal deletion commit does not clean the existing history. Other configured
remotes also reference some affected commits. Remote state was not fetched during
this check. No commit, push, or history rewrite has been performed.

## Clean the existing GitHub history

1. Keep a private copy of the current project, including your uncommitted work
   and `.env.local`. Do not upload this copy. Keep the original working directory
   intact throughout cleanup. Ask teammates to pause pushes.
2. Install Python and [git-filter-repo](https://github.com/newren/git-filter-repo/blob/main/INSTALL.md)
   version 2.47 or later. `git filter-repo` is currently unavailable here, and
   the `python` command resolved to an inaccessible Windows app alias.
3. In a separate folder outside this project, run these preparation commands.
   The fresh mirror contains the GitHub commits, **not the uncommitted changes
   in your current project**:

   ```powershell
   git clone --mirror https://github.com/metrixxxxx/piyumart-main-backup.git piyumart-sanitized.git
   Set-Location piyumart-sanitized.git
   git filter-repo --sensitive-data-removal --invert-paths --path backups/ --path scripts/backups/
   git log --all -- backups/ scripts/backups/
   ```

4. The last command should print nothing. Review the filter report and affected
   refs before publishing. Check `git remote -v`; if the tool removed `origin`,
   add back only the original GitHub URL above.
5. Once collaborators have stopped updating the repository and the rewritten
   refs have been reviewed, publish **from that fresh mirror only**:

   ```powershell
   git push --force --mirror origin
   ```

   This overwrites shared history. Do not run it from your existing project,
   which also has teammate and updated remotes. Address branch-protection errors;
   pull-request refs may require GitHub Support.
6. Use a fresh working clone afterward. Copy the current application changes
   and `.gitignore` from the preserved original directory, excluding `.git`,
   backup folders, build output and dependencies. Include the new source files
   listed in `docs/performance.md`. Review, commit, and push normally from the
   new clone. Restore `.env.local` locally only; never stage it.

Collaborators should re-clone rather than merge old history. Other repositories
containing these commits require their owners' cleanup too. Cached views and
pull-request references can require GitHub Support. This follows
[GitHub's sensitive-data removal procedure](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

If these backups were publicly accessible, treat their personal data as exposed
and require password resets for affected accounts whose hashes are still in use.
Revoke exposed tokens as well; removing Git history cannot invalidate credentials
or erase copies already downloaded.
