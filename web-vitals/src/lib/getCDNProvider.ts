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

export const getCDNProviderCacheStatus = (serverTiming: readonly PerformanceServerTiming[]) => {
  // let el = serverTiming.find(el => el.name === '');
  let response = { cacheStatus: "NA", cdn: "NA" };
  serverTiming.map(el => {
    switch (el.name) {
      case 'cdn-cache-miss':
        response.cacheStatus = "MISS";
        response.cdn = "Cloudfront";
        break;
      case 'cdn-cache-hit':
        response.cacheStatus = "HIT";
        response.cdn = "Cloudfront";
        break;
      case 'cdn-cache-refresh':
        response.cacheStatus = "REFRESH-HIT";
        response.cdn = "Cloudfront";
        break;
      // header signifies its CloudFront
      // case 'cdn-rid':
      //   response.cdn = "Cloudfront";
      //   break;
      // header signifies its Akamai
      case 'cdn-cache':
        response.cdn = "Akamai";
        response.cacheStatus = el.description;
        break;
    }
  });

  return response;
};
