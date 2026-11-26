const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('playwright/test');
const {
	acceptMedia,
	chooseAction,
	createFixture,
	launchGanzo,
	selectMedia,
} = require('./support/electron-app.cjs');

test('keeps legacy placeholders unavailable and prevents invalid JPG settings', async () => {
	const ganzo = await launchGanzo();
	try {
		await selectMedia(ganzo.page);
		await acceptMedia(ganzo.page);
		for (let index = 0; index < 5; index += 1)
			await ganzo.page
				.getByRole('button', { name: 'Next action' })
				.click();
		for (const name of ['Change format', 'Add watermark']) {
			const card = ganzo.page.getByRole('article', {
				name: `${name}, unavailable`,
			});
			await expect(card).toBeVisible();
			await expect(
				card.getByRole('button', { name: 'Not available' }),
			).toBeDisabled();
			if (name !== 'Add watermark')
				await ganzo.page
					.getByRole('button', { name: 'Next action' })
					.click();
		}

		for (let index = 0; index < 6; index += 1)
			await ganzo.page
				.getByRole('button', { name: 'Previous action' })
				.click();
		await chooseAction(ganzo.page, 'frames');
		await ganzo.page.getByLabel('Duration (seconds)').fill('999');
		await expect(
			ganzo.page.getByText(
				'Start time plus duration cannot exceed the media duration.',
			),
		).toBeVisible();
		await expect(
			ganzo.page.getByRole('button', { name: 'Choose output folder' }),
		).toBeDisabled();
	} finally {
		await ganzo.close();
	}
});

test('shows media inspection errors without stale success state', async () => {
	const ganzo = await launchGanzo();
	try {
		const invalidMedia = path.join(ganzo.directory, 'broken.mp4');
		await fs.writeFile(invalidMedia, 'not a media stream');
		await ganzo.application.evaluate(({ dialog }, selectedPath) => {
			dialog.showOpenDialog = async () => ({
				canceled: false,
				filePaths: [selectedPath],
			});
		}, invalidMedia);
		await ganzo.page.getByRole('button', { name: 'Choose media' }).click();
		await expect(ganzo.page.getByRole('alert')).toContainText(
			/FFmpeg|media/i,
		);
		await expect(
			ganzo.page.getByRole('heading', { name: 'Review media' }),
		).toHaveCount(0);
		await expect(
			ganzo.page.getByRole('button', {
				name: 'Media view 2 of 2: Review media',
			}),
		).toBeDisabled();
	} finally {
		await ganzo.close();
	}
});

test('cancels a running extraction without offering a false success', async () => {
	const directory = await fs.mkdtemp(
		path.join(require('node:os').tmpdir(), 'ganzo-abort-'),
	);
	const slowMedia = await createFixture(directory, 600);
	const ganzo = await launchGanzo({
		mediaPath: slowMedia,
		duration: 600,
	});
	try {
		await selectMedia(ganzo.page);
		await acceptMedia(ganzo.page);
		await chooseAction(ganzo.page, 'audio');
		await ganzo.page
			.getByRole('button', { name: 'Choose output file' })
			.click();
		await ganzo.page
			.getByRole('button', { name: 'Start extraction' })
			.click();
		await expect(
			ganzo.page.getByRole('heading', { name: 'Running extraction' }),
		).toBeVisible({ timeout: 10_000 });
		await ganzo.page
			.getByRole('button', { name: 'Cancel extraction' })
			.click();
		await expect(
			ganzo.page.getByRole('dialog', { name: 'Stop extraction?' }),
		).toBeVisible();
		await ganzo.page
			.getByRole('button', { name: 'Stop extraction' })
			.click();
		await expect(
			ganzo.page.getByRole('heading', { name: 'Extraction cancelled' }),
		).toBeVisible({ timeout: 15_000 });
		await expect(
			ganzo.page.getByRole('heading', { name: 'Extraction complete' }),
		).toHaveCount(0);
		await expect(fs.stat(ganzo.outputPath)).rejects.toThrow();
	} finally {
		await ganzo.close();
		await fs.rm(directory, { recursive: true, force: true });
	}
});
