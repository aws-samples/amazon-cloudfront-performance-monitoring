/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
// import { onBFCacheRestore } from './lib/bfcache.js';
import { bindReporter } from './lib/bindReporter.js';
// import { getVisibilityWatcher } from './lib/getVisibilityWatcher.js';
import { initMetric } from './lib/initMetric.js';
import { observe } from './lib/observe.js';
import { onHidden } from './lib/onHidden.js';
import { ResourceMetric, ReportCallback, ReportOpts } from './types.js';

/**
 * Runs in the next task after the page is done loading and/or prerendering.
 * @param callback
 */
const whenReady = (callback: () => void) => {
  if (document.prerendering) {
    addEventListener('prerenderingchange', () => whenReady(callback), true);
  } else if (document.readyState !== 'complete') {
    addEventListener('load', () => whenReady(callback), true);
  } else {
    // Queue a task so the callback runs after `loadEventEnd`.
    setTimeout(callback, 0);
  }
}

/**
 * Calculates the performance metrics for resources and 
 * calls the `callback` function once the value is ready, along with the
 * relevant performance entry used to determine the value. The
 * reported value is a `DOMHighResTimeStamp`.
 */
export const onResource = (onReport: ReportCallback, opts?: ReportOpts) => {
  // Set defaults
  opts = opts || {};

  // https://web.dev/fid/#what-is-a-good-fid-score
  const thresholds = [100, 300];

  whenReady(() => {

    const handleEntry = (entry: PerformanceResourceTiming) => {
      if (entry.name.indexOf("dataplane.rum") != -1 ||
        entry.name.indexOf("cognito-identity.") != -1 ||
        entry.name.indexOf("sts.") != -1) {
        return;
      }
      let metric = initMetric('RESOURCE');
      let report: ReturnType<typeof bindReporter>;
      report = bindReporter(onReport, metric, thresholds, opts?.reportAllChanges);
      // Only report if the page wasn't hidden prior to the first input.
      // console.log("Entry :%j", entry);
      // total time
      metric.value = entry.responseEnd - entry.startTime;
      metric.entries = [entry];
      report(true);
    }

    const handleEntries = (entries: ResourceMetric['entries']) => {
      (entries as PerformanceResourceTiming[]).forEach(handleEntry);
    }

    const po = observe('resource', handleEntries);

    if (performance === undefined) {
      console.log("= Calculate Load Times: performance NOT supported");
      return;
    }

    if (po) {
      onHidden(() => {
        handleEntries(po.takeRecords() as ResourceMetric['entries']);
        po.disconnect();
      }, true);
    }
  });
};
