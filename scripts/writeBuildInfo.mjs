// Runs as the second `postbuild` step (see package.json), after prerenderSeo.mjs. Writes
// build/version.json, which an open storefront tab polls to learn that a newer build has been
// deployed (src/shared/hooks/useStaleBundleReload.ts). index.html is only revalidated on a full
// page load, so without this a tab kept open across a deploy keeps showing the old checkout.
//
// `main` is the comparison key: CRA content-hashes the entry chunk, so its path changes exactly
// when the shipped code does. `version` is for people only -- a CalVer stamp in Bahrain time, so
// nobody has to remember to bump anything.

import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const BUILD_DIR = path.resolve(process.cwd(), 'build');
const TIME_ZONE = 'Asia/Bahrain';

function bahrainCalVer(date) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', {
            timeZone: TIME_ZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        }).formatToParts(date).map(part => [part.type, part.value]),
    );
    return `${parts.year}.${parts.month}.${parts.day}.${parts.hour}${parts.minute}`;
}

async function readMainBundlePath() {
    const manifestPath = path.join(BUILD_DIR, 'asset-manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const main = manifest?.files?.['main.js'];
    if (typeof main !== 'string' || main.length === 0) {
        throw new Error(
            `${manifestPath} has no files["main.js"], so open tabs could not tell which bundle is current.`,
        );
    }
    return main;
}

async function writeBuildInfo() {
    const builtAt = new Date();
    const buildInfo = {
        main: await readMainBundlePath(),
        commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
        builtAt: builtAt.toISOString(),
        version: bahrainCalVer(builtAt),
    };
    await writeFile(path.join(BUILD_DIR, 'version.json'), `${JSON.stringify(buildInfo, null, 2)}\n`);
    console.log(`wrote version.json (${buildInfo.version}, ${buildInfo.main})`);
}

writeBuildInfo().catch(err => {
    console.error(`writeBuildInfo failed: ${err.message}`);
    process.exit(1);
});
