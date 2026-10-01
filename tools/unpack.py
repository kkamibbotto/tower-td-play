"""Publish only the reviewed runtime artifact, never a source checkout."""
import hashlib
import json
from pathlib import Path
import zipfile

manifest = json.loads(Path('build.json').read_text())
archive = Path(manifest['archive'])
actual = hashlib.sha256(archive.read_bytes()).hexdigest()
if actual != manifest['sha256']:
    raise SystemExit('BUILD_SHA256_MISMATCH')
target = Path('public')
target.mkdir(exist_ok=True)
with zipfile.ZipFile(archive) as z:
    names = z.namelist()
    if len(names) != len(set(names)) or set(names) != set(manifest['files']):
        raise SystemExit('UNEXPECTED_RUNTIME_FILE_SET')
    for item in z.infolist():
        if Path(item.filename).name != item.filename or item.file_size > 64 * 1024 * 1024:
            raise SystemExit('INVALID_RUNTIME_FILE')
        (target / item.filename).write_bytes(z.read(item))
(target / '.nojekyll').write_text('')
(target / 'build-info.json').write_text(json.dumps({
    'source_commit': manifest['source_commit'], 'archive_sha256': actual,
    'godot': manifest['godot']
}, indent=2) + '\n')
print('RUNTIME_PACKAGE_VERIFIED', actual, len(names))
