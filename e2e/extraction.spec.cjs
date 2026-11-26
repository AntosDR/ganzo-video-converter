const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const { test, expect } = require('playwright/test');
const {
	acceptMedia,
	chooseAction,
	ffmpegPath,
	launchGanzo,
	revealedOutputs,
	selectMedia,
} = require('./support/electron-app.cjs');

test('extracts MP3, reports completion, and reveals the output file', async () => {
	const ganzo = await launchGanzo();
	try {
		await selectMedia(ganzo.page);
		await acceptMedia(ganzo.page);
		await chooseAction(ganzo.page, 'audio');

		await ganzo.page
			.getByRole('button', { name: 'Choose output file' })
			.click();
		await expect(
			ganzo.page.getByText(ganzo.outputPath, { exact: true }),
		).toBeVisible();
		await ganzo.page
			.getByRole('button', { name: 'Start extraction' })
			.click();
		await expect(
			ganzo.page.getByRole('heading', { name: 'Extraction complete' }),
		).toBeVisible({ timeout: 30_000 });

		const output = await fs.stat(ganzo.outputPath);
		expect(output.size).toBeGreaterThan(0);
		execFileSync(ffmpegPath, [
			'-hide_banner',
			'-loglevel',
			'error',
			'-i',
			ganzo.outputPath,
			'-f',
			'null',
			'-',
		]);

		await ganzo.page
			.getByRole('button', { name: 'Show output in file manager' })
			.click();
		await expect
			.poll(() => revealedOutputs(ganzo.application))
			.toEqual([ganzo.outputPath]);
	} finally {
		await ganzo.close();
	}
});

test('extracts JPG frames with the selected folder and opens that output', async () => {
	const ganzo = await launchGanzo();
	try {
		await selectMedia(ganzo.page);
		await acceptMedia(ganzo.page);
		await chooseAction(ganzo.page, 'frames');
		await ganzo.page
			.getByRole('button', { name: 'Choose output folder' })
			.click();
		await expect(
			ganzo.page.getByText(ganzo.outputDirectory, { exact: true }),
		).toBeVisible();
		await ganzo.page.getByLabel('Sampling mode').selectOption('percentage');
		await ganzo.page.getByLabel('Sampling value').fill('25');
		await ganzo.page
			.getByRole('button', { name: 'Start extraction' })
			.click();
		await expect(
			ganzo.page.getByRole('heading', { name: 'Extraction complete' }),
		).toBeVisible({ timeout: 30_000 });

		const frameNames = await fs.readdir(ganzo.outputDirectory);
		const jpgFrames = frameNames.filter((name) => /\.jpe?g$/i.test(name));
		expect(jpgFrames.length).toBeGreaterThanOrEqual(4);
		expect(jpgFrames.length).toBeLessThanOrEqual(5);
		for (const name of jpgFrames) {
			const framePath = `${ganzo.outputDirectory}/${name}`;
			expect((await fs.stat(framePath)).size).toBeGreaterThan(0);
			execFileSync(ffmpegPath, [
				'-hide_banner',
				'-loglevel',
				'error',
				'-i',
				framePath,
				'-f',
				'null',
				'-',
			]);
		}

		await ganzo.page
			.getByRole('button', { name: 'Show output in file manager' })
			.click();
		await expect
			.poll(() => revealedOutputs(ganzo.application))
			.toEqual([ganzo.outputDirectory]);
	} finally {
		await ganzo.close();
	}
});
