# Release Process (AutoSort+)

How to cut a new release. Run all commands from the repo root:

```bash
cd /home/nigel/AutoSort+/AutoSort-Plus
```

## 1. Bump the version

Edit `manifest.json`:

- Set `"version"` (e.g. `1.4.1`).
- Remove any `TEST` label from `name`/`description` for a stable release.

## 2. Update the docs

- **`README.md`** — bump both version badges and add a new entry at the top of `## 📝 Changelog`.
- **`release_notes.md`** — add a `## AutoSort+ vX.Y.Z` section at the very top (this becomes the GitHub release body).
- **`docs/index.md`** — bump the version badge(s) and refresh the "Latest Release" banner.
- **`docs/_config.yml`** — update the description if providers/features changed.

> Keep historical files (`RELEASE_NOTES_*`, `CHANGELOG_OLLAMA.md`, `REDDIT_POST.md`) as-is; they document past releases.

## 3. Rebuild the XPI

The XPI bundles the docs, so rebuild it after any change:

```bash
rm -f autosortplus.xpi
zip -r -q autosortplus.xpi . -x "./.git/*" -x "./.github/*" -x "./.gitignore" -x "./autosortplus.xpi"
unzip -t autosortplus.xpi | tail -1
```

Quick sanity check that the version inside the XPI is right:

```bash
python3 -c "import zipfile,json; print(json.loads(zipfile.ZipFile('autosortplus.xpi').read('manifest.json'))['version'])"
```

## 4. Commit and tag

```bash
git add -A
git commit -m "Release vX.Y.Z: <summary>"
git tag -a vX.Y.Z -m "AutoSort+ vX.Y.Z - <summary>"
git push origin main
git push origin vX.Y.Z
```

## 5. Create the GitHub release

Extract the top section of `release_notes.md` as the release body, then create the release and attach the XPI:

```bash
python3 - <<'PY'
txt = open('release_notes.md').read()
start = txt.index('## AutoSort+ vX.Y.Z')          # <-- new version
end = txt.index('## AutoSort+ ', start + 1)        # <-- next (older) version
open('/tmp/opencode/notes.md', 'w').write(txt[start:end].rstrip().rstrip('-').rstrip() + '\n')
PY

gh release create vX.Y.Z autosortplus.xpi \
  --title "AutoSort+ vX.Y.Z - <summary>" \
  --notes-file /tmp/opencode/notes.md \
  --latest
```

Add `--prerelease` for test builds.

> A tag push also triggers `.github/workflows/discord-notify.yml`.

## Replacing an already-published release

If a release was just published and needs to be replaced (e.g. a missing changelog item or a hotfix):

```bash
git add -A
git commit --amend --no-edit
git tag -f -a vX.Y.Z -m "AutoSort+ vX.Y.Z - <summary>"
git push --force-with-lease origin main
git push --force origin vX.Y.Z

gh release edit vX.Y.Z --notes-file /tmp/opencode/notes.md
gh release upload vX.Y.Z autosortplus.xpi --clobber
```
