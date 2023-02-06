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

import { Metric, ReportCallback } from './base.js';

/**
 * A CLS-specific version of the Metric object.
 */
export interface ResourceMetric extends Metric {
  name: 'RESOURCE';
  entries: PerformanceResourceTiming[];
}

/**
 * A CLS-specific version of the ReportCallback function.
 */
export interface ResourceReportCallback extends ReportCallback {
  (metric: ResourceMetric): void;
}

export interface ResourceAttribution {

  waitingTime: number;
  /**
   * The total time to resolve the DNS for the current request.
   */
  dnsTime: number;
  /**
   * The total time to create the connection to the requested domain.
   */
  connectionTime: number;
  /**
   * The time time from when the request was sent until the first byte of the
   * response was received. This includes network time as well as server
   * processing time.
   */
  requestTime: number;
  /**
     * The transfer size
     */
  transferSize: number;
  /**
     * The compression rate
     */
  compressRate?: number;
  /**
       * The compression rate
       */
  cacheStatus?: string;
  //HTTP protocol used
  nextHopProtocol?: string;

  //caller of this resource, image,link,script
  initiatorType?: string;

  cdn?: string;
  //environment whether staging or prod..no value implies its prod
  env?: string;

  // name of the resource
  name?: string;

  serverTiming?: object;

  //metric Type whether resource, navigation, ttfb, lcp 
  metricType: string;
  /**
   * The `PerformanceResourceTiming` entry used to determine TTFB (or the
   * polyfill entry in browsers that don't support Navigation Timing).
   */
  // performanceEntry?: PerformanceResourceTiming;
}

/**
 * A Resource-specific version of the Metric object with attribution.
 */
export interface ResourceMetricWithAttribution extends ResourceMetric {
  attribution?: ResourceAttribution;
}

/**
 * A Resource-specific version of the ReportCallback function with attribution.
 */
export interface ResourceReportCallbackWithAttribution extends ResourceReportCallback {
  (metric: ResourceMetricWithAttribution): void;
}