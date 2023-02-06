/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import { onResource as unattributedOnResource } from '../onResource.js';
import { getCDNProviderCacheStatus } from '../lib/getCDNProvider.js';
import { ResourceMetric, ResourceMetricWithAttribution, ResourceReportCallback, ResourceReportCallbackWithAttribution, ReportOpts } from '../types.js';

const attributeResource = (metric: ResourceMetric): void => {
  if (metric.entries?.length) {
    const performanceEntry = metric.entries[0];
    const activationStart = performanceEntry.startTime || 0;

    const dnsStart = Math.max(
      performanceEntry.domainLookupStart - activationStart, 0);
    const connectStart = Math.max(
      performanceEntry.connectStart - activationStart, 0);
    const requestStart = Math.max(
      performanceEntry.requestStart - activationStart, 0);
    const responseStart = Math.max(
      performanceEntry.responseStart - activationStart, 0);

    const env = performanceEntry.serverTiming.find(el => el.name === 'stage');
    const cdnCacheStatus = getCDNProviderCacheStatus(performanceEntry.serverTiming);

    // console.log("Response status ", performanceEntry.responseStatus);
    (metric as ResourceMetricWithAttribution).attribution = {
      waitingTime: dnsStart,
      dnsTime: connectStart - dnsStart,
      connectionTime: requestStart - connectStart,
      requestTime: responseStart - requestStart,
      // requestTime: metric.value - requestStart,
      transferSize: performanceEntry.transferSize,
      // performanceEntry: performanceEntry,
      compressRate: 1 - (performanceEntry.encodedBodySize / performanceEntry.decodedBodySize),
      cacheStatus: cdnCacheStatus.cacheStatus,
      cdn: cdnCacheStatus.cdn,
      env: env ? env.description : "prod",
      initiatorType: performanceEntry.initiatorType,
      nextHopProtocol: performanceEntry.nextHopProtocol,
      name: performanceEntry.name,
      serverTiming: performanceEntry.serverTiming,
      metricType: metric.name,
    };
    // delete metric.entries;
  } else {
    (metric as ResourceMetricWithAttribution).attribution = {
      waitingTime: 0,
      dnsTime: 0,
      connectionTime: 0,
      requestTime: 0,
      transferSize: 0,
      metricType: metric.name,
    };
  }
};

export const onResource = (onReport: ResourceReportCallbackWithAttribution, opts?: ReportOpts) => {
  unattributedOnResource(((metric: ResourceMetricWithAttribution) => {
    attributeResource(metric);
    onReport(metric);
  }) as ResourceReportCallback, opts);
};