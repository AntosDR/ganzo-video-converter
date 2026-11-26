import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { dependencies } from '../../package.json';
import paths from '../configs/paths';

if (
	Object.keys(dependencies || {}).length > 0 &&
	fs.existsSync(path.join(paths.rootPath, 'node_modules'))
) {
	const electronRebuildCmd =
		'./node_modules/.bin/electron-rebuild --force --types prod,dev,optional --module-dir .';
	const cmd =
		process.platform === 'win32'
			? electronRebuildCmd.replace(/\//g, '\\')
			: electronRebuildCmd;
	execSync(cmd, {
		cwd: paths.rootPath,
		stdio: 'inherit',
	});
}
