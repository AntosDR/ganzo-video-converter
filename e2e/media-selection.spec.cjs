const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('playwright/test');
const {
	acceptMedia,
	launchGanzo,
	selectMedia,
} = require('./support/electron-app.cjs');

test('selects media, reviews metadata, and supports removal', async () => {
	const ganzo = await launchGanzo();
	try {
		await selectMedia(ganzo.page);
		const review = ganzo.page.locator('.media-review');
		await expect(review).toContainText('fixture.mp4');
		await expect(review).toContainText('320x240');
		await expect(review).toContainText('h264');
		await expect(review).toContainText('aac');

		await acceptMedia(ganzo.page);
		await expect(
			ganzo.page.getByText('Selected:', { exact: false }),
		).toHaveCount(0);
		await ganzo.page
			.getByRole('button', { name: 'Previous', exact: true })
			.click();
		await ganzo.page
			.getByRole('button', { name: 'Remove selection' })
			.click();
		await expect(
			ganzo.page.getByRole('button', { name: 'Choose media' }),
		).toBeVisible();
		await expect(
			ganzo.page.getByRole('button', {
				name: 'Media view 2 of 2: Review media',
			}),
		).toBeDisabled();
	} finally {
		await ganzo.close();
	}
});

test('drops a real video file into the renderer and inspects its metadata', async () => {
	const ganzo = await launchGanzo();
	try {
		const zone = await ganzo.page.locator('.drop-zone').boundingBox();
		const session = await ganzo.page.context().newCDPSession(ganzo.page);
		const data = {
			items: [
				{
					mimeType: 'text/uri-list',
					data: `file://${ganzo.mediaPath}`,
				},
			],
			files: [ganzo.mediaPath],
			dragOperationsMask: 1,
		};
		for (const type of ['dragEnter', 'dragOver', 'drop']) {
			await session.send('Input.dispatchDragEvent', {
				type,
				x: zone.x + zone.width / 2,
				y: zone.y + zone.height / 2,
				data,
			});
		}
		await expect(
			ganzo.page.getByRole('heading', { name: 'Review media' }),
		).toBeVisible({ timeout: 10_000 });
		await expect(ganzo.page.locator('.media-review')).toContainText(
			'fixture.mp4',
		);
		await expect(ganzo.page.locator('.media-review')).toContainText(
			'320x240',
		);
	} finally {
		await ganzo.close();
	}
});

test('reports an invalid dropped file without retaining stale media', async () => {
	const ganzo = await launchGanzo();
	try {
		const invalidMedia = path.join(ganzo.directory, 'broken.mp4');
		await fs.writeFile(invalidMedia, 'not a media stream');
		const zone = await ganzo.page.locator('.drop-zone').boundingBox();
		const session = await ganzo.page.context().newCDPSession(ganzo.page);
		const data = {
			items: [
				{
					mimeType: 'text/uri-list',
					data: `file://${invalidMedia}`,
				},
			],
			files: [invalidMedia],
			dragOperationsMask: 1,
		};
		for (const type of ['dragEnter', 'dragOver', 'drop']) {
			await session.send('Input.dispatchDragEvent', {
				type,
				x: zone.x + zone.width / 2,
				y: zone.y + zone.height / 2,
				data,
			});
		}
		await expect(ganzo.page.getByRole('alert')).toContainText(
			/FFmpeg|media/i,
		);
		await expect(
			ganzo.page.getByRole('heading', { name: 'Review media' }),
		).toHaveCount(0);
	} finally {
		await ganzo.close();
	}
});
