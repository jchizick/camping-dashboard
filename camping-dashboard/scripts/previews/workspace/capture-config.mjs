// A single capture contract shared by tooling and unit tests.
export const capture = Object.freeze({
  fixedTime: '2027-07-04T12:00:00.000Z', locale: 'en-US', timezoneId: 'America/Toronto',
  viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2,
  wrapper: { width: 1280, height: 797 }, scale: 8 / 9,
  selector: '[data-workspace-preview-capture]', width: 2560, height: 1594, quality: 90,
  baseline: '494b7612e060df6f9ea608fa19868fe9f15b364e',
  historicalSha256: 'e0d67ac883be7f327b5dd0e4fb669dec20679b95c7f9664632853248efa9ec46',
});
